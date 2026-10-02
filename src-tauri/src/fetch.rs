use std::net::{IpAddr, SocketAddr};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use reqwest::header::{ACCEPT, CONTENT_TYPE, LOCATION};
use reqwest::{redirect::Policy, Client, Url};

const MAX_REDIRECTS: usize = 5;
const DEFAULT_MAX_BYTES: usize = 100 * 1024;
const MIN_MAX_BYTES: usize = 1024;
const MAX_MAX_BYTES: usize = 1024 * 1024;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MIN_TIMEOUT_MS: u64 = 1000;
const MAX_TIMEOUT_MS: u64 = 120_000;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchResponse {
    status: u16,
    content_type: String,
    final_url: String,
    body: String,
}

pub fn is_blocked_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            let o = v4.octets();
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
                || v4.is_documentation()
                || v4.is_multicast()
                || o[0] == 0
                || (o[0] == 100 && (64..=127).contains(&o[1]))
                || (o[0] == 192 && o[1] == 0 && o[2] == 0)
                || (o[0] == 198 && (o[1] == 18 || o[1] == 19))
                || o[0] >= 240
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_blocked_ip(IpAddr::V4(v4));
            }
            let seg = v6.segments();
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || (seg[0] & 0xffc0) == 0xfe80
                || (seg[0] & 0xfe00) == 0xfc00
        }
    }
}

async fn resolve_public(url: &Url) -> Result<Vec<SocketAddr>, String> {
    let host = url.host_str().ok_or_else(|| "⛔ URL sin host".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "⛔ URL sin puerto".to_string())?;
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_blocked_ip(ip) {
            return Err(format!("⛔ SSRF bloqueado: {host} es una IP interna"));
        }
        return Ok(vec![SocketAddr::new(ip, port)]);
    }
    let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|e| format!("ERROR al resolver {host}: {e}"))?
        .collect();
    if addrs.is_empty() {
        return Err(format!("ERROR al resolver {host}: sin resultados DNS"));
    }
    if addrs.iter().any(|a| is_blocked_ip(a.ip())) {
        return Err(format!(
            "⛔ SSRF bloqueado: {host} resuelve a una IP interna"
        ));
    }
    Ok(addrs)
}

fn decode_body(bytes: &[u8], content_type: &str) -> String {
    let charset = content_type.split(';').find_map(|part| {
        let part = part.trim();
        part.to_ascii_lowercase()
            .strip_prefix("charset=")
            .map(|c| c.trim().trim_matches('"').to_string())
    });
    let encoding = charset
        .as_deref()
        .and_then(|c| encoding_rs::Encoding::for_label(c.as_bytes()))
        .unwrap_or(encoding_rs::UTF_8);
    let (text, _, _) = encoding.decode(bytes);
    text.into_owned()
}

async fn read_capped(
    resp: reqwest::Response,
    max_bytes: usize,
) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("ERROR de red: {e}"))?;
        let remaining = max_bytes.saturating_sub(body.len());
        if remaining == 0 {
            break;
        }
        let take = remaining.min(chunk.len());
        body.extend_from_slice(&chunk[..take]);
        if take < chunk.len() {
            break;
        }
    }
    Ok(body)
}

#[tauri::command]
pub async fn fetch_url_guarded(
    url: String,
    max_bytes: Option<usize>,
    timeout_ms: Option<u64>,
) -> Result<FetchResponse, String> {
    let cap = max_bytes
        .unwrap_or(DEFAULT_MAX_BYTES)
        .clamp(MIN_MAX_BYTES, MAX_MAX_BYTES);
    let timeout = Duration::from_millis(
        timeout_ms
            .unwrap_or(DEFAULT_TIMEOUT_MS)
            .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    );
    let deadline = Instant::now() + timeout;

    let mut current = Url::parse(&url).map_err(|e| format!("⛔ URL inválida: {e}"))?;
    let mut redirects = 0usize;

    loop {
        if current.scheme() != "http" && current.scheme() != "https" {
            return Err("⛔ Solo se admite http(s)://".to_string());
        }
        let addrs = resolve_public(&current).await?;
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(format!("⏱️ Timeout al leer {url}"));
        }
        let host = current.host_str().unwrap_or("").to_string();
        let client = Client::builder()
            .user_agent("R7SIGNAL/0.1")
            .redirect(Policy::none())
            .timeout(remaining)
            .resolve_to_addrs(&host, &addrs)
            .build()
            .map_err(|e| format!("ERROR al crear el cliente HTTP: {e}"))?;

        let resp = client
            .get(current.clone())
            .header(ACCEPT, "text/html,application/json,text/plain,*/*")
            .send()
            .await
            .map_err(|e| format!("ERROR al leer {}: {e}", current))?;

        let status = resp.status().as_u16();
        let content_type = resp
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        let location = resp
            .headers()
            .get(LOCATION)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        if matches!(status, 301 | 302 | 303 | 307 | 308) {
            if redirects >= MAX_REDIRECTS {
                return Err(format!("⛔ Demasiadas redirecciones (>{MAX_REDIRECTS})"));
            }
            let loc = location.ok_or_else(|| format!("⚠️ Redirección sin Location en {current}"))?;
            let next = current
                .join(&loc)
                .map_err(|e| format!("⛔ Redirección inválida: {e}"))?;
            if next.scheme() != "http" && next.scheme() != "https" {
                return Err("⛔ Redirección a un esquema no permitido".to_string());
            }
            redirects += 1;
            current = next;
            continue;
        }

        let bytes = read_capped(resp, cap).await?;
        return Ok(FetchResponse {
            status,
            content_type: content_type.clone(),
            final_url: current.to_string(),
            body: decode_body(&bytes, &content_type),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    #[test]
    fn blocks_private_and_special_ipv4() {
        for ip in [
            Ipv4Addr::new(127, 0, 0, 1),
            Ipv4Addr::new(10, 0, 0, 5),
            Ipv4Addr::new(172, 16, 0, 1),
            Ipv4Addr::new(192, 168, 1, 1),
            Ipv4Addr::new(169, 254, 169, 254),
            Ipv4Addr::new(0, 0, 0, 0),
            Ipv4Addr::new(100, 64, 0, 1),
            Ipv4Addr::new(192, 0, 0, 1),
            Ipv4Addr::new(198, 18, 0, 1),
            Ipv4Addr::new(240, 0, 0, 1),
        ] {
            assert!(is_blocked_ip(IpAddr::V4(ip)), "deberia bloquear {ip}");
        }
    }

    #[test]
    fn allows_public_ipv4() {
        for ip in [
            Ipv4Addr::new(8, 8, 8, 8),
            Ipv4Addr::new(1, 1, 1, 1),
            Ipv4Addr::new(172, 15, 0, 1),
            Ipv4Addr::new(172, 32, 0, 1),
            Ipv4Addr::new(93, 184, 216, 34),
        ] {
            assert!(!is_blocked_ip(IpAddr::V4(ip)), "no deberia bloquear {ip}");
        }
    }

    #[test]
    fn blocks_private_and_special_ipv6() {
        for ip in [
            Ipv6Addr::LOCALHOST,
            Ipv6Addr::UNSPECIFIED,
            "fe80::1".parse().unwrap(),
            "fc00::1".parse().unwrap(),
            "fd12:3456::1".parse().unwrap(),
            "::ffff:127.0.0.1".parse().unwrap(),
            "::ffff:10.0.0.1".parse().unwrap(),
        ] {
            assert!(is_blocked_ip(IpAddr::V6(ip)), "deberia bloquear {ip}");
        }
    }

    #[test]
    fn allows_public_ipv6() {
        for ip in ["2606:4700:4700::1111".parse().unwrap(), "2001:4860:4860::8888".parse().unwrap()] {
            assert!(!is_blocked_ip(IpAddr::V6(ip)), "no deberia bloquear {ip}");
        }
    }

    #[test]
    fn decodes_latin1_charset() {
        let bytes = [0x63, 0x61, 0x66, 0xe9];
        assert_eq!(decode_body(&bytes, "text/plain; charset=iso-8859-1"), "café");
        assert_eq!(decode_body(&bytes, "text/plain"), "caf\u{fffd}");
    }
}

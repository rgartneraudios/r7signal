# R7 Desktop v0.1.0 — release notes

First public build of R7 Desktop: a Windows desktop app (Tauri 2 + React 18 + Vite) built around three
LLM agents and an append-only context wheel that keeps the prompt prefix cacheable.

## Download

| Asset | Size | SHA-256 |
| --- | --- | --- |
| `R7 Desktop_0.1.0_x64-setup.exe` | 5,856,905 bytes (5.6 MB) | `33CFD8633648E8A18BAB5616774734F5305437F5AE4B2751E4B79BDCF2680EFA` |

Verify the download before running it:

```powershell
Get-FileHash ".\R7 Desktop_0.1.0_x64-setup.exe" -Algorithm SHA256
```

## Install

1. Run `R7 Desktop_0.1.0_x64-setup.exe`.
2. Windows SmartScreen will warn because the build is **not code-signed**. Choose **More info** →
   **Run anyway**. That warning is expected, not a sign of tampering.
3. The installer is per-user and does not need administrator rights. If the WebView2 runtime is not
   already on the machine, the installer fetches the bootstrapper, so that first install needs a
   network connection.
4. On first launch the app asks for an API key: OpenRouter by default, or DeepSeek direct, or a local
   Ollama / LM Studio server with no key at all. The key is stored on your machine
   (`local_config.json` inside the app data folder) and is only ever used to call the provider you
   chose. There is no hosted tier and no proxy of ours in v0.1.

## What is in this build

- **Three agents** — Cochi (tasks: reads, writes and runs commands inside a chosen workspace folder,
  with scoped permissions, a plan board, subagents and revertible per-turn snapshots), Asun (music and
  images) and Tito (chat with web search as an OpenRouter server tool, with citations).
- **The R7 wheel** — one append-only store of turn pairs per agent, compacted by hand at 70k tokens
  (no model call), so the prefix stays byte-identical and the provider's prefix cache can hit.
- **BYOK multi-provider** — OpenRouter (default), DeepSeek direct, Ollama and LM Studio, one key per
  provider.
- **A real SSRF guard** — `web_fetch` goes through the Rust command `fetch_url_guarded`: DNS
  resolution, internal addresses rejected, validated IP pinned, redirects revalidated.
- **34 harness suites** — the pure logic (wheel, sessions, plans, snapshots, permissions, LLM client,
  token accounting) is covered by `npm test` with no network.

## Known limitations

- Not code-signed: SmartScreen warns, and the publisher field of the installer is empty.
- The API key is stored in plain text in the app data folder; a system keyring is a listed
  good-first-issue.
- **Full access is real access.** The bundled `cochi-full-access` capability lets the task agent spawn
  `powershell` or `bash` with scope over your home folder. That is by design; read the security notes
  in the `README.md` before pointing the agent at a folder you care about.
- This release makes no token-savings claim. The reproducible IN/OUT table is still pending
  (`docs/PLAN-OPENSOURCE.md`, S19).
- Supabase is optional and outside the critical path: the system prompts and the image styles live in
  the repository.

## License

MIT — see `LICENSE`. The license covers the code, not the name: R7Signal and R7 Desktop belong to the
author (see the Trademark section of the `README.md`).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      app.handle().plugin(tauri_plugin_fs::init())?;
      app.handle().plugin(tauri_plugin_http::init())?;
      app.handle().plugin(tauri_plugin_shell::init())?;
      app.handle().plugin(tauri_plugin_dialog::init())?;
      app.handle().plugin(tauri_plugin_opener::init())?;
      apply_backdrop_fallback(app);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(target_os = "windows")]
fn apply_backdrop_fallback(app: &mut tauri::App) {
  use tauri::window::{Color, Effect, EffectsBuilder};
  use tauri::Manager;

  let build = windows_version::OsVersion::current().build;
  if build >= 22000 {
    return;
  }
  if build < 17763 {
    return;
  }
  if let Some(window) = app.get_webview_window("main") {
    let effects = EffectsBuilder::new()
      .effect(Effect::Acrylic)
      .color(Color(15, 14, 17, 180))
      .build();
    let _ = window.set_effects(effects);
  }
}

#[cfg(not(target_os = "windows"))]
fn apply_backdrop_fallback(_app: &mut tauri::App) {}

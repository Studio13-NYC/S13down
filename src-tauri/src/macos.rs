use crate::documents::AppState;
use tauri::{Emitter, Manager, menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem as Native, Submenu}};

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();
    let action = |id, title, shortcut| MenuItem::with_id(handle, id, title, true, Some(shortcut));
    app.set_menu(Menu::with_items(handle, &[
        &Submenu::with_items(handle, "S13down", true, &[
            &Native::about(handle, Some("About S13down"), Some(AboutMetadata {
                name: Some("S13down".into()), version: Some(app.package_info().version.to_string()), ..Default::default()
            }))?,
            &Native::separator(handle)?,
            &Native::services(handle, None)?,
            &Native::hide(handle, None)?,
            &Native::hide_others(handle, None)?,
            &Native::show_all(handle, None)?,
            &Native::separator(handle)?,
            &Native::quit(handle, Some("Quit S13down"))?,
        ])?,
        &Submenu::with_items(handle, "File", true, &[
            &action("new", "New", "Cmd+N")?,
            &action("open", "Open…", "Cmd+O")?,
            &action("save", "Save", "Cmd+S")?,
            &action("saveas", "Save As…", "Cmd+Shift+S")?,
            &Native::separator(handle)?,
            &Native::close_window(handle, None)?,
        ])?,
        &Submenu::with_items(handle, "Edit", true, &[
            &action("undo", "Undo", "Cmd+Z")?,
            &action("redo", "Redo", "Cmd+Shift+Z")?,
            &Native::separator(handle)?,
            &Native::cut(handle, None)?,
            &Native::copy(handle, None)?,
            &Native::paste(handle, None)?,
            &Native::select_all(handle, None)?,
            &Native::separator(handle)?,
            &action("find", "Find in Source", "Cmd+F")?,
        ])?,
        &Submenu::with_items(handle, "View", true, &[
            &action("mode", "Rendered / Source", "Cmd+/")?,
            &action("zoomin", "Larger Text", "Cmd+=")?,
            &action("zoomout", "Smaller Text", "Cmd+-")?,
            &action("zoomreset", "Reset Text Size", "Cmd+0")?,
            &Native::fullscreen(handle, None)?,
        ])?,
        &Submenu::with_items(handle, "Window", true, &[
            &Native::minimize(handle, None)?,
            &Native::maximize(handle, None)?,
        ])?,
    ])?)?;
    app.on_menu_event(|app, event| {
        if let Some(window) = app.webview_windows().values().find(|w| w.is_focused().unwrap_or(false)) {
            let _ = window.emit("menu-action", event.id().as_ref());
        }
    });
    Ok(())
}

pub fn on_event(app: &tauri::AppHandle, event: tauri::RunEvent) {
    match event {
        tauri::RunEvent::Opened { urls } => {
            // Retain Finder requests until a frontend is ready, including cold launch.
            if let Ok(mut docs) = app.state::<AppState>().0.lock() {
                docs.open_requests.extend(urls.into_iter().filter_map(|url| url.to_file_path().ok()));
            }
            let _ = app.emit("files-opened", ());
        }
        tauri::RunEvent::ExitRequested { api, .. } => {
            // Native Quit must go through the same unsaved-change prompt as Close.
            let windows = app.webview_windows();
            if !windows.is_empty() {
                api.prevent_exit();
                for window in windows.values() { let _ = window.close(); }
            }
        }
        _ => {}
    }
}

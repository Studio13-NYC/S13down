#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod files;
mod documents;
#[cfg(target_os = "macos")]
mod macos;
use std::path::PathBuf;
use serde::Serialize;
use files::{FileDocument, atomic_write, encoded};
use base64::Engine;
use documents::{AppState, WindowDocument};
use tauri::Manager;

#[derive(Serialize)]
struct Opened { path: String, text: String }

#[tauri::command]
async fn open_document(window: tauri::WebviewWindow, state: tauri::State<'_, AppState>, initial: bool, requested_path: Option<String>) -> Result<Option<Opened>, String> {
    let state = state.inner().clone();
    let label = window.label().to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let path = if let Some(path) = requested_path { Some(PathBuf::from(path))
        } else if initial {
            state.0.lock().map_err(|e| e.to_string())?.windows.entry(label.clone()).or_default().initial_path.take()
        } else {
            rfd::FileDialog::new().add_filter("Markdown", &["md", "markdown", "txt"]).pick_file()
        };
        let Some(path) = path else { return Ok(None) };
        let path = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
        let (doc,text) = FileDocument::open(&path)?;
        let result = Opened {path: display_path(&path), text};
        state.0.lock().map_err(|e| e.to_string())?.windows.entry(label).or_default().document = Some(doc);
        Ok(Some(result))
    }).await.map_err(|e| e.to_string())?
}
fn display_path(path: &std::path::Path) -> String { path.to_string_lossy().trim_start_matches("\\\\?\\").to_string() }

#[tauri::command]
fn new_document(window: tauri::WebviewWindow, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.0.lock().map_err(|e| e.to_string())?.windows.entry(window.label().into()).or_default().document = None; Ok(())
}

#[tauri::command]
async fn save_document(window: tauri::WebviewWindow, state: tauri::State<'_, AppState>, text: String, save_as: bool) -> Result<Option<String>, String> {
    let state = state.inner().clone();
    let label = window.label().to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let old_path = {
            let mut docs = state.0.lock().map_err(|e| e.to_string())?;
            let document = &mut docs.windows.entry(label.clone()).or_default().document;
            if !save_as {
                if let Some(doc) = document.as_mut() { doc.save(&text)?; return Ok(Some(display_path(&doc.path))); }
            }
            document.as_ref().map(|doc| doc.path.clone())
        };
        let mut dialog = rfd::FileDialog::new().add_filter("Markdown", &["md"]);
        if let Some(path) = old_path {
            if let Some(parent) = path.parent() { dialog = dialog.set_directory(parent); }
            if let Some(name) = path.file_name() { dialog = dialog.set_file_name(name.to_string_lossy()); }
        } else { dialog = dialog.set_file_name("Untitled.md"); }
        // Never hold application state while a native modal dialog is running.
        let Some(path) = dialog.save_file() else { return Ok(None) };
        let mut docs = state.0.lock().map_err(|e| e.to_string())?;
        let guard = &mut docs.windows.entry(label).or_default().document;
        // Choosing the same path must retain external-change protection.
        if let Some(doc) = guard.as_mut() {
            if std::fs::canonicalize(&path).ok().as_ref() == Some(&doc.path) {
                doc.save(&text)?; return Ok(Some(display_path(&doc.path)));
            }
        }
        let bom = guard.as_ref().is_some_and(|d| d.bom);
        let bytes = encoded(&text, bom); atomic_write(&path, &bytes)?;
        let path = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
        let result = display_path(&path);
        *guard = Some(FileDocument { path, bytes, bom }); Ok(Some(result))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn resolve_image(window: tauri::WebviewWindow, state: tauri::State<'_, AppState>, url: String) -> Result<String, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let doc = guard.windows.get(window.label()).and_then(|w| w.document.as_ref()).ok_or("Save the document before using relative images.")?;
    let parent = doc.path.parent().ok_or("No document folder.")?;
    let path = std::fs::canonicalize(parent.join(url)).map_err(|e| e.to_string())?;
    if !path.starts_with(parent) { return Err("Images must be inside the document's folder.".into()); }
    let mime = match path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase().as_str() {
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "webp" => "image/webp", "gif" => "image/gif", "svg" => "image/svg+xml", _ => return Err("Unsupported image format.".into())
    };
    if std::fs::metadata(&path).map_err(|e|e.to_string())?.len() > 15 * 1024 * 1024 { return Err("Image exceeds 15 MB.".into()); }
    let data = std::fs::read(path).map_err(|e| e.to_string())?;
    Ok(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(data)))
}

#[tauri::command]
fn next_open_request(state: tauri::State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.0.lock().map_err(|e| e.to_string())?.open_requests.pop_front().map(|p| display_path(&p)))
}

#[tauri::command]
async fn open_document_window(app: tauri::AppHandle, state: tauri::State<'_, AppState>, path: String) -> Result<(), String> {
    let label = {
        let mut docs = state.0.lock().map_err(|e| e.to_string())?;
        docs.next_window += 1;
        let label = format!("document-{}", docs.next_window);
        docs.windows.insert(label.clone(), WindowDocument {
            initial_path: Some(PathBuf::from(path)), ..Default::default()
        });
        label
    };
    if let Err(error) = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::default())
        .title("S13down").inner_size(1060.0, 820.0).min_inner_size(620.0, 420.0).build() {
        state.0.lock().map_err(|e| e.to_string())?.windows.remove(&label);
        return Err(error.to_string());
    }
    Ok(())
}

fn main() {
    let initial_path = std::env::args_os().skip(1).map(PathBuf::from).find(|p| p.is_file());
    let builder = tauri::Builder::default().manage(AppState::with_initial_path(initial_path))
        .invoke_handler(tauri::generate_handler![open_document,new_document,save_document,resolve_image,next_open_request,open_document_window])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Ok(mut docs) = window.state::<AppState>().0.lock() { docs.windows.remove(window.label()); }
            }
        });
    #[cfg(target_os = "macos")]
    let builder = builder.setup(macos::setup);
    builder.build(tauri::generate_context!()).expect("Could not start S13down")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            macos::on_event(_app, _event);
        });
}

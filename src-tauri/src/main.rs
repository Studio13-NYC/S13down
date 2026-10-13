#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod files;
use std::{path::PathBuf, sync::{Arc, Mutex}};
use serde::Serialize;
use files::{FileDocument, atomic_write, encoded};
use base64::Engine;

#[derive(Clone, Default)]
struct AppState(Arc<Mutex<Option<FileDocument>>>);
#[derive(Serialize)]
struct Opened { path: String, text: String }

#[tauri::command]
async fn open_document(state: tauri::State<'_, AppState>, initial: bool) -> Result<Option<Opened>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let path = if initial {
            std::env::args_os().skip(1).map(PathBuf::from).find(|p| p.is_file())
        } else {
            rfd::FileDialog::new().add_filter("Markdown", &["md", "markdown", "txt"]).pick_file()
        };
        let Some(path) = path else { return Ok(None) };
        let path = std::fs::canonicalize(path).map_err(|e| e.to_string())?;
        let (doc,text) = FileDocument::open(&path)?;
        let result = Opened {path: display_path(&path), text};
        *state.0.lock().map_err(|e| e.to_string())? = Some(doc);
        Ok(Some(result))
    }).await.map_err(|e| e.to_string())?
}
fn display_path(path: &std::path::Path) -> String { path.to_string_lossy().trim_start_matches("\\\\?\\").to_string() }

#[tauri::command]
fn new_document(state: tauri::State<'_, AppState>) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = None; Ok(())
}

#[tauri::command]
async fn save_document(state: tauri::State<'_, AppState>, text: String, save_as: bool) -> Result<Option<String>, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if !save_as {
            if let Some(doc) = guard.as_mut() { doc.save(&text)?; return Ok(Some(display_path(&doc.path))); }
        }
        let mut dialog = rfd::FileDialog::new().add_filter("Markdown", &["md"]);
        if let Some(doc) = guard.as_ref() {
            if let Some(parent) = doc.path.parent() { dialog = dialog.set_directory(parent); }
            if let Some(name) = doc.path.file_name() { dialog = dialog.set_file_name(name.to_string_lossy()); }
        } else { dialog = dialog.set_file_name("Untitled.md"); }
        let Some(path) = dialog.save_file() else { return Ok(None) };
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
fn resolve_image(state: tauri::State<'_, AppState>, url: String) -> Result<String, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    let doc = guard.as_ref().ok_or("Save the document before using relative images.")?;
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

fn main() {
    tauri::Builder::default().manage(AppState::default())
        .invoke_handler(tauri::generate_handler![open_document,new_document,save_document,resolve_image])
        .run(tauri::generate_context!()).expect("Could not start S13down");
}

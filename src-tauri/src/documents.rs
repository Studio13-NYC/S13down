use crate::files::FileDocument;
use std::{collections::{HashMap, VecDeque}, path::PathBuf, sync::{Arc, Mutex}};

#[derive(Default)]
pub struct WindowDocument {
    pub document: Option<FileDocument>,
    pub initial_path: Option<PathBuf>,
}

#[derive(Default)]
pub struct Documents {
    pub windows: HashMap<String, WindowDocument>,
    pub open_requests: VecDeque<PathBuf>,
    pub next_window: u64,
}

#[derive(Clone, Default)]
pub struct AppState(pub Arc<Mutex<Documents>>);

impl AppState {
    pub fn with_initial_path(path: Option<PathBuf>) -> Self {
        let state = Self::default();
        state.0.lock().unwrap().windows.insert("main".into(), WindowDocument {
            initial_path: path, ..Default::default()
        });
        state
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_keep_independent_save_destinations() {
        let dir = tempfile::tempdir().unwrap();
        let first = dir.path().join("first.md");
        let second = dir.path().join("second.md");
        std::fs::write(&first, "first").unwrap();
        std::fs::write(&second, "second").unwrap();
        let mut docs = Documents::default();
        for (label, path) in [("main", &first), ("document-1", &second)] {
            docs.windows.insert(label.into(), WindowDocument {
                document: Some(FileDocument::open(path).unwrap().0), initial_path: None,
            });
        }
        docs.windows.get_mut("main").unwrap().document.as_mut().unwrap().save("edited first").unwrap();
        assert_eq!(std::fs::read_to_string(&second).unwrap(), "second");
        docs.windows.get_mut("document-1").unwrap().document.as_mut().unwrap().save("edited second").unwrap();
        assert_eq!(std::fs::read_to_string(&first).unwrap(), "edited first");
    }
}

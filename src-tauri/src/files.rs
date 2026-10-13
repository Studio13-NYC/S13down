use std::{fs, io::Write, path::{Path, PathBuf}};

pub struct FileDocument { pub path: PathBuf, pub bytes: Vec<u8>, pub bom: bool }

impl FileDocument {
    pub fn open(path: &Path) -> Result<(Self, String), String> {
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        if bytes.len() > 10 * 1024 * 1024 { return Err("This prototype supports documents up to 10 MB.".into()); }
        let bom = bytes.starts_with(&[0xef, 0xbb, 0xbf]);
        let text = std::str::from_utf8(if bom { &bytes[3..] } else { &bytes })
            .map_err(|_| "This file is not UTF-8. Convert a copy to UTF-8 before opening it.")?.to_owned();
        if text.contains('\0') { return Err("This does not appear to be a text document.".into()); }
        Ok((Self { path: path.to_owned(), bytes, bom }, text))
    }
    pub fn save(&mut self, text: &str) -> Result<(), String> {
        let current = fs::read(&self.path).map_err(|e| format!("Cannot verify the file on disk: {e}. Use Save As to save a copy."))?;
        if current != self.bytes { return Err("This file changed outside PlainMarkdown. Use Save As to keep your edits in a separate copy, or reopen the file.".into()); }
        let bytes = encoded(text, self.bom);
        if bytes == current { return Ok(()); }
        atomic_write(&self.path, &bytes)?;
        self.bytes = bytes; Ok(())
    }
}

pub fn encoded(text: &str, bom: bool) -> Vec<u8> {
    let mut bytes = if bom { vec![0xef, 0xbb, 0xbf] } else { vec![] };
    bytes.extend_from_slice(text.as_bytes()); bytes
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if path.exists() && fs::metadata(path).map_err(|e| e.to_string())?.permissions().readonly() {
        return Err("The file is read-only. Use Save As to save a copy.".into());
    }
    let parent = path.parent().ok_or("The file has no parent folder.")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(bytes).and_then(|_| temp.as_file().sync_all()).map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn preserves_bom_crlf_and_final_newline_on_no_edit_save() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("日本語 notes.md");
        let original = b"\xef\xbb\xbf# Title\r\n\r\n* item";
        fs::write(&path, original).unwrap();
        let (mut doc,text) = FileDocument::open(&path).unwrap(); doc.save(&text).unwrap();
        assert_eq!(fs::read(path).unwrap(), original);
    }
    #[test] fn refuses_to_overwrite_an_external_edit() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("notes.md");
        fs::write(&path,"old").unwrap(); let (mut doc,_) = FileDocument::open(&path).unwrap();
        fs::write(&path,"external").unwrap(); assert!(doc.save("mine").is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "external");
    }
    #[test] fn successful_save_replaces_whole_file_and_updates_identity() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("notes.md");
        fs::write(&path,"long original text").unwrap(); let (mut doc,_) = FileDocument::open(&path).unwrap();
        doc.save("short").unwrap(); doc.save("again").unwrap();
        assert_eq!(fs::read_to_string(path).unwrap(), "again");
    }
    #[test] fn invalid_encoding_is_rejected_without_modifying_the_file() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("bad.md");
        fs::write(&path,[0xff,0xfe,0x41,0x00]).unwrap();
        assert!(FileDocument::open(&path).is_err());
        assert_eq!(fs::read(path).unwrap(), [0xff,0xfe,0x41,0x00]);
    }
}

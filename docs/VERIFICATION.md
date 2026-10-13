# Prototype verification — October 13, 2026

## Naming update

The user requested **S13down.exe**. The app's display name, window title, Windows executable metadata and installer were renamed to S13down, then rebuilt successfully. Current review artifacts are `builds\S13down.exe` and `builds\S13down_0.1.0_x64-setup.exe`. The project directory, application identifier and draft-storage keys remain stable. Earlier PlainMarkdown artifacts and verification results below are retained as the initial build record.

## Toolchain

User-wide rustup at `C:\Users\NickKatsivelos\.cargo`; persistent user PATH contains its `bin` directory. Verified:

```
rustc 1.99.0 (b940084d7 2026-09-28)
cargo 1.99.0 (5f94df478 2026-08-27)
stable-x86_64-pc-windows-msvc (default)
```

Real Rust compilation succeeded for tests and the Windows release executable, using the existing Visual Studio C++ toolchain.

## Automated checks

| Command | Result |
|---|---|
| `npm test` | 10 document/session tests passed |
| `npm run test:ui` | 7 tests passed against the real editor in Edge |
| `cargo test --manifest-path src-tauri\Cargo.toml` | 4 filesystem tests passed |
| `npm run tauri -- build` | TypeScript/Vite, optimized Rust executable and NSIS installer succeeded |

Coverage: exact source through unchanged switches, rich/source propagation, cross-mode undo, keyboard focus, unsupported-content fallback, canceled document replacement, recovery after reload, GFM tables/tasks/code/Unicode, CRLF on source editing, durable uploaded image data and search focus. Native filesystem tests cover BOM/CRLF/no-final-newline preservation, external-change rejection, replacement/save identity and invalid-encoding rejection.

Vite reports a large primary bundle; optimization is deferred until interaction/performance feedback. The npm dependency-audit limitation is recorded in README.

## Actual Windows executable checks

Used `builds\PlainMarkdown.exe` with disposable fixtures under `.tools`; operated through the Windows UI. The installed system's dark appearance was visually inspected.

- Opened `.tools\Windows 日本語.md` via command-line file argument. Spaces and Japanese filename displayed correctly; rendered mode was the initial mode.
- Rendered → Source → Rendered → Save with no edits retained SHA-256 `FFBD06193434A52DADD39ECAD48B9C3A03E5737825AA7D52E265C5C51F75C37E` exactly.
- Edited a rendered paragraph and saved. Read the file back from disk: new text persisted, UTF-8 BOM and CRLF remained, and no final newline was added. List markers normalized from `-` to `*`, as documented.
- Edited source, then separately appended an external change to the fixture. Save showed an external-change error and kept the dirty state. Disk SHA-256 stayed `C8C59D5288B38951AD617533893AA8AF7D8E2EAB1EE537AD1E273BEF01F5E224`.
- Used the native Save As picker to save `.tools\Saved copy 日本語.md`; verified source edits on disk and the original external version untouched.
- Used the native Open picker to load `examples\Welcome.md`; it opened rendered despite the previous document being in Source.
- Created a new disposable draft, closed the window, and received the unsaved-change prompt. Cancel retained the draft. Closing again and choosing Discard removed the window/process.
- Relaunched the welcome document for user review.

## Delivered artifacts

| File under `builds` | Bytes | SHA-256 |
|---|---:|---|
| `PlainMarkdown.exe` | 9,811,968 | `32157A5317DC29FF52AD239CDC25451C29CB0AD574E6DBD4888C6FEAE8A2A5D4` |
| `PlainMarkdown_0.1.0_x64-setup.exe` | 3,561,597 | `17EA953DC0ABE114F5D71F092AB573841DF7E0BA2AE9669DD4E6C749D2CE8F10` |

The installer was built, not installed. File-handler registration/default-app selection, WebView2 bootstrap on a clean machine, all DPI settings, IME composition, accessibility tooling, large files, crash recovery in the native WebView and a broad set of personal documents still require qualification. This is a prototype for assessing the editing direction, not a production release.

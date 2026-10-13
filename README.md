# PlainMarkdown

A small Windows Markdown editor. Documents open rendered and editable; **Rendered / Source** switches to editable Markdown. One document per window, ordinary files, no account or library.

## Try the prototype

- Run `builds\PlainMarkdown.exe` directly, or install `builds\PlainMarkdown_0.1.0_x64-setup.exe`.
- Requires Windows with Microsoft Edge WebView2. The installer can bootstrap WebView2 if it is missing.
- To make it your default: install, then right-click an `.md` file → **Open with** → **Choose another app** → **PlainMarkdown** → **Always**. Installation registers `.md` and `.markdown`; the app does not change your default automatically.
- You can also pass a filename: `& .\builds\PlainMarkdown.exe 'D:\Notes\My document.md'`.
- This is a locally built, unsigned prototype. Installer/default-app registration still needs a user installation check.

## Controls

| Action | Shortcut |
|---|---|
| Open / Save / Save As | Ctrl+O / Ctrl+S / Ctrl+Shift+S |
| New document | Ctrl+N |
| Rendered / Source | Ctrl+/ |
| Undo / Redo, including across mode switches | Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z |
| Bold / Italic in rendered mode | Ctrl+B / Ctrl+I |
| Find in source | Ctrl+F |
| Text size / Reset | Ctrl++ / Ctrl+− / Ctrl+0 |

Supports headings, paragraphs, lists, tasks, block quotes, links, fenced code, tables and images. Appearance follows Windows light/dark preference. A source fallback preserves front matter, HTML/comments, footnotes, directives and math that this prototype does not render.

## File behavior and limits

- UTF-8, with or without BOM; documents up to 10 MB. Other encodings are rejected.
- Unchanged mode switches retain exact source. Source edits preserve LF or CRLF. Rich edits can normalize Markdown spelling and whitespace; mixed line endings and arbitrary Markdown dialects are not guaranteed.
- Save verifies the file still matches the opened/saved bytes, writes a temporary file in the same folder, then replaces the destination. An external change stops Save and asks you to use Save As or reopen. There is no live file watcher; conflict detection happens on Save. A narrow filesystem race between checking and replacement remains.
- Unsaved changes prompt before replacing/closing a document. Draft recovery uses the WebView profile's local storage and recovers to an untitled copy. It has a finite quota and reports storage failure. With several windows, an offered draft may still be open elsewhere; recovery never writes over its original file.
- Undo groups nearby typing and keeps up to 150 document snapshots. It spans mode switches. Caret positions are approximate after undo and across modes; exact selections are not mapped.
- Relative images must be inside the saved document's folder or a subfolder, up to 15 MB. HTTPS images need a connection. Uploads under 2 MB are embedded as durable data URLs, making the Markdown file larger. Larger images should be linked by relative path in Source.
- Links are editable but do not open a browser from the document. Find switches to Source. No tabs, file library, export, math/diagrams or plugins.
- Automated UI tests cover Edge; native Windows smoke checks are recorded in `docs/VERIFICATION.md`. IME, all Windows scaling settings, accessibility tooling and large-document performance still need broader testing.

## Build and test

Prerequisites: Node/npm, Rust stable MSVC, Visual Studio C++ build tools and WebView2. Rust was installed user-wide with rustup in `C:\Users\NickKatsivelos\.cargo`; restart an existing terminal to pick up its PATH entry.

```powershell
Set-Location 'D:\Studio13\Lab\Code\PlainMarkdown'
npm ci
npm test
npm run test:ui
cargo test --manifest-path src-tauri\Cargo.toml
npm run tauri -- dev
npm run tauri -- build
```

Build output: `src-tauri\target\release\plainmarkdown.exe` and `src-tauri\target\release\bundle\nsis\PlainMarkdown_0.1.0_x64-setup.exe`. `builds` contains review copies of those artifacts. Tests use fixture copies, not personal documents. UI tests use installed Edge.

Stack: Tauri 2, TypeScript/Vite, Milkdown Crepe, CodeMirror 6. The implementation is independent of Typora code. See `docs/DESIGN.md` for the original direction and `docs/IMPLEMENTATION.md` for decisions.

Dependency audit: four low-severity npm reports currently trace to an older nested KaTeX dependency in Crepe's math parsing chain. Math rendering is disabled. No forced downgrade of the editor was applied.

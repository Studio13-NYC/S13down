# S13down
# Blazing Fast, Feather Light markdown reader (with edit capabilities) 
## stop using some bloated, clunky-ass markdown reader that takes forever to load and some even want your money. Do yourself a favor, get it set up as your default .md reader. Anytime you click on a markdown file, you will experience bliss.  

A small Markdown editor for Windows and macOS. Documents open readable and editable; **Rendered / Source** switches to editable Markdown. One document per window, ordinary files, no account or library.

## Download the alpha

**[v0.1.0-alpha.1 — downloads and release notes](https://github.com/Studio13-NYC/S13down/releases/tag/v0.1.0-alpha.1)**

| Platform | Download |
|---|---|
| Windows x64 — installer | [S13down setup](https://github.com/Studio13-NYC/S13down/releases/download/v0.1.0-alpha.1/S13down_0.1.0-alpha.1_x64-setup.exe) |
| Windows x64 — standalone executable | [S13down.exe](https://github.com/Studio13-NYC/S13down/releases/download/v0.1.0-alpha.1/S13down.exe) |
| macOS 13+ — Apple Silicon and Intel | [Universal DMG](https://github.com/Studio13-NYC/S13down/releases/download/v0.1.0-alpha.1/S13down_0.1.0-alpha.1_universal.dmg) |
| macOS — alternative app download | [Zipped S13down.app](https://github.com/Studio13-NYC/S13down/releases/download/v0.1.0-alpha.1/S13down_0.1.0-alpha.1_universal.app.zip) |

This is an **alpha**, intended for testing with copies of your documents. Windows binaries are unsigned; macOS uses an ad-hoc signature and is not Apple-notarized. macOS native user QA is still pending. [Mac installation and QA checklist](docs/MAC-QA.md) · [Report a problem](https://github.com/Studio13-NYC/S13down/issues).

## Install and open files

- **Windows:** run the installer, or run `S13down.exe` directly.
- Requires Windows with Microsoft Edge WebView2. The installer can bootstrap WebView2 if it is missing.
- To make it your default: install, then right-click an `.md` file → **Open with** → **Choose another app** → **S13down** → **Always**. Installation registers `.md` and `.markdown`; the app does not change your default automatically.
- You can also pass a filename: `& .\S13down.exe 'D:\Notes\My document.md'`.
- **Mac:** open the DMG and drag S13down into Applications. For the first-launch prompt, follow the [Mac installation instructions](docs/MAC-QA.md). Set the default through Finder → Get Info → Open with → S13down → Change All.

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

On macOS, shortcuts use **Command** instead of Ctrl (redo: Command+Shift+Z). The Mac port adds native File/Edit/View menus, Finder document opening, and the system font and light/dark appearance.

## File behavior and limits

- UTF-8, with or without BOM; documents up to 10 MB. Other encodings are rejected.
- Unchanged mode switches retain exact source. Source edits preserve LF or CRLF. Rich edits can normalize Markdown spelling and whitespace; mixed line endings and arbitrary Markdown dialects are not guaranteed.
- Save verifies the file still matches the opened/saved bytes, writes a temporary file in the same folder, then replaces the destination. An external change stops Save and asks you to use Save As or reopen. There is no live file watcher; conflict detection happens on Save. A narrow filesystem race between checking and replacement remains.
- Unsaved changes prompt before replacing/closing a document. Draft recovery uses the WebView profile's local storage and recovers to an untitled copy. It has a finite quota and reports storage failure. With several windows, an offered draft may still be open elsewhere; recovery never writes over its original file.
- Undo groups nearby typing and keeps up to 150 document snapshots. It spans mode switches. Caret positions are approximate after undo and across modes; exact selections are not mapped.
- Relative images must be inside the saved document's folder or a subfolder, up to 15 MB. HTTPS images need a connection. Uploads under 2 MB are embedded as durable data URLs, making the Markdown file larger. Larger images should be linked by relative path in Source.
- Links are editable but do not open a browser from the document. Find switches to Source. No tabs, file library, export, math/diagrams or plugins.
- Automated UI tests cover Edge/Chromium and WebKit; native Windows smoke checks for the original prototype are recorded in `docs/VERIFICATION.md`. Mac native checks are still pending in `docs/MACOS.md`. IME, scaling settings, accessibility tooling and large-document performance still need broader testing.

## Build and test

Prerequisites: Node/npm, Rust stable MSVC, Visual Studio C++ build tools and WebView2. Rust was installed user-wide with rustup in `C:\Users\NickKatsivelos\.cargo`; restart an existing terminal to pick up its PATH entry.

```powershell
Set-Location 'D:\Studio13\Lab\Code\S13down'
npm ci
npm test
npx playwright install webkit
npm run test:ui
cargo test --manifest-path src-tauri\Cargo.toml
npm run tauri -- dev
npm run tauri -- build
```

Build output: `src-tauri\target\release\S13down.exe` and `src-tauri\target\release\bundle\nsis\S13down_0.1.0-alpha.1_x64-setup.exe`. `builds` contains local review/release copies; public binaries are attached to GitHub Releases. Tests use fixture copies, not personal documents. UI tests use Edge on Windows (Chromium elsewhere) and Playwright WebKit. Install both engines with `npx playwright install chromium webkit` on a Mac. See [release procedure](docs/RELEASING.md) and [Mac build details](docs/MACOS.md).

Stack: Tauri 2, TypeScript/Vite, Milkdown Crepe, CodeMirror 6. The implementation is independent of Typora code. See `docs/DESIGN.md` for the original direction and `docs/IMPLEMENTATION.md` for decisions.

Dependency audit: four low-severity npm reports currently trace to an older nested KaTeX dependency in Crepe's math parsing chain. Math rendering is disabled. No forced downgrade of the editor was applied.

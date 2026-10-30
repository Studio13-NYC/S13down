# Native macOS prototype

Status: port implemented locally on `codex/macos-port`; no Mac binary has been built or tested yet. The existing Windows review executable is unchanged. Source lives at `D:\Studio13\Lab\Code\S13down` on the development PC.

## What changes

- Same editor and Rust file handling, packaged as `S13down.app` and a drag-to-Applications `.dmg` using Tauri's native macOS host and WKWebView. No Windows emulation or Electron runtime.
- A universal build targets Apple Silicon and Intel, with macOS 13 or newer configured as the minimum. This minimum is a build target, not a claim that every OS version has been tested.
- Command shortcuts, native File/Edit/View/Window menus, system fonts, system light/dark appearance.
- Finder `.md` and `.markdown` open events are queued until the editor is ready. An untouched welcome page receives the first file; existing files and unsaved drafts stay in their windows and further files open separately. Each window owns its own save destination and relative-image folder.
- Native Quit routes windows through their unsaved-change prompts. Cancel leaves that document open; windows already approved for closure can close.
- On Unix, replacement saves preserve the existing file's permission bits.

## Build on a Mac

Install Xcode Command Line Tools (`xcode-select --install`), Node 24/npm, and Rust stable through rustup. From a checkout of this branch:

```sh
npm ci
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npx playwright install chromium webkit
npm test
npm run test:ui
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --target universal-apple-darwin
```

Expected outputs:

- `src-tauri/target/universal-apple-darwin/release/bundle/macos/S13down.app`
- `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`

`.github/workflows/macos.yml` prepares the same build on a GitHub Mac runner, verifies both architectures and the ad-hoc signature, and uploads a DMG and zipped app as workflow artifacts. It does not create a release. The workflow is not yet pushed or run. Live repository inspection on October 30, 2026 found `Studio13-NYC/S13down` public, unlike the original private setup. Do not assume a branch or its build artifacts are private.

The prototype configuration uses ad-hoc signing (`signingIdentity: "-"`), not Apple Developer ID signing or notarization. It is for review, not a frictionless public installer. A distributable release needs a Developer ID identity and notarization configured separately. See [Tauri's signing documentation](https://v2.tauri.app/distribute/sign/macos/).

Once a Mac build exists, move it to Applications. In Finder, select an `.md` file → Get Info → Open with → S13down → Change All. Repeat for `.markdown` if needed. The app registers file types but does not force itself to become the default.

## Verification and remaining checks

Windows-host checks cover document logic, Rust file saves and isolation between windows, and the editor in Chromium/Edge and WebKit. The Mac browser cases use Tauri's IPC mock to test Command keys, menu dispatch, queued launch requests, and preservation of unsaved drafts; they do not prove Cocoa or Finder behavior.

Verified locally on October 30, 2026:

- `npm run build` passed (existing large-bundle warning remains).
- `npm test`: 10 passed.
- `npm run test:ui`: 20 passed across Edge and WebKit.
- `cargo test --locked --manifest-path src-tauri\Cargo.toml --target-dir src-tauri\target\macos-port-check`: 5 passed on Windows. The separate target directory avoids stale build-cache paths from the earlier `PlainMarkdown` folder name. The Unix-only permissions test and macOS-only menu/event module still need the Mac runner.
- `git diff --check` passed. Existing untracked `examples/demo.md` and `videos/` were preserved.

Required packaged-app checks on a Mac:

1. Launch the app directly, and by double-clicking a Markdown file when the app is closed.
2. Open another file while running, including multiple selections, spaces and Unicode paths. Confirm each saves to its own file.
3. Edit in rendered mode, switch to Source, undo/redo through keyboard and native menu, and save/reopen.
4. Open/Save As dialogs, relative images, external-change protection and read-only files.
5. Cancel, discard and save when closing or quitting, including several dirty windows. Test Dock Quit as well as Command+Q.
6. Check dark mode, Retina scaling, text input, and actual Apple Silicon and Intel hardware.

Do not label this a tested Mac release until a native build and these product-surface checks are recorded.

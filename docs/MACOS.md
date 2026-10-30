# Native macOS prototype

The current public version is [v0.1.0-alpha.1](https://github.com/Studio13-NYC/S13down/releases/tag/v0.1.0-alpha.1), with binaries built alongside Windows from the same source revision. See the release page for downloads and the [QA checklist](MAC-QA.md) for installation and testing. The original pre-alpha build record below is retained for provenance.

Status: universal Mac test build completed successfully on October 30, 2026 from commit `8f9d676281dbd6de83502a7e6deae4477e872ca3` on `codex/macos-port`. [Successful build and artifacts](https://github.com/Studio13-NYC/S13down/actions/runs/41091303124). The existing Windows review executable is unchanged. Source lives at `D:\Studio13\Lab\Code\S13down` on the development PC. Real-Mac QA will be performed by Mac testers using [the supplied checklist](MAC-QA.md).

The downloaded test kit is saved locally as `D:\Studio13\Lab\Code\S13down\builds\mac\S13down-mac-test-8f9d676.zip`. It contains the DMG, zipped app, sample documents, QA instructions, build identity and SHA-256 checksums. This is a review artifact, not a published GitHub release.

## What changes

- Same editor and Rust file handling, packaged as `S13down.app` and a drag-to-Applications `.dmg` using Tauri's native macOS host and WKWebView. No Windows emulation or Electron runtime.
- A universal build targets Apple Silicon and Intel, with macOS 13 or newer configured as the minimum. This minimum is a build target, not a claim that every OS version has been tested.
- Command shortcuts, native File/Edit/View/Window menus, system fonts, system light/dark appearance.
- Finder `.md` and `.markdown` open events are queued until the editor is ready. An untouched welcome page receives the first file; existing files and unsaved drafts stay in their windows and further files open separately. Each window owns its own save destination and relative-image folder.
- Native Quit routes windows through their unsaved-change prompts. Cancel leaves that document open; windows already approved for closure can close.
- On Unix, replacement saves preserve the existing file's permission bits.

## Build on a Mac

Install Xcode Command Line Tools (`xcode-select --install`), Node 24/npm, and Rust stable through rustup. From a checkout of `main` or a release tag:

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

`.github/workflows/build.yml` builds Windows x64 and macOS on GitHub runners, verifies both Mac architectures and the ad-hoc signature, and uploads binary artifacts. Release publication is a separate step described in [RELEASING.md](RELEASING.md). On October 30, 2026, Nick explicitly approved public builds and alpha release publication in `Studio13-NYC/S13down`.

The prototype configuration uses ad-hoc signing (`signingIdentity: "-"`), not Apple Developer ID signing or notarization. It is for review, not a frictionless public installer. A distributable release needs a Developer ID identity and notarization configured separately. See [Tauri's signing documentation](https://v2.tauri.app/distribute/sign/macos/).

Once a Mac build exists, move it to Applications. In Finder, select an `.md` file → Get Info → Open with → S13down → Change All. Repeat for `.markdown` if needed. The app registers file types but does not force itself to become the default.

## Verification and remaining checks

Windows-host checks cover document logic, Rust file saves and isolation between windows, and the editor in Chromium/Edge and WebKit. The Mac browser cases use Tauri's IPC mock to test Command keys, menu dispatch, queued launch requests, and preservation of unsaved drafts; they do not prove Cocoa or Finder behavior.

Verified locally on October 30, 2026:

- `npm run build` passed (existing large-bundle warning remains).
- `npm test`: 10 passed.
- `npm run test:ui`: 20 passed across Edge and WebKit.
- `cargo test --locked --manifest-path src-tauri\Cargo.toml --target-dir src-tauri\target\macos-port-check`: 5 passed on Windows. The separate target directory avoids stale build-cache paths from the earlier `PlainMarkdown` folder name. The Unix-only permissions test and macOS-only menu/event module were checked separately on the Mac runner.
- `git diff --check` passed. Existing untracked `examples/demo.md` and `videos/` were preserved.

On the hosted macOS 26 runner: 10 document tests, all 20 browser tests, and 6 Rust tests passed, including Unix permission preservation. The native macOS menu/event module compiled successfully. Both release architectures compiled; `lipo -verify_arch arm64 x86_64`, `plutil -lint` and `codesign --verify --deep --strict` passed. The resulting DMG is 7,877,382 bytes; the zipped app is 7,849,715 bytes. These checks do not verify interactive Finder, menu or native-dialog behavior.

An earlier macOS 14 runner could not initialize Playwright's frozen WebKit browser (`Unknown setting: PushAPIEnabled`), before any app test ran in WebKit. The runner was moved to macOS 26; no tests were skipped. See [the upstream Playwright issue](https://github.com/microsoft/playwright/issues/42964). Running this browser suite locally requires a macOS version supported by the installed Playwright version, separate from the app's minimum OS target.

Required packaged-app checks on a Mac:

1. Launch the app directly, and by double-clicking a Markdown file when the app is closed.
2. Open another file while running, including multiple selections, spaces and Unicode paths. Confirm each saves to its own file.
3. Edit in rendered mode, switch to Source, undo/redo through keyboard and native menu, and save/reopen.
4. Open/Save As dialogs, relative images, external-change protection and read-only files.
5. Cancel, discard and save when closing or quitting, including several dirty windows. Test Dock Quit as well as Command+Q.
6. Check dark mode, Retina scaling, text input, and actual Apple Silicon and Intel hardware.

Do not label this a tested Mac release until a native build and these product-surface checks are recorded.

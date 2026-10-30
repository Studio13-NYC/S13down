# Desktop alpha releases

Use one source revision for both platforms. Release binaries are GitHub release assets, not files committed to the repository.

1. Update the version in `package.json`, the root entries in `package-lock.json`, `src-tauri/Cargo.toml`, this package's entry in `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`.
2. Push the reviewed changes to `main`. `.github/workflows/build.yml` runs document, browser and Rust tests, then builds Windows x64 and universal macOS binaries. A manual workflow dispatch is also available.
3. Wait for **both** jobs to succeed. Record their source commit and run URL. Download `S13down-windows-x64` and `S13down-mac-universal` artifacts to a fresh folder under `builds/releases/<version>`.
4. Prepare release notes, the Mac QA files and SHA-256 checksums. Verify asset filenames against the README download links. Keep the Mac `.app.zip` created by `ditto` intact so executable modes and bundle metadata survive distribution.
5. Tag the exact successful build commit locally, push the tag, and publish with `gh release create <tag> <assets...> --verify-tag --prerelease --latest=false --notes-file <notes-file>`. The alpha release is explicitly a prerelease, not a stable release.
6. Verify the published release has the expected assets and checksum digests, and check the anonymous download URLs. Keep the local branch and tags synchronized with GitHub.

The workflow only builds and uploads artifacts; it does not automatically publish releases. Windows binaries currently have no Authenticode signature. Mac bundles are ad-hoc signed and are not Developer ID signed or notarized. Interactive Mac QA is still required; automated browser tests do not validate Finder, native menus, installation or native save dialogs.

Do not include unrelated untracked demo/video work, build caches, or logs in source commits. Local historical prototype binaries may be older than the current release; use the versioned release folder or GitHub downloads when sharing a build.

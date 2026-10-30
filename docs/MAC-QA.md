# S13down Mac test build

Thanks for trying the first Mac version. It is a small desktop app for opening Markdown files, reading them, and making quick edits. It is a prototype awaiting real-Mac QA.

**Target:** macOS 13 or newer, Apple Silicon or Intel. The same universal build contains both architectures.

## Install

1. Open the supplied `.dmg`, then drag **S13down** into **Applications**. The app ZIP is an alternative if mounting the DMG fails.
2. Launch S13down from Applications.
3. This test build is ad-hoc signed, without Apple Developer ID notarization. If macOS blocks the first launch because the developer cannot be verified, use **System Settings → Privacy & Security → Open Anyway** only if you trust this supplied build. Follow [Apple's instructions](https://support.apple.com/en-us/102445). Report the exact message if that option is unavailable or the app is reported damaged.
4. Copy `macos-qa.md` and `macos-second.markdown` to a writable folder before editing them.

## Quick check — about five minutes

| Check | What should happen |
|---|---|
| Open `macos-qa.md` using Finder's **Open With → S13down**, with the app closed | A readable page opens, including the table, tasks and code block. |
| Change **Tuesday** to **Friday** in the page, then click **Source** | The Markdown contains Friday. Command+Z and Command+Shift+Z undo and redo the change. |
| Command+S, close, then reopen the file | Friday is still there. The original file was updated. |
| Open `macos-second.markdown` while the first file is open | It opens separately. Saving either window does not change the other file. |
| Make an unsaved edit, then open another file from Finder | The edited window stays open with its draft intact. |
| Make an unsaved edit and close the window; choose **Cancel** | The edit remains. Try **Save** and **Discard changes** on subsequent attempts too. |
| Repeat with two dirty windows and **Command+Q** / **Dock → Quit** | Each unsaved document gets a prompt. Cancel preserves that document. Other approved windows may close. |
| Use the File/Edit/View menus and Open/Save As dialogs | Actions affect the focused document. Cut/copy/paste and find work normally. |

Optional default app: select an `.md` file in Finder → **Get Info → Open with → S13down → Change All**. Double-click another `.md` file to check. This is a system preference; change it only if you want S13down as your default. Repeat for `.markdown` separately.

If you have time, also check dark mode, Retina sizing, filenames containing spaces or non-English characters, and a relative image in the same folder. To check conflict protection, edit a saved file in another app before saving your S13down changes: S13down should refuse to overwrite the external edit and offer guidance to save a copy.

## Send back

```text
Build/commit:
Mac model:
Chip (Apple Silicon or Intel):
macOS version:
Install / first launch: PASS or FAIL
Open / edit / Source / save / reopen: PASS or FAIL
Multiple files: PASS or FAIL
Unsaved changes / Quit: PASS or FAIL
Menus / shortcuts / dialogs: PASS or FAIL
Issue: steps, expected result, actual result, exact error text
Screenshot or short recording if useful:
```

Please use copies of documents during this first test. Automated tests and bundle checks do not replace these native Mac checks.

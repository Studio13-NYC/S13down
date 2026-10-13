# A simple Windows Markdown editor

Original design direction, October 13, 2026. This independent implementation plan was informed by the [Typora inspection](TYPORA-INSPECTION.md). A Windows prototype now exists; see [README](../README.md) for current behavior and limits. Requirements below include longer-term acceptance goals and are not all claims about the prototype.

## Product contract

Double-click a `.md` file. It opens as a clean, formatted document. Click anywhere in the text and edit immediately. A clearly labeled **Rendered / Source** switch changes the same document to editable Markdown source and back.

Newly opened documents start in Rendered mode. The app uses ordinary files, works offline, and has a standard Windows installer. A single document per window keeps the first version easy to understand.

The visible interface should contain the document title, a subtle unsaved indicator, the mode switch, and a small menu with Open, Save, Save As, Find and Zoom. Standard Undo/Redo and formatting shortcuts work. No setup wizard is required to begin editing.

## Recommended implementation

| Component | Choice | Responsibility |
|---|---|---|
| Windows application | Tauri 2 | Window, file dialogs, file access, command-line file opening, `.md` handler registration and NSIS `.exe` installer. |
| UI | TypeScript and Vite | A small application shell with no additional UI framework initially. |
| Rendered editing | Milkdown Crepe | Markdown-oriented structured editing, with unnecessary toolbars and block controls disabled. |
| Whole-document source editing | CodeMirror 6 | Editable Markdown source with wrapping and syntax highlighting. |
| Document session | Small application-owned controller | Current path, saved file identity, source text, active mode, dirty state, mode-transition snapshots and recovery. |

Milkdown's documented conversion path is Markdown → Remark syntax tree → ProseMirror document, with serialization back to Markdown. Crepe supplies ready-made editing features. Its built-in CodeMirror feature is for fenced code blocks; the whole-document source view remains a separate integration. [Milkdown architecture](https://milkdown.dev/docs/guide/architecture-overview), [Crepe guide](https://github.com/Milkdown/website/blob/main/docs/guide/using-crepe.md), [CodeMirror Markdown package](https://github.com/codemirror/lang-markdown).

Tauri documents NSIS `-setup.exe` output and file-association configuration. It uses the Windows WebView2 runtime; installer behavior must account for a machine where the runtime is missing. No package-size or memory target should be promised until the actual build is measured. [Windows installer](https://v2.tauri.app/distribute/windows-installer/), [file associations](https://v2.tauri.app/reference/config/#fileassociation).

Registering the app as a Markdown handler does not make it the default. Windows requires the user to select the default through system UI. The installer should make the choice easy to find. [Microsoft default-app guidance](https://learn.microsoft.com/en-us/windows/apps/develop/windows-integration/default-apps-platform).

Tiptap is a credible alternative, but its current native Markdown extension is documented as Beta with conversion limitations. Milkdown is the recommended first prototype for this specifically Markdown-focused product. [Tiptap Markdown status](https://tiptap.dev/docs/editor/markdown).

## Document preservation rules

These are requirements for the new implementation, not guarantees supplied by the libraries.

1. **Opening or switching modes without edits must not change the file.** Retain the original bytes, encoding/BOM, line-ending style, final-newline state and saved hash. Do not serialize a rendered document just because a mode button was pressed.
2. **Only the active editor accepts edits.** Commit pending input, especially IME composition, before switching. Convert at the boundary and tag the resulting revision, so a stale inactive editor cannot overwrite current text.
3. **Preserve source text after source edits.** Entering Rendered mode may parse that text, but returning to Source without a rendered edit must restore the same text. Re-serialize only after an actual rendered edit.
4. **Rendered editing must preserve meaning and unsupported content.** CommonMark plus GFM tables and task lists are the first supported set. Front matter, comments, raw HTML and unfamiliar directives must be preserved as opaque content or opened safely in source mode if lossless representation cannot be established. Never silently drop them. Do not claim arbitrary Markdown dialect compatibility.
5. **Distinguish content preservation from source-style preservation.** A structured editor can normalize whitespace, list markers or link syntax after a rendered edit. Test this with Nick's files. Exact source spelling after every rendered edit is a separate requirement and could change the engine choice.
6. **Define cross-mode undo.** Use each editor's normal undo within a mode. Treat an edited source session as one document transaction when returning to Rendered, retain both boundary snapshots, and route cross-boundary Undo/Redo explicitly. An unchanged switch adds no undo transaction. Prototype this before committing to the approach.
7. **Keep the user's place.** Store a source/block anchor and relative viewport position on transition. Cursor mapping must handle repeated text and nested structures; arbitrary selection restoration is an acceptance test, not an assumed capability.
8. **Save conservatively.** Verify whether the on-disk file changed, write through a documented safe replacement path, surface failures, and clear the unsaved state only after confirmed success. Keep recovery separate from silently overwriting the user's file.

Markdown parse/serialize APIs do not establish byte-perfect preservation. For example, Milkdown documents that retained empty paragraphs serialize as `<br />`. This is why preservation tests come first. [Milkdown CommonMark behavior](https://milkdown.dev/docs/api/preset-commonmark).

## Scope of the first version

Include paragraphs, headings, emphasis, links, images with paths relative to the document, block quotes, ordered/unordered lists, task lists, fenced code and tables. Keep Markdown as the file format. Include Save/Save As, unsaved-close prompts, draft recovery, external-change conflict handling, keyboard navigation and Windows scaling.

Defer folder libraries, backlinks, tabs, plugins, cloud synchronization, AI features, diagram/math rendering, publishing, broad export formats and theme marketplaces. A basic light/dark theme and readable typography are enough initially.

## Build sequence and acceptance gates

| Stage | Concrete deliverable | Gate before continuing |
|---|---|---|
| 1. Editing experiment | One real Markdown file in a rendered editor with an editable source switch. | No-edit round trips preserve bytes; normal rendered/source edits preserve supported content; unsupported constructs remain intact. |
| 2. Windows prototype | Packaged `.exe` with Open, Save, Save As and `.md` registration. | Choose it in Windows defaults; double-click files with spaces and Unicode; repeat while another document is open. |
| 3. Reliable document behavior | Cross-mode history, position restoration, conflict handling, recovery and save errors. | The scenarios below pass in the packaged app, including forced write failures. |
| 4. Visual polish | Restrained menus, typography, mode switch, light/dark appearance and accessible focus behavior. | Test actual Windows scaling, keyboard use, IME entry and representative large files. |

Use copies of Nick's actual `.md` documents as the core fixture set, supplemented by small files covering edge cases. Do not use existing work as disposable test data.

Required product-surface scenarios:

- Open → Rendered → Source → Rendered → Save with no edit: compare original and saved bytes.
- Rendered edit → Source edit → Rendered → Undo → Redo → Save → reopen: verify content and history at every step.
- Nested lists, tables, task boxes, relative images, code fences, reference links, front matter, comments and unfamiliar syntax: check rendered meaning and saved source.
- LF/CRLF, BOM/no BOM and trailing newline variants: verify the declared preservation policy.
- Edit externally while the app has unsaved changes: preserve both versions and require an explicit conflict choice.
- Read-only destination, denied write, close with unsaved content and interrupted session: demonstrate useful errors and recoverability.
- Paths with spaces/Unicode, a second Explorer launch, high-DPI scaling, keyboard-only navigation, IME composition and large documents: test the installed Windows build.

## Decision to make after the prototype

The recommended next step is a **small packaged prototype**, not a complete Typora clone. The first decision should be based on whether the rendered editor feels right with Nick's documents and whether the preservation gates pass. If exact source formatting after rendered edits is essential and cannot be met, reassess the document model before adding features.

This plan uses the observed product behavior and independently selected libraries. Typora's extracted code remains analysis evidence and is not proposed as application code.

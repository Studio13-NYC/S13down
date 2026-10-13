# Prototype implementation

User-approved direction: a simple Windows Markdown application, rendered editing by default, editable source behind one switch. Source, tests and builds live in this project. Global Rust was explicitly requested and installed through rustup.

## Work ledger

Ruling: this is a fresh isolated repository on codex/prototype, so another worktree would add no isolation.
Ruling: the inherited design is a product roadmap, not a generated stepwise plan. Track three implementation tasks here instead of generating artificial task briefs.
Pre-flight: the frontend retains exact source text; the Rust backend retains the original bytes and checks disk identity before replacement. Save acknowledgement must refer to the submitted text, not newer edits.

1. Document preservation and rendered/source editor. Implemented; 10 unit and 7 browser tests pass.
2. Native open/save, recovery, conflict protection and installer. Implemented; 4 Rust tests pass; NSIS build succeeds.
3. Product-surface verification, independent review and handoff. Complete for prototype scope. See VERIFICATION.md; broader release qualification remains explicitly deferred.

Ruling: use conservative source fallback for front matter, HTML, footnotes, directives and math. Rich edits can normalize supported Markdown formatting; unchanged view switches must not.
Ruling: application-owned grouped document history provides undo across modes. Cursor preservation initially restores approximate viewport rather than claiming exact cross-format selections.

## Review and verification

Fresh-context review found three issues: temporary image URLs from the editor's upload default, focus attempted while the page was inert, and CodeMirror losing CRLF on source edits. All were reproduced with failing browser tests, fixed in one pass, and the full browser suite passes.

Image uploads now embed durable data URLs (2 MB cap); local relative image links are also supported. Source editing sets CodeMirror's line separator and uses sliceDoc. Editor/search focus is restored after clearing inert. Approximate per-mode cursor offsets are retained.

Ruling: broad Windows/IME/accessibility/performance qualification remains a follow-up to the user's requested direction-review prototype; report these limits instead of claiming production readiness.
Ruling: the initial prototype was kept locally on codex/prototype for user review. At the user's subsequent request, the complete project directory moved to `D:\Studio13\Lab\Code\S13down`, the branch was renamed to `main`, and its source/history were pushed to the private `Studio13-NYC/S13down` repository. Generated dependencies, caches and local build artifacts remain outside Git.

No Typora source was copied into the application.

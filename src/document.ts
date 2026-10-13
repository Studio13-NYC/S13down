export class DocumentSession {
  text: string;
  private saved: string;
  private past: string[] = [];
  private future: string[] = [];
  private grouped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private eol: string;
  private finalNewline: boolean;
  constructor(text: string) {
    this.text = this.saved = text;
    this.eol = text.includes('\r\n') ? '\r\n' : '\n';
    this.finalNewline = text.endsWith('\n');
  }
  get dirty() { return this.text !== this.saved; }
  edit(text: string, fromRendered = false) {
    if (fromRendered) {
      text = text.replace(/\r\n/g, '\n');
      if (!this.finalNewline) text = text.replace(/\n$/, '');
      text = text.replace(/\n/g, this.eol);
    }
    if (text === this.text) return;
    if (!this.grouped) this.past.push(this.text);
    if (this.past.length > 150) this.past.shift();
    this.text = text;
    this.future = [];
    this.grouped = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.checkpoint(), 600);
  }
  checkpoint() { this.grouped = false; clearTimeout(this.timer); }
  undo() {
    this.checkpoint();
    const text = this.past.pop();
    if (text === undefined) return false;
    this.future.push(this.text); this.text = text; return true;
  }
  redo() {
    this.checkpoint();
    const text = this.future.pop();
    if (text === undefined) return false;
    this.past.push(this.text); this.text = text; return true;
  }
  markSaved(text: string) { this.saved = text; }
}

export function renderedRestriction(markdown: string): string | null {
  // Conservative fallback: never feed constructs we cannot preserve to a rich editor.
  const text = markdown.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, '');
  if (/^(---|\+\+\+)\r?\n/.test(text)) return 'This document has front matter.';
  if (/<\/?[a-zA-Z!][^>]*>/.test(text)) return 'This document contains HTML or comments.';
  if (/^\s*\[\^.+?\]:/m.test(text)) return 'This document contains footnotes.';
  if (/^\s*(:::|\$\$)/m.test(text) || /(^|[^\\])\$[^\n$]+\$/.test(text)) return 'This document uses extended Markdown.';
  return null;
}

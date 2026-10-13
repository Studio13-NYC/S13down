import { describe, it, expect } from 'vitest';
import { DocumentSession, renderedRestriction } from '../src/document';

describe('document preservation', () => {
  it('retains source spelling, CRLF and final newline until a real edit', () => {
    const original = '# Title\r\n\r\n* one\r\n* two';
    const doc = new DocumentSession(original);
    expect(doc.text).toBe(original);
    expect(doc.dirty).toBe(false);
    doc.edit('# Title\n\n* one\n* two\n\nNew\n', true);
    expect(doc.text).toBe('# Title\r\n\r\n* one\r\n* two\r\n\r\nNew');
    expect(doc.dirty).toBe(true);
    doc.undo();
    expect(doc.text).toBe(original);
    expect(doc.dirty).toBe(false);
  });
  it('keeps source edits verbatim and undoes across editing modes', () => {
    const doc = new DocumentSession('Hello\n');
    doc.edit('##  Hello\n\n\n', false);
    doc.checkpoint();
    doc.edit('## Hello world\n', true);
    doc.undo();
    expect(doc.text).toBe('##  Hello\n\n\n');
    doc.undo();
    expect(doc.text).toBe('Hello\n');
    doc.redo();
    expect(doc.text).toBe('##  Hello\n\n\n');
  });
  it('does not clear newer edits when an older snapshot finishes saving', () => {
    const doc = new DocumentSession('old');
    doc.edit('saved');
    doc.edit('newer');
    doc.markSaved('saved');
    expect(doc.dirty).toBe(true);
  });
});

describe('source safety', () => {
  it.each(['---\ntitle: Private\n---\nText', '<!-- keep this -->\nText', '<div>custom</div>', '$$\nx^2\n$$', ':::note\nText\n:::', '[^a]: footnote'])('keeps unsupported content in source: %s', text => {
    expect(renderedRestriction(text)).toBeTruthy();
  });
  it('allows normal GFM and HTML inside a fenced example', () => {
    expect(renderedRestriction('# Hi\n\n- [x] done\n\n```html\n<div>example</div>\n```')).toBeNull();
  });
});

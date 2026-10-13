import {test,expect} from '@playwright/test';

test('renders an editable document by default and preserves source through unchanged switches', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.ProseMirror')).toBeVisible();
  await page.getByRole('button',{name:'Source',exact:true}).click();
  const source = page.locator('#code .cm-content');
  await source.fill('# A heading\n\n* a list\n* another\n\nNo final newline');
  await page.getByRole('button',{name:'Rendered',exact:true}).click();
  await expect(page.locator('.ProseMirror h1')).toHaveText('A heading');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(source).toHaveText('# A heading* a list* anotherNo final newline');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const parts: Buffer[] = []; for await (const part of stream!) parts.push(part);
  expect(Buffer.concat(parts).toString()).toBe('# A heading\n\n* a list\n* another\n\nNo final newline');
});

test('rich edit reaches source immediately, and undo works across modes', async ({page}) => {
  await page.goto('/');
  await page.locator('.ProseMirror').fill('A quiet editor');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(page.locator('#code .cm-content')).toContainText('A quiet editor');
  await page.locator('#code .cm-content').fill('Changed in source');
  await page.getByRole('button',{name:'Rendered',exact:true}).click();
  await expect(page.locator('.ProseMirror')).toContainText('Changed in source');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.ProseMirror')).toContainText('A quiet editor');
  await expect(page.locator('.ProseMirror')).toBeFocused();
});

test('unsupported Markdown remains intact and shows a clear source fallback', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.locator('#code .cm-content').fill('---\ntitle: Keep me\n---\n\n<!-- private -->\nHello');
  await page.getByRole('button',{name:'Rendered',exact:true}).click();
  await expect(page.locator('#code .cm-content')).toContainText('Keep me');
  await expect(page.locator('#notice')).toContainText('front matter');
});

test('canceling a new document preserves edits and a recovery copy survives reload', async ({page}) => {
  await page.goto('/');
  await page.locator('.ProseMirror').fill('Keep this draft');
  await page.keyboard.press('Control+n');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('.ProseMirror')).toHaveText('Keep this draft');
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('draft');
  await page.getByRole('button',{name:'Recover copy',exact:true}).click();
  await expect(page.locator('.ProseMirror')).toHaveText('Keep this draft');
});

test('editing a paragraph preserves GFM tables, checked tasks, fenced code and Unicode', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.locator('#code .cm-content').fill('# 日本語\n\nA paragraph.\n\n- [x] Finished\n- [ ] Next\n\n| Name | Value |\n| --- | --- |\n| alpha | 42 |\n\n```js\nconst answer = 42;\n```\n');
  await page.getByRole('button',{name:'Rendered',exact:true}).click();
  await expect(page.getByRole('table')).toContainText('alpha');
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' More text.');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(page.locator('#code .cm-content')).toContainText('日本語');
  await expect(page.locator('#code .cm-content')).toContainText('[x] Finished');
  await expect(page.locator('#code .cm-content')).toContainText('alpha');
  await expect(page.locator('#code .cm-content')).toContainText('const answer = 42;');
  await expect(page.locator('#code .cm-content')).toContainText('More text.');
});

test('source edits keep Windows line endings', async ({page}) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({name:'Windows.md',mimeType:'text/markdown',buffer:Buffer.from('# Heading\r\n\r\nBody\r\n')});
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('X');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  const stream=await (await downloadPromise).createReadStream();
  const parts:Buffer[]=[];for await(const part of stream!)parts.push(part);
  expect(Buffer.concat(parts).toString()).toBe('# Heading\r\n\r\nBody\r\nX');
});

test('image uploads produce durable Markdown and find receives keyboard focus', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await page.locator('#code .cm-content').fill('![image]()');
  await page.getByRole('button',{name:'Rendered',exact:true}).click();
  const chooser=page.waitForEvent('filechooser');
  await page.getByText('Upload file',{exact:true}).click();
  await (await chooser).setFiles({name:'pixel.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await page.getByRole('button',{name:'Source',exact:true}).click();
  await expect(page.locator('#code .cm-content')).toContainText('data:image/png;base64,');
  await page.keyboard.press('Control+f');
  await expect(page.getByPlaceholder('Find')).toBeFocused();
});

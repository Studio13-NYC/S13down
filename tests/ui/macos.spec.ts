import {test,expect,type Page} from '@playwright/test';

// Exercise the real editor with Tauri's supported IPC mock. Native Finder and
// Cocoa menus still require the packaged-app smoke check on a Mac.
async function nativePage(page:Page, pending:string[] = []) {
  await page.route('**/src/main.ts',async route=> {
    const response=await route.fetch();
    await route.fulfill({response,body:`
      import {mockIPC,mockWindows} from '/node_modules/@tauri-apps/api/mocks.js';
      import {emit} from '/node_modules/@tauri-apps/api/event.js';
      Object.defineProperty(navigator,'platform',{value:'MacIntel'});
      window.isTauri=true;
      window.nativeTest={pending:${JSON.stringify(pending)},spawned:[],saved:[],emit};
      mockWindows('main');
      mockIPC(async (cmd,args)=> {
        const data=window.nativeTest;
        if(cmd==='next_open_request')return data.pending.shift()??null;
        if(cmd==='open_document')return args.requestedPath?{path:args.requestedPath,text:'# Finder document\\n\\nRead me.'}:null;
        if(cmd==='open_document_window'){data.spawned.push(args.path);return;}
        if(cmd==='save_document'){data.saved.push(args.text);return '/tmp/saved.md';}
      },{shouldMockEvents:true});
      ${await response.text()}`});
  });
  await page.goto('/');
  await expect(page.locator('.ProseMirror')).toBeVisible();
}

test('Mac welcome and Command shortcuts edit, switch, undo and save',async({page})=> {
  await nativePage(page);
  await expect(page.locator('.ProseMirror')).toContainText('Cmd+O');
  await expect(page.getByRole('button',{name:'Open',exact:true})).toHaveAttribute('title','Open (Cmd+O)');
  await page.locator('.ProseMirror').fill('Mac draft');
  await page.keyboard.press('Meta+/');
  await expect(page.locator('#code .cm-content')).toContainText('Mac draft');
  await page.locator('#code .cm-content').fill('Changed source');
  await page.keyboard.press('Meta+z');
  await expect(page.locator('#code .cm-content')).toContainText('Mac draft');
  await page.keyboard.press('Meta+s');
  await expect(page.locator('#file-state')).toHaveText('Saved on your computer');
});

test('Finder launch request reuses welcome; additional files open in separate windows',async({page})=> {
  await nativePage(page,['/tmp/日本語 notes.md','/tmp/second.md']);
  await expect(page.locator('#filename')).toHaveText('日本語 notes.md');
  await expect(page.locator('.ProseMirror h1')).toHaveText('Finder document');
  await expect.poll(()=>page.evaluate(()=> (window as any).nativeTest.spawned)).toEqual(['/tmp/second.md']);
});

test('Finder requests leave an unsaved draft intact; native menus use document history',async({page})=> {
  await nativePage(page);
  await page.locator('.ProseMirror').fill('Keep this draft');
  await page.evaluate(async()=> {
    const state=(window as any).nativeTest;
    state.pending.push('/tmp/another.md');
    await state.emit('files-opened',null);
  });
  await expect.poll(()=>page.evaluate(()=> (window as any).nativeTest.spawned)).toEqual(['/tmp/another.md']);
  await expect(page.locator('.ProseMirror')).toHaveText('Keep this draft');
  await page.evaluate(()=> (window as any).nativeTest.emit('menu-action','mode'));
  await expect(page.locator('#code .cm-content')).toContainText('Keep this draft');
  await page.locator('#code .cm-content').fill('Changed in source');
  await page.evaluate(()=> (window as any).nativeTest.emit('menu-action','undo'));
  await expect(page.locator('#code .cm-content')).toContainText('Keep this draft');
  await page.evaluate(()=> (window as any).nativeTest.emit('menu-action','new'));
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('#code .cm-content')).toContainText('Keep this draft');
});

import {Crepe} from '@milkdown/crepe';
import {editorViewCtx} from '@milkdown/kit/core';
import {$prose, replaceAll} from '@milkdown/kit/utils';
import {Plugin, TextSelection} from '@milkdown/kit/prose/state';
import {EditorState} from '@codemirror/state';
import {EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection} from '@codemirror/view';
import {defaultKeymap, indentWithTab} from '@codemirror/commands';
import {markdown} from '@codemirror/lang-markdown';
import {search, searchKeymap, openSearchPanel} from '@codemirror/search';
import {invoke, isTauri} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {DocumentSession, renderedRestriction} from './document';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './style.css';

const native = isTauri();
const welcome = '# A little room to think.\n\nA plain file. A clear page. Just start writing.\n\n## Make yourself at home\n\nClick any text to edit it. Use **Ctrl+B** for bold and **Ctrl+I** for italic. Markdown shortcuts work as you type.\n\n- Open a document with **Ctrl+O**\n- Save your work with **Ctrl+S**\n- Switch to Markdown source with **Ctrl+/**\n\n> Everything stays in ordinary Markdown files, on your computer.\n\nTry the **Source** switch above to see the text behind this page.\n';
document.querySelector('#app')!.innerHTML = `
  <header><div class="identity"><span class="app-mark" aria-hidden="true">M</span><div><div id="filename">Untitled.md</div><div id="file-state">PlainMarkdown</div></div></div>
  <div class="modes" role="group" aria-label="Editing mode"><button id="rendered" aria-pressed="true">Rendered</button><button id="source" aria-pressed="false">Source</button></div>
  <div class="actions"><button id="open" title="Open (Ctrl+O)">Open</button><button id="save" title="Save (Ctrl+S)">Save</button><button id="more" title="More options" aria-label="More options" aria-expanded="false">···</button></div></header>
  <div id="menu" hidden><button data-action="new">New document <kbd>Ctrl+N</kbd></button><button data-action="saveas">Save as… <kbd>Ctrl+Shift+S</kbd></button><button data-action="find">Find in source <kbd>Ctrl+F</kbd></button><hr><button data-action="zoomin">Larger text <kbd>Ctrl++</kbd></button><button data-action="zoomout">Smaller text <kbd>Ctrl+−</kbd></button><button data-action="zoomreset">Reset text size <kbd>Ctrl+0</kbd></button></div>
  <div id="notice" role="status" hidden></div><main id="page"><div id="rich"></div><div id="code" hidden></div></main>
  <footer><span id="status">Ready</span><span id="word-count"></span></footer>
  <dialog id="question"><form method="dialog"><h2 id="question-title"></h2><p id="question-body"></p><div id="question-buttons"></div></form></dialog>
  <input type="file" id="file-input" accept=".md,.markdown,.txt" hidden>`;

const el = <T extends HTMLElement = HTMLElement>(id:string) => document.getElementById(id) as T;
let doc = new DocumentSession(welcome);
let path = '';
let mode: 'rendered'|'source' = 'rendered';
let rich: Crepe;
let code: EditorView;
let loading = true;
let richDirty = false;
let busy = false;
let pendingFocus = false;
let pendingSearch = false;
const positions = {rendered:1,source:0};
let composing = false;
let zoom = 1;
let timer: ReturnType<typeof setTimeout>;
let recoveryKey = `plainmarkdown-draft-${crypto.randomUUID()}`;
let recoveryFailed = false;

function message(text:string, error=false) {
  el('notice').textContent = text; el('notice').hidden = !text;
  el('notice').classList.toggle('error',error);
}
function update() {
  const name = path.split(/[\\/]/).pop() || 'Untitled.md';
  el('filename').textContent = `${doc.dirty ? '• ' : ''}${name}`;
  el('filename').title = path || 'New document';
  el('file-state').textContent = doc.dirty ? 'Unsaved changes' : path ? 'Saved on your computer' : 'PlainMarkdown';
  el('word-count').textContent = `${doc.text.trim() ? doc.text.trim().split(/\s+/).length : 0} words`;
  el('rendered').setAttribute('aria-pressed',String(mode === 'rendered'));
  el('source').setAttribute('aria-pressed',String(mode === 'source'));
  if (native) void getCurrentWindow().setTitle(`${doc.dirty ? '• ' : ''}${name} — PlainMarkdown`).catch(console.error);
}
function recoverable() {
  try {
    if (doc.dirty) localStorage.setItem(recoveryKey,JSON.stringify({text:doc.text,path,time:Date.now()}));
    else localStorage.removeItem(recoveryKey);
    recoveryFailed = false;
  } catch { if (!recoveryFailed) message('Draft recovery storage is full. Please save your document.',true); recoveryFailed = true; }
}
function flush() {
  clearTimeout(timer);
  if (!loading && mode === 'rendered' && richDirty) { doc.edit(rich.getMarkdown(),true); richDirty = false; }
  update(); recoverable();
}
function changed() { clearTimeout(timer); timer = setTimeout(flush,120); }
async function ask(title:string, body:string, options:{label:string,value:string}[]):Promise<string> {
  const dialog = el<HTMLDialogElement>('question');
  el('question-title').textContent=title; el('question-body').textContent=body;
  const buttons=el('question-buttons'); buttons.replaceChildren();
  for (const option of options) { const button=document.createElement('button'); button.textContent=option.label; button.value=option.value; buttons.append(button); }
  dialog.returnValue='cancel'; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));
}
async function canLeave() {
  flush();
  if (!doc.dirty) return true;
  const result = await ask('Save your changes?', 'Your document has changes that haven’t been saved.',[{label:'Cancel',value:'cancel'},{label:'Discard changes',value:'discard'},{label:'Save',value:'save'}]);
  if (result === 'save') return save(false);
  return result === 'discard';
}

async function imageURL(url:string) {
  if (/^https:\/\//i.test(url) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)) return url;
  if (!native || /^[a-z]+:/i.test(url)) return '';
  try { return await invoke<string>('resolve_image',{url:decodeURIComponent(url)}); } catch { return ''; }
}
async function uploadImage(file:File):Promise<string> {
  if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type) || file.size>2*1024*1024) {
    message('Choose a PNG, JPEG, GIF or WebP image under 2 MB. Larger images can be linked from Source.',true);
    return '';
  }
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read the image.'));reader.readAsDataURL(file);});
}

async function createEditor() {
  rich = new Crepe({root:el('rich'),defaultValue:doc.text,features:{[Crepe.Feature.Toolbar]:false,[Crepe.Feature.BlockEdit]:false,[Crepe.Feature.Latex]:false,[Crepe.Feature.AI]:false,[Crepe.Feature.TopBar]:false},featureConfigs:{[Crepe.Feature.ImageBlock]:{proxyDomURL:imageURL,onUpload:uploadImage},[Crepe.Feature.Placeholder]:{text:'Start writing…'}}});
  rich.editor.use($prose(() => new Plugin({state:{init:()=>null,apply(tr) {
    if (tr.docChanged && !loading && mode === 'rendered') { richDirty=true; changed(); }
    return null;
  }}})));
  await rich.create();
  code = new EditorView({parent:el('code'),state:sourceState(doc.text)});
  loading=false; update();
}
function sourceState(text:string) {
  return EditorState.create({doc:text,extensions:[EditorState.lineSeparator.of(text.includes('\r\n')?'\r\n':'\n'),markdown(),lineNumbers(),highlightActiveLine(),drawSelection(),search(),EditorView.lineWrapping,keymap.of([...defaultKeymap,...searchKeymap,indentWithTab]),EditorView.contentAttributes.of({'aria-label':'Markdown source'}),EditorView.updateListener.of(change=> {
    if(change.docChanged && !loading && mode==='source') {doc.edit(change.state.sliceDoc());update();recoverable();}
  })]});
}
async function showMode(next:'rendered'|'source', reload=false) {
  if (composing) return;
  flush(); doc.checkpoint();
  const restriction=next==='rendered' ? renderedRestriction(doc.text) : null;
  if (restriction) {next='source'; message(`${restriction} Edit it in Source to preserve its contents.`);}
  else message('');
  if(mode===next && !reload) {update(); return;}
  if(mode==='source') positions.source=code.state.selection.main.head;
  else rich.editor.action(ctx=>{positions.rendered=ctx.get(editorViewCtx).state.selection.head;});
  const scroll=el('page').scrollTop / Math.max(1,el('page').scrollHeight-el('page').clientHeight);
  loading=true;
  try {
    if(next==='rendered') {
      rich.editor.action(replaceAll(doc.text,true));
      rich.editor.action(ctx=>{const view=ctx.get(editorViewCtx);view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(Math.min(positions.rendered,view.state.doc.content.size)))));});
    } else {
      code.setState(sourceState(doc.text));
      code.dispatch({selection:{anchor:Math.min(positions.source,code.state.doc.length)}});
    }
    mode=next; richDirty=false;
    el('rich').hidden=mode!=='rendered'; el('code').hidden=mode!=='source';
  } finally {loading=false;}
  update();
  if(busy) pendingFocus=true; else focusEditor();
  requestAnimationFrame(()=>{el('page').scrollTop=scroll*Math.max(0,el('page').scrollHeight-el('page').clientHeight);});
}
function focusEditor() {if(mode==='source') code.focus(); else rich.editor.action(ctx=>ctx.get(editorViewCtx).focus());}
async function load(text:string,newPath:string) {
  flush(); doc.checkpoint(); localStorage.removeItem(recoveryKey);
  recoveryKey=`plainmarkdown-draft-${crypto.randomUUID()}`;
  loading=true; doc=new DocumentSession(text); path=newPath; richDirty=false; loading=false;
  await showMode('rendered',true); el('page').scrollTop=0; el('status').textContent='Ready';
}
async function open(initial=false) {
  if(!initial && !(await canLeave())) return;
  if(native) {
    const result = await invoke<{text:string,path:string}|null>('open_document',{initial});
    if(result) await load(result.text,result.path);
  } else if(!initial) el<HTMLInputElement>('file-input').click();
}
async function save(saveAs:boolean):Promise<boolean> {
  flush(); doc.checkpoint(); const snapshot=doc.text;
  if(native) {
    const result=await invoke<string|null>('save_document',{text:snapshot,saveAs});
    if(!result) return false;
    path=result;
  } else {
    const url=URL.createObjectURL(new Blob([snapshot],{type:'text/markdown;charset=utf-8'}));
    const anchor=document.createElement('a'); anchor.href=url; anchor.download=path.split(/[\\/]/).pop()||'Untitled.md'; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  doc.markSaved(snapshot); recoverable(); update(); message(''); el('status').textContent='Saved'; return true;
}
async function newDocument() {if(await canLeave()) {if(native) await invoke('new_document'); await load('','');}}
async function run(action:()=>Promise<unknown>) {
  if(busy || composing || el<HTMLDialogElement>('question').open) return;
  busy=true;
  el('page').inert=true;
  try {await action();} catch(error) {message(String(error),true);el('status').textContent='Could not complete action';} finally {busy=false;el('page').inert=false;if(pendingSearch){pendingSearch=false;pendingFocus=false;openSearchPanel(code);}else if(pendingFocus){pendingFocus=false;focusEditor();}}
}
async function undo(redo=false) {
  flush(); if(redo ? doc.redo() : doc.undo()) {await showMode(mode,true); recoverable();}
}
function setZoom(value:number) {zoom=Math.min(1.6,Math.max(0.75,value));document.documentElement.style.setProperty('--zoom',String(zoom));}
async function find() {await showMode('source');pendingSearch=true;}

el('rendered').onclick=()=>void run(()=>showMode('rendered'));
el('source').onclick=()=>void run(()=>showMode('source'));
el('open').onclick=()=>void run(()=>open());
el('save').onclick=()=>void run(()=>save(false));
el('more').onclick=()=>{el('menu').hidden=!el('menu').hidden;el('more').setAttribute('aria-expanded',String(!el('menu').hidden));};
document.addEventListener('click',event=>{if(!(event.target as HTMLElement).closest('#menu,#more')) {el('menu').hidden=true;el('more').setAttribute('aria-expanded','false');}});
el('menu').onclick=event=> {
  const action=(event.target as HTMLElement).closest('button')?.dataset.action; if(!action)return;
  el('menu').hidden=true;el('more').setAttribute('aria-expanded','false');
  const actions:Record<string,()=>Promise<unknown>>={new:newDocument,saveas:()=>save(true),find,zoomin:async()=>setZoom(zoom+0.1),zoomout:async()=>setZoom(zoom-0.1),zoomreset:async()=>setZoom(1)};
  void run(actions[action]);
};
el('file-input').addEventListener('change',()=>void run(async()=> {
  const input=el<HTMLInputElement>('file-input'); const file=input.files?.[0];
  if(file) await load(await file.text(),file.name); input.value='';
}));
document.addEventListener('compositionstart',()=>{composing=true;});
document.addEventListener('compositionend',()=>{composing=false;changed();});
document.addEventListener('keydown',event=> {
  if(!(event.ctrlKey||event.metaKey)||event.isComposing||el<HTMLDialogElement>('question').open)return;
  const key=event.key.toLowerCase();
  const action=key==='s'?()=>save(event.shiftKey):key==='o'?()=>open():key==='n'?newDocument:key==='/'?()=>showMode(mode==='rendered'?'source':'rendered'):key==='z'?()=>undo(event.shiftKey):key==='y'?()=>undo(true):key==='f'?find:key==='='||key==='+'?async()=>setZoom(zoom+0.1):key==='-'?async()=>setZoom(zoom-0.1):key==='0'?async()=>setZoom(1):null;
  if(action) {event.preventDefault();event.stopImmediatePropagation();void run(action);}
},true);
// Document links are editable; they must not navigate the application away.
el('rich').addEventListener('click',event=>{if((event.target as HTMLElement).closest('a'))event.preventDefault();});
window.addEventListener('beforeunload',()=>flush());

async function start() {
  await createEditor();
  if(native) await getCurrentWindow().onCloseRequested(async event=> {
    event.preventDefault();
    await run(async()=>{if(await canLeave()) {localStorage.removeItem(recoveryKey);await getCurrentWindow().destroy();}});
  });
  // Recovery is always an untitled copy: never silently apply it to an existing file.
  const drafts=Object.keys(localStorage).filter(key=>key.startsWith('plainmarkdown-draft-')).flatMap(key=> {
    try {const value=JSON.parse(localStorage.getItem(key)!);return typeof value.text==='string' ? [{...value,key}] : [];} catch{return [];}
  }).sort((a,b)=>b.time-a.time);
  await open(true);
  if(drafts.length && !path) {
    const draft=drafts[0];
    const result=await ask('Recover a draft?',`An unsaved draft is available${draft.path ? ` from ${draft.path}` : ''}. Recover it as a new document.`,[{label:'Later',value:'later'},{label:'Recover copy',value:'recover'}]);
    if(result==='recover') {
      await load('','');doc.edit(draft.text);await showMode('rendered',true);recoverable();localStorage.removeItem(draft.key);
    }
  }
}
void start().catch(error=>message(String(error),true));

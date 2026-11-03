import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {pageOperation} from '../page.js';

function page(html, url) {
  const dom = new JSDOM(html, {url, runScripts:'outside-only', pretendToBeVisual:true});
  dom.window.HTMLElement.prototype.getClientRects = function() { return this.hidden ? [] : [{width:100,height:20}]; };
  return {dom, run:(...args) => dom.window.eval(`(${pageOperation.toString()})`)(...args)};
}
test('batch arm supports observed Info route, rejects unsupported scopes and concurrent captures',async()=>{
  const {dom,run}=page('', 'https://lightroom.adobe.com/libraries/L/search/assets/A/metadata?flagFilter=reject&q=event');
  const result=await run('lightroom-network-arm',{id:'cap'});
  assert.equal(result.url,'https://lightroom.adobe.com/libraries/L/search/assets?flagFilter=reject&q=event');
  const pending=JSON.parse(dom.window.sessionStorage.getItem('photoReviewPendingCaptureV1'));assert.equal(pending.id,'cap');
  await assert.rejects(run('lightroom-network-arm',{id:'other',rejectsConfirmed:true}),/already running/);
  await run('lightroom-network-stop');assert.equal(dom.window.sessionStorage.getItem('photoReviewPendingCaptureV1'),null);
  dom.window.history.replaceState({},'','/libraries/L/albums/A/assets');
  await assert.rejects(run('lightroom-network-arm',{id:'cap',rejectsConfirmed:true}),/First open/);dom.window.close();
});
test('ordinary Photos grid switches to the rejected search in the same library',async()=>{
  const {dom,run}=page('', 'https://lightroom.adobe.com/libraries/L/assets?sortBy=captureDate');
  const result=await run('lightroom-network-arm',{id:'auto'});
  assert.equal(result.url,'https://lightroom.adobe.com/libraries/L/search/assets?sortBy=captureDate&flagFilter=reject');
  dom.window.close();
});
test('batch arm selects Reject without a manual checkbox and preserves the current search',async()=>{
  const {dom,run}=page('', 'https://lightroom.adobe.com/libraries/L/search/assets?q=event&sortBy=captureDate&flagFilter=pick');
  const result=await run('lightroom-network-arm',{id:'auto'});
  const target=new URL(result.url);
  assert.equal(target.searchParams.get('flagFilter'),'reject');
  assert.equal(target.searchParams.get('q'),'event');
  assert.equal(target.searchParams.get('sortBy'),'captureDate');
  assert.equal(target.pathname,'/libraries/L/search/assets');
  dom.window.close();
});
test('Lightroom requires reject-view attestation; deduplicates rendered filename labels', async () => {
  const {dom,run} = page('<span title="A.JPG">A.JPG</span><span>holiday notes</span><span>B.HEIC</span>', 'https://lightroom.adobe.com/library');
  await assert.rejects(run('lightroom-capture'), /filter Lightroom/);
  const result = await run('lightroom-capture',{rejectsConfirmed:true});
  assert.deepEqual(Array.from(result.records,r=>r.filename), ['A.JPG','B.HEIC']);
  assert.equal(result.incomplete,true); dom.window.close();
});
test('Lightroom can read a filename exposed as a readonly Info field', async () => {
  const {dom,run} = page('<label>File name <input readonly value="IMG_1234.JPG"></label><input type="password" value="private.jpg"><input type="search" value="not-a-photo.jpg">', 'https://lightroom.adobe.com/library');
  const result = await run('lightroom-capture',{rejectsConfirmed:true});
  assert.deepEqual(Array.from(result.records,r=>r.filename), ['IMG_1234.JPG']);
  dom.window.close();
});
test('Lightroom picker collects one explicit reject without changing the field', async () => {
  const {dom,run} = page('<input id="file" readonly value="IMG_1234.JPG">', 'https://lightroom.adobe.com/photo/asset-A');
  await assert.rejects(run('lightroom-pick-name'),/filter Lightroom/);
  const pending=run('lightroom-pick-name',{rejectsConfirmed:true});
  dom.window.document.getElementById('file').click();
  const result=await pending;
  assert.equal(result.records[0].filename,'IMG_1234.JPG');
  assert.equal(result.records[0].sourceUrl,'https://lightroom.adobe.com/photo/asset-A');
  assert.equal(dom.window.document.getElementById('file').value,'IMG_1234.JPG');
  dom.window.close();
});
test('Google readonly filename choice stays valid for the subsequent approval read', async () => {
  const {dom,run} = page('<input id="file" readonly value="IMG_1234.JPG">', 'https://photos.google.com/photo/A');
  const pending=run('google-pick-name');dom.window.document.getElementById('file').click();
  assert.equal((await pending).filenames[0],'IMG_1234.JPG');
  assert.equal((await run('google-read')).filenames[0],'IMG_1234.JPG');
  dom.window.close();
});
test('Lightroom diagnostics contains counts but no photo filenames or field values', async () => {
  const {dom,run}=page('<input readonly value="private-photo.JPG"><span>PRIVATE.JPG</span>', 'https://lightroom.adobe.com/library');
  const result=await run('lightroom-diagnostics');
  assert.equal(result.readableFilenames,2);assert.equal(result.readonlyTextFields,1);
  assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  dom.window.close();
});
test('Lightroom diagnostic inspects nested open shadows without exposing filename values', async () => {
  const {dom,run}=page('<div id="host"></div>', 'https://lightroom.adobe.com/library');
  const outer=dom.window.document.getElementById('host').attachShadow({mode:'open'});
  outer.innerHTML='<section></section>';
  const inner=outer.querySelector('section').attachShadow({mode:'open'});
  inner.innerHTML='<span title="PRIVATE.JPG">PRIVATE.JPG</span>';
  const result=await run('lightroom-diagnostics');
  assert.equal(result.shadowReadableFilenames,1);
  assert.equal(result.openShadowRoots,2);
  assert.equal(result.filenameStructures[0].tag,'SPAN');
  assert.equal(result.filenameStructures[0].shadowHost,'SECTION');
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  dom.window.close();
});
test('Google ignores filename A elsewhere when photo B is open', async () => {
  const {dom,run} = page('<main><h1>Photo B</h1><span>IMG_A.JPG</span></main>', 'https://photos.google.com/photo/B');
  assert.equal((await run('google-read')).filenames.length,0);
  await assert.rejects(run('google-album',{url:'https://photos.google.com/photo/B',filename:'IMG_A.JPG',album:'Review'}), /Info panel changed/);
  dom.window.close();
});
test('Google reads only one named Info region and fails closed on duplicate panels', async () => {
  const {dom,run} = page('<span>UNRELATED.JPG</span><aside aria-label="Info"><span>ACTUAL.JPG</span></aside>', 'https://photos.google.com/photo/B');
  assert.deepEqual(Array.from((await run('google-read')).filenames),['ACTUAL.JPG']);
  const extra=dom.window.document.createElement('aside'); extra.setAttribute('aria-label','Info'); extra.innerHTML='<span>OTHER.JPG</span>'; dom.window.document.body.append(extra);
  assert.equal((await run('google-read')).filenames.length,0); dom.window.close();
});
test('explicit filename picker binds to URL and invalidates changed text', async () => {
  const {dom,run} = page('<div id="filename">IMG_A.JPG</div>', 'https://photos.google.com/photo/A');
  const pending=run('google-pick-name');
  dom.window.document.getElementById('filename').click();
  assert.equal((await pending).filenames[0],'IMG_A.JPG');
  assert.equal((await run('google-read')).filenames[0],'IMG_A.JPG');
  dom.window.document.getElementById('filename').textContent='IMG_B.JPG';
  assert.equal((await run('google-read')).filenames.length,0); dom.window.close();
});
test('filename picker cancels without recording a candidate', async () => {
  const {dom,run} = page('<span>A.JPG</span>', 'https://photos.google.com/photo/A');
  const pending=run('google-pick-name');
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await assert.rejects(pending,/cancelled/); assert.equal(dom.window.document.querySelector('[role=status]'),null); dom.window.close();
});
test('album write clicks exact existing album only and reports requested, not verified', async () => {
  const {dom,run} = page('<aside aria-label="Info"><span>A.JPG</span></aside><button id="add">Add to album</button>', 'https://photos.google.com/photo/A');
  let clicked=0;
  dom.window.document.getElementById('add').onclick=()=>{
    const dialog=dom.window.document.createElement('div'); dialog.setAttribute('role','dialog');
    dialog.innerHTML='<button id="album">Review</button><button>Review 2</button>';
    dom.window.document.body.append(dialog); dialog.querySelector('#album').onclick=()=>clicked++;
  };
  const result=await run('google-album',{url:'https://photos.google.com/photo/A',filename:'A.JPG',album:'Review'});
  assert.equal(clicked,1); assert.equal(result.requested,true); assert.equal(result.verified,undefined); dom.window.close();
});
test('album mismatch fails before any page click', async () => {
  const {dom,run} = page('<aside aria-label="Info"><span>B.JPG</span></aside><button>Add to album</button>', 'https://photos.google.com/photo/B');
  let clicks=0; dom.window.document.addEventListener('click',()=>clicks++);
  await assert.rejects(run('google-album',{url:'https://photos.google.com/photo/A',filename:'A.JPG',album:'Review'}));
  assert.equal(clicks,0); dom.window.close();
});
test('album creation commands cannot masquerade as an existing album', async () => {
  const {dom,run} = page('<aside aria-label="Info"><span>A.JPG</span></aside><button>Add to album</button>', 'https://photos.google.com/photo/A');
  let clicks=0; dom.window.document.addEventListener('click',()=>clicks++);
  await assert.rejects(run('google-album',{url:'https://photos.google.com/photo/A',filename:'A.JPG',album:'New shared album'}), /existing album/);
  assert.equal(clicks,0); dom.window.close();
});
test('navigating while the album menu opens blocks the placement click', async () => {
  const {dom,run} = page('<aside aria-label="Info"><span>A.JPG</span></aside><button id="add">Add to album</button>', 'https://photos.google.com/photo/A');
  let clicks=0;
  dom.window.document.getElementById('add').onclick=()=>{
    dom.window.history.replaceState({},'', '/photo/B');
    const d=dom.window.document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<button>Review</button>';d.firstChild.onclick=()=>clicks++;dom.window.document.body.append(d);
  };
  await assert.rejects(run('google-album',{url:'https://photos.google.com/photo/A',filename:'A.JPG',album:'Review'}), /photo changed/);
  assert.equal(clicks,0); dom.window.close();
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('workspace guides capture, exact match, explicit approval, album request, verification and restore data', async () => {
  const html=await readFile(new URL('fixtures/legacy-workspace.html',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'https://extension.test/',pretendToBeVisual:true});
  globalThis.document=dom.window.document;
  globalThis.confirm=()=>true;
  let saved={}, albumCalls=0, captureEmpty=false, googleOpen=true;
  globalThis.chrome={
    storage:{local:{get:async()=>saved,set:async data=>{saved=structuredClone(data);}}},
    tabs:{query:async({url})=>!url.includes('lightroom')&&!googleOpen?[]:[{id:url.includes('lightroom')?1:2,title:url.includes('lightroom')?'Lightroom test':'Google test'}],get:async()=>({url:'https://photos.google.com/',windowId:1}),update:async()=>({})},
    windows:{update:async()=>({})},
    scripting:{executeScript:async({args:[command]})=>{
      if(command==='lightroom-capture')return [{result:{records:captureEmpty?[]:[{filename:'A.JPG'},{filename:'B.JPG'}],reason:'Visible page captured'}}];
      if(command==='lightroom-pick-name')return [{result:{records:[{filename:'A.JPG'},{filename:'B.JPG'}],reason:'Filename chosen by you'}}];
      if(command==='google-read')return [{result:{url:'https://photos.google.com/photo/A',filenames:['A.JPG']}}];
      if(command==='google-album'){albumCalls++;return [{result:{message:'Placement requested; verify in album.'}}];}
      throw new Error('Unknown synthetic command');
    }}};
  await import('../app.js');
  const $=id=>document.getElementById(id);
  async function click(id){$(id).click();for(let n=0;n<6;n++)await new Promise(r=>setImmediate(r));}
  assert.match($('status').textContent,/Start in Lightroom/);
  assert.equal($('collect-panel').hidden,false);assert.equal($('review-panel').hidden,true);
  assert.equal($('stage-review').disabled,true);
  assert.match($('lightroom-selected').textContent,/Lightroom test/);
  await click('capture'); assert.match($('status').textContent,/First filter/);
  $('rejects-only').checked=true;captureEmpty=true;await click('capture');
  assert.equal($('capture-help').hidden,false);assert.match($('status').textContent,/Choose filename/);
  await click('lr-pick');assert.equal($('capture-help').hidden,true);
  assert.equal($('rows').children.length,2);
  assert.equal(document.querySelector('.records').parentElement.id,'collect-list-slot');
  await click('capture');
  assert.match($('status').textContent,/No filenames/);
  assert.match($('collected-count').textContent,/2 filenames in your saved list/);
  assert.equal(document.querySelector('.records').open,true);
  assert.equal(saved.photoReviewWorkspaceV1.records.length,2);
  captureEmpty=false;await click('capture');
  assert.equal($('capture-help').hidden,true);
  assert.match($('status').textContent,/Added 0 records; 2 total/);
  await click('continue-review');assert.equal($('collect-panel').hidden,true);assert.equal($('review-panel').hidden,false);
  await click('stage-collect');assert.match($('status').textContent,/Collect rejected photos/);assert.equal($('collect-panel').hidden,false);
  await click('stage-review');assert.match($('status').textContent,/Find this photo/);assert.equal($('review-panel').hidden,false);
  assert.equal(document.querySelector('.records').parentElement.id,'review-list-slot');
  googleOpen=false;await click('refresh-google');assert.equal($('search').disabled,true);assert.equal($('read').disabled,true);assert.equal($('pick-name').disabled,true);assert.match($('google-selected').textContent,/Open Google Photos/);
  await click('stage-collect');await click('continue-review');assert.match($('status').textContent,/Open Google Photos/);
  googleOpen=true;await click('refresh-google');assert.equal($('search').disabled,false);assert.equal($('read').disabled,false);
  await click('read'); assert.equal($('approve').disabled,true);
  assert.equal($('retry-match').hidden,false);await click('retry-match');assert.equal($('candidate').hidden,true);assert.equal($('search').hidden,false);
  await click('read');
  $('compared').checked=true; $('compared').dispatchEvent(new dom.window.Event('change'));
  assert.equal($('approve').disabled,false);
  await click('approve'); assert.match($('summary').textContent,/1 approved/);
  $('album').value='Review'; await click('add');
  assert.equal(albumCalls,1); assert.match($('summary').textContent,/0 album placements/);
  await click('done'); assert.match($('summary').textContent,/1 album placements/);
  await click('next-main'); assert.match($('current').textContent,/B.JPG/);
  assert.equal($('add').disabled,true);
  $('filter').value='not-present'; $('filter').dispatchEvent(new dom.window.Event('input'));assert.equal($('rows').children.length,0);
  const persisted=saved.photoReviewWorkspaceV1;
  assert.equal(persisted.records.length,2);assert.equal(Object.values(persisted.matches)[0].verified,true);
  dom.window.close(); delete globalThis.document; delete globalThis.chrome;delete globalThis.confirm;
});

test('batch capture saves complete responses atomically and preserves decisions on error or cancellation',async()=>{
  const {normalizeRecord}=await import('../core.js');
  const html=await readFile(new URL('fixtures/legacy-workspace.html',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'https://extension.test/',pretendToBeVisual:true});
  globalThis.document=dom.window.document;
  const old=normalizeRecord({filename:'OLD.JPG'});
  let saved={photoReviewWorkspaceV1:{records:[old],matches:{},selected:old.id,album:'Review'}};
  let mode='success', release, updates=0, activeId;
  const incoming=[{filename:'A.JPG',sourceUrl:'https://lightroom.adobe.com/libraries/L/search/assets/A/metadata?flagFilter=reject'},{filename:'B.JPG',sourceUrl:'https://lightroom.adobe.com/libraries/L/search/assets/B/metadata?flagFilter=reject'}];
  globalThis.chrome={storage:{local:{get:async()=>structuredClone(saved),set:async value=>{if(mode==='quota')throw new Error('quota');saved=structuredClone(value);}}},
    tabs:{query:async({url})=>[{id:url.includes('lightroom')?1:2,title:'Synthetic service'}],get:async()=>({url:'https://lightroom.adobe.com/libraries/L/search/assets?flagFilter=reject',windowId:1}),update:async()=>{updates++;}},
    scripting:{executeScript:async({args:[command,options],world})=>{
      assert.equal(world,'MAIN');
      if(command==='lightroom-network-arm'){activeId=options.id;return [{result:{url:'https://lightroom.adobe.com/libraries/L/search/assets?flagFilter=reject'}}];}
      if(command==='lightroom-network-stop')return [{result:{phase:'stopped',records:[]}}];
      if(command==='lightroom-network-read'){
        if(mode==='waiting')return await new Promise(resolve=>{release=()=>resolve([{result:{id:activeId,phase:'captured',records:incoming,expectedCount:2}}]);});
        return [{result:mode==='error'?{phase:'error',message:'Lightroom returned an unsupported batch.'}:{id:activeId,phase:'captured',expectedCount:mode==='quota'?1:2,records:mode==='quota'?[{filename:'C.JPG'}]:incoming}}];
      }
      throw new Error('Unexpected operation');
    }}};
  await import('../app.js?batch-test');
  const $=id=>document.getElementById(id);
  async function click(id){$(id).click();for(let n=0;n<10;n++)await new Promise(r=>setImmediate(r));}
  await click('capture-batch');assert.equal(updates,1);assert.equal($('rejects-only').checked,false);
  assert.match($('status').textContent,/Captured 2 of 2/);assert.equal(saved.photoReviewWorkspaceV1.records.length,3);
  await click('capture-batch');assert.equal(saved.photoReviewWorkspaceV1.records.length,3);assert.match($('status').textContent,/Added 0/);
  const before=structuredClone(saved);
  mode='error';await click('capture-batch');assert.match($('status').textContent,/unsupported batch/);assert.deepEqual(saved,before);
  mode='quota';await click('capture-batch');assert.match($('status').textContent,/storage is full/);assert.deepEqual(saved,before);assert.equal($('rows').children.length,3);
  mode='waiting';await click('capture-batch');assert.equal($('stop').disabled,false);
  await click('stop');release();for(let n=0;n<10;n++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(saved,before);assert.match($('status').textContent,/cancelled/);
  dom.window.close();delete globalThis.document;delete globalThis.chrome;
});

test('restoring historical same-asset records preserves their IDs and match decisions',async()=>{
  const {normalizeRecord}=await import('../core.js');
  const records=['one','two'].map(q=>normalizeRecord({filename:'A.JPG',sourceUrl:`https://lightroom.adobe.com/libraries/L/search/assets/A/metadata?q=${q}`}));
  let saved={photoReviewWorkspaceV1:{records,matches:{[records[1].id]:{url:'https://photos.google.com/photo/G',verified:false}},selected:records[1].id,album:'Review'}};
  const dom=new JSDOM(await readFile(new URL('fixtures/legacy-workspace.html',import.meta.url),'utf8'),{url:'https://extension.test/'});
  globalThis.document=dom.window.document;
  globalThis.chrome={storage:{local:{get:async()=>structuredClone(saved),set:async value=>{saved=structuredClone(value);}}},tabs:{query:async()=>[]},scripting:{}};
  await import('../app.js?restore-legacy-test');
  assert.equal(document.getElementById('rows').children.length,2);
  assert.match(document.getElementById('summary').textContent,/1 approved/);
  const album=document.getElementById('album');album.value='Review updated';album.dispatchEvent(new dom.window.Event('change'));
  for(let n=0;n<8;n++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(saved.photoReviewWorkspaceV1.records.map(r=>r.id),records.map(r=>r.id));
  assert.equal(saved.photoReviewWorkspaceV1.matches[records[1].id].url,'https://photos.google.com/photo/G');
  dom.window.close();delete globalThis.document;delete globalThis.chrome;
});

test('local update saves decisions before reload and stops if saving fails',async()=>{
  const {normalizeRecord}=await import('../core.js');
  const record=normalizeRecord({filename:'A.JPG'});
  let saved={photoReviewWorkspaceV1:{records:[record],matches:{[record.id]:{url:'https://photos.google.com/photo/G',verified:true}},selected:record.id,album:'Review'}};
  let fail=false,release;
  const events=[];
  const dom=new JSDOM(await readFile(new URL('fixtures/legacy-workspace.html',import.meta.url),'utf8'),{url:'https://extension.test/'});
  globalThis.document=dom.window.document;
  globalThis.chrome={
    runtime:{getManifest:()=>({version:'0.3.2'}),reload:()=>events.push('reload')},
    storage:{local:{get:async()=>structuredClone(saved),set:async value=>{if(fail)throw new Error('quota');await new Promise(resolve=>{release=resolve;});saved=structuredClone(value);events.push('save');}}},
    tabs:{query:async()=>[],getCurrent:async()=>({id:4,windowId:5,active:true})},scripting:{}};
  await import('../app.js?local-update-test');
  const button=document.getElementById('reload-extension');
  assert.equal(button.disabled,false);assert.equal(document.getElementById('version').textContent,'v0.3.2');
  const pasted=document.getElementById('paste-names');pasted.value='UNSAVED.JPG';button.click();for(let n=0;n<6;n++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(events,[]);assert.equal(pasted.value,'UNSAVED.JPG');assert.match(document.getElementById('status').textContent,/add or clear/);pasted.value='';
  button.click();for(let n=0;n<6;n++)await new Promise(r=>setImmediate(r));
  assert.equal(button.disabled,true);button.click();assert.deepEqual(events,[]);
  release();for(let n=0;n<8;n++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(events,['save','reload']);assert.equal(saved.photoReviewWorkspaceV1.matches[record.id].verified,true);
  const before=structuredClone(saved);fail=true;button.click();for(let n=0;n<8;n++)await new Promise(r=>setImmediate(r));
  assert.deepEqual(events,['save','reload']);assert.deepEqual(saved,before);assert.match(document.getElementById('status').textContent,/storage is full/);
  dom.window.close();delete globalThis.document;delete globalThis.chrome;
});

test('Google filename search quotes literal names, preserves the account and stops on embedded quotes',async()=>{
  const {normalizeRecord}=await import('../core.js');
  for(const [index,filename] of ['A.JPG','旅行 #1 & 2.JPG','A"B.JPG'].entries()){
    const html=await readFile(new URL('fixtures/legacy-workspace.html',import.meta.url),'utf8');
    const dom=new JSDOM(html,{url:'https://extension.test/',pretendToBeVisual:true});
    globalThis.document=dom.window.document;
    const record=normalizeRecord({filename}); const updates=[];
    globalThis.chrome={
      storage:{local:{get:async()=>({photoReviewWorkspaceV1:{records:[record],matches:{},selected:record.id,album:''}}),set:async()=>{}}},
      tabs:{query:async({url})=>[{id:url.includes('lightroom')?1:2,title:'Synthetic service'}],get:async()=>({url:'https://photos.google.com/u/2/',windowId:7}),update:async(id,options)=>{updates.push({id,...options});}},
      windows:{update:async()=>{}},scripting:{}
    };
    await import(`../app.js?quoted-search-${index}`);
    for(let n=0;n<10;n++)await new Promise(resolve=>setImmediate(resolve));
    document.getElementById('search').click();
    for(let n=0;n<10;n++)await new Promise(resolve=>setImmediate(resolve));
    if(filename.includes('"')){
      assert.equal(updates.length,0);
      assert.match(document.getElementById('status').textContent,/quotation mark/);
    }else{
      assert.equal(updates.length,1);
      const url=new URL(updates[0].url);
      assert.equal(decodeURIComponent(url.pathname),`/u/2/search/"${filename}"`);
      assert.equal(url.search,'');assert.equal(url.hash,'');
    }
    dom.window.close();delete globalThis.document;delete globalThis.chrome;
  }
});

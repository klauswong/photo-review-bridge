import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {updateReview,restoreReviews,useLibrary,clearReviews,deleteLibrary,rememberPhoto} from '../hud-store.js';
const C=globalThis.PhotoReviewHUDCore;
const url=id=>`https://photos.google.com/u/2/photo/${id}`;
function memory(initial={}){
  let data=structuredClone(initial),fail=false;const listeners=[];
  return {listeners,get data(){return data;},set fail(value){fail=value;},async get(keys){if(keys===null)return structuredClone(data);return Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>k in data).map(k=>[k,structuredClone(data[k])]));},async remove(keys){if(fail)throw new Error('remove failed');for(const key of Array.isArray(keys)?keys:[keys])delete data[key];for(const fn of listeners)fn(Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,{}])),'local');},async getBytesInUse(keys){return new TextEncoder().encode(JSON.stringify(Object.fromEntries(keys.filter(key=>key in data).map(key=>[key,data[key]])))).length;},async set(changes){if(fail)throw new Error('quota');Object.assign(data,structuredClone(changes));for(const fn of listeners)fn(changes,'local');}};
}
test('HUD identity canonicalizes library/album routes and rejects unrelated or ambiguous URLs',()=>{
  assert.equal(C.identity('https://photos.google.com/u/2/album/EVENT/photo/PHOTO').id,'PHOTO');
  assert.deepEqual(C.identity('https://photos.google.com/u/2/album/EVENT/photo/PHOTO'),C.identity(url('PHOTO')));
  for(const value of ['https://other.test/photo/PHOTO','https://photos.google.com/search/PHOTO','https://photos.google.com/photo/PHOTO/extra'])assert.equal(C.identity(value),null);
  assert.notEqual(C.key('Personal','PHOTO'),C.key('Work','PHOTO'));
  assert.equal(C.libraryName(' 旅行 '),'旅行');
  assert.throws(()=>C.libraryName(' '));
});
test('HUD concurrent field updates preserve decisions, ratings, libraries and failures',async()=>{
  const storage=memory();
  await Promise.all([updateReview({library:'Personal',url:url('A'),patch:{decision:'reject'}},storage),updateReview({library:'Personal',url:url('A'),patch:{stars:5}},storage)]);
  assert.equal(storage.data[C.key('Personal','A')].decision,'reject');assert.equal(storage.data[C.key('Personal','A')].stars,5);
  await updateReview({library:'Work',url:url('A'),patch:{decision:'accept'}},storage);
  assert.equal(storage.data[C.key('Personal','A')].decision,'reject');
  await assert.rejects(updateReview({library:'Personal',url:url('A'),patch:{stars:6}},storage));
  const before=structuredClone(storage.data);storage.fail=true;
  await assert.rejects(updateReview({library:'Personal',url:url('A'),patch:{decision:'accept'}},storage));assert.deepEqual(storage.data,before);
  storage.fail=false;await updateReview({library:'Personal',url:url('A'),patch:{stars:0}},storage);assert.equal(storage.data[C.key('Personal','A')].stars,0);
});
test('HUD restore validates the whole backup before saving and keeps newer reviews',async()=>{
  const storage=memory();const older={library:'Personal',...C.identity(url('A')),decision:'reject',stars:2,updatedAt:'2020-01-01T00:00:00.000Z'};
  await restoreReviews({library:'Personal',reviews:[older]},storage);
  await updateReview({library:'Personal',url:url('A'),patch:{stars:5}},storage);
  assert.equal(await restoreReviews({library:'Personal',reviews:[older]},storage),0);
  const before=structuredClone(storage.data);
  await assert.rejects(restoreReviews({library:'Personal',reviews:[older,{...older,id:'BAD'}]},storage));assert.deepEqual(storage.data,before);
  await assert.rejects(restoreReviews({library:'Other',reviews:[older]},storage));
});
async function fixture(path='/u/2/photo/A',initial={}){
  const dom=new JSDOM('<!doctype html><html><body><main></main><input id="typing"></body></html>',{url:'https://photos.google.com'+path,runScripts:'outside-only',pretendToBeVisual:true});
  const {window}=dom,storage=memory(initial);
  window.HTMLElement.prototype.getClientRects=function(){return this.hidden||this.closest('[hidden]')?[]:[{width:100,height:100}];};
  window.chrome={runtime:{id:'synthetic',getManifest:()=>({version:'0.4.11'}),onMessage:{addListener(){}},sendMessage:async message=>message.type==='hud-remember-photo'?{ok:true,point:await rememberPhoto({...message,accountSlot:'2'},storage)}:message.type==='hud-check-update'?{ok:true,current:'0.4.11',version:'0.4.11',available:false}:message.type==='hud-use-library'?{ok:true,...await useLibrary(message,storage,'2')}:message.type==='hud-clear-reviews'?{ok:true,...await clearReviews(message,storage)}:message.type==='hud-delete-library'?{ok:true,...await deleteLibrary(message,storage)}:{ok:true,value:await updateReview(message,storage)}},storage:{local:storage,onChanged:{addListener:fn=>storage.listeners.push(fn)}}};
  window.eval(await readFile(new URL('../hud-core.js',import.meta.url),'utf8'));
  window.eval(await readFile(new URL('../hud.js',import.meta.url),'utf8'));
  const root=window.document.getElementById('photo-review-hud').shadowRoot;
  async function settle(){for(let n=0;n<10;n++)await new Promise(resolve=>setImmediate(resolve));}
  await settle();
  return {dom,window,storage,root,$:id=>root.getElementById(id),settle,async library(name='Personal'){
    root.getElementById('library').value=name;root.getElementById('setup').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();
  }};
}
test('HUD decisions survive navigation, keep hidden shortcuts and ignore typing and report save failures',async()=>{
  const f=await fixture();await f.library();
  f.root.querySelector('[data-decision="reject"]').click();await f.settle();
  f.root.querySelector('[data-stars="4"]').click();await f.settle();
  assert.equal(f.storage.data[C.key('Personal','A')].decision,'reject');assert.equal(f.storage.data[C.key('Personal','A')].stars,4);
  f.window.document.getElementById('typing').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'a',bubbles:true}));await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'reject');
  f.$('close').click();f.window.document.body.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'r',bubbles:true}));await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'unreviewed');f.window.document.body.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'r',bubbles:true}));await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'reject');
  f.$('expand').click();f.storage.fail=true;f.root.querySelector('[data-decision="accept"]').click();await f.settle();
  assert.match(f.$('message').textContent,/not saved/);assert.equal(f.storage.data[C.key('Personal','A')].decision,'reject');
  f.storage.fail=false;f.window.history.pushState({},'',url('B'));f.window.dispatchEvent(new f.window.PopStateEvent('popstate'));
  await new Promise(resolve=>setTimeout(resolve,220));assert.match(f.$('photo').textContent,/Unreviewed/);
  f.window.history.pushState({},'',url('A'));f.window.dispatchEvent(new f.window.PopStateEvent('popstate'));
  await new Promise(resolve=>setTimeout(resolve,220));assert.match(f.$('photo').textContent,/Rejected.*4 stars/);
  f.dom.window.close();
});
test('HUD selection adds exact matching loaded IDs once and skips unsupported cards',async()=>{
  const a=C.record({library:'Personal',...C.identity(url('A')),decision:'reject',stars:4,updatedAt:'2025-01-01T00:00:00Z'});
  const b={...a,id:'B',url:url('B'),decision:'accept'};
  const c={...a,id:'C',url:url('C')};
  const f=await fixture('/u/2/',{[C.key('Personal','A')]:a,[C.key('Personal','B')]:b,[C.key('Personal','C')]:c});
  f.window.document.querySelector('main').innerHTML='<div role="gridcell"><a href="/u/2/photo/A">A</a><button role="checkbox" aria-checked="false">Select A</button></div><div role="gridcell"><a href="/u/2/photo/B">B</a><button role="checkbox" aria-checked="true">Select B</button></div><a href="/u/2/photo/C">C unsupported</a>';
  const checks=f.window.document.querySelectorAll('[role="checkbox"]');let clicks=0;
  checks[0].onclick=()=>{clicks++;checks[0].setAttribute('aria-checked','true');};
  checks[1].onclick=()=>{throw new Error('Must keep unrelated selection');};
  await f.library();assert.match(f.$('counts').textContent,/2 saved matches.*2 matches in the loaded grid/);
  f.$('select').click();await new Promise(resolve=>setTimeout(resolve,100));await f.settle();
  assert.equal(clicks,1);assert.equal(checks[1].getAttribute('aria-checked'),'true');assert.match(f.$('message').textContent,/1 newly selected.*1 unsupported/);
  f.$('select').click();await new Promise(resolve=>setTimeout(resolve,80));await f.settle();assert.equal(clicks,1);assert.match(f.$('message').textContent,/1 already selected/);
  f.dom.window.close();
});

test('HUD Stop does not retry an unconfirmed click or select the remaining photos',async()=>{
  const first=C.record({library:'Personal',...C.identity(url('A')),decision:'reject',stars:0,updatedAt:'2025-01-01T00:00:00Z'});
  const second={...first,id:'B',url:url('B')};
  const f=await fixture('/u/2/',{[C.key('Personal','A')]:first,[C.key('Personal','B')]:second});
  f.window.document.querySelector('main').innerHTML='<div role="gridcell"><a href="/u/2/photo/A">A</a><button role="checkbox" aria-checked="false">Select A</button></div><div role="gridcell"><a href="/u/2/photo/B">B</a><button role="checkbox" aria-checked="false">Select B</button></div>';
  let clicks=0;for(const button of f.window.document.querySelectorAll('[role="checkbox"]'))button.onclick=()=>{clicks++;};
  await f.library();f.$('select').click();f.$('stop').click();
  await new Promise(resolve=>setTimeout(resolve,140));await f.settle();
  assert.equal(clicks,1);assert.match(f.$('message').textContent,/Stopped.*0 newly selected.*1 not attempted/);
  assert.equal(f.$('select').disabled,false);f.dom.window.close();
});

test('rating filters combine nonadjacent stars, include unrated explicitly and allow empty results',async()=>{
  assert.equal(C.matches({decision:'reject',stars:3},['reject'],[3,5]),true);
  assert.equal(C.matches({decision:'reject',stars:4},['reject'],[3,5]),false);
  assert.equal(C.matches(undefined,['unreviewed'],[0]),true);
  assert.equal(C.matches(undefined,['unreviewed'],[3,5]),false);
  assert.equal(C.matches({decision:'accept',stars:5},['reject'],[3,5]),false);
  assert.equal(C.matches({decision:'reject',stars:5},['reject'],[]),false);
  const records=[3,4,5,0].map((stars,index)=>C.record({library:'Personal',...C.identity(url(String(index))),decision:'reject',stars,updatedAt:'2025-01-01T00:00:00Z'}));
  const f=await fixture('/u/2/',Object.fromEntries(records.map(r=>[C.key(r.library,r.id),r])));await f.library();
  f.window.document.querySelector('main').innerHTML=records.map(r=>`<a href="${r.url}">Photo</a>`).join('');
  const change=()=>f.root.querySelector('#rating-filters input').dispatchEvent(new f.window.Event('change'));
  for(const input of f.root.querySelectorAll('#rating-filters input'))input.checked=[3,5].includes(Number(input.value));
  change();assert.match(f.$('counts').textContent,/2 saved matches.*2 matches in the loaded grid/);assert.equal(f.$('saved').children.length,2);
  for(const input of f.root.querySelectorAll('#rating-filters input'))input.checked=false;
  change();assert.equal(f.$('select').disabled,true);assert.match(f.$('message').textContent,/No ratings selected/);
  f.root.querySelector('#rating-filters input[value="0"]').checked=true;change();assert.match(f.$('counts').textContent,/1 saved matches.*1 matches in the loaded grid/);
  f.dom.window.close();
});

test('review buttons leave navigation keys to the page and Shift+H toggles visibility without intercepting typing',async()=>{
  const f=await fixture();await f.library();let navigations=0;
  f.window.document.addEventListener('keydown',event=>{if(event.key==='ArrowRight'&&!event.defaultPrevented)navigations++;});
  const button=f.root.querySelector('[data-stars="3"]');button.click();await f.settle();button.focus();
  const arrow=new f.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,composed:true,cancelable:true});button.dispatchEvent(arrow);
  assert.equal(arrow.defaultPrevented,false);assert.equal(navigations,1);assert.equal(f.storage.data[C.key('Personal','A')].stars,3);
  const press=(key,options={})=>f.window.document.body.dispatchEvent(new f.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));
  press('H',{shiftKey:true});assert.equal(f.$('expand').hidden,false);press('r');await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'reject');
  press('H',{shiftKey:true});assert.equal(f.$('expand').hidden,true);press('r');await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'unreviewed');
  press('?',{shiftKey:true});assert.equal(f.$('settings-panel').hidden,false);
  f.window.document.getElementById('typing').dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'h',bubbles:true}));assert.equal(f.$('expand').hidden,true);
  const editable=f.window.document.createElement('div');editable.setAttribute('contenteditable','');f.window.document.body.append(editable);editable.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'a',bubbles:true}));await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'unreviewed');
  f.dom.window.close();
});

test('opacity defaults, validation, persistence and failed saves keep the last stored setting',async()=>{
  for(const value of [75,85,100])assert.equal(C.validOpacity(value),true);
  for(const value of [0,74,101,84.5,'85',null])assert.equal(C.validOpacity(value),false);
  const f=await fixture();await f.library();assert.equal(f.$('opacity').value,String(C.OPACITY.default));
  f.$('opacity').value='75';f.$('opacity').dispatchEvent(new f.window.Event('input'));assert.equal(f.$('opacity-value').textContent,'75%');
  f.$('opacity').dispatchEvent(new f.window.Event('change'));await f.settle();assert.equal(f.storage.data[C.OPACITY.key],75);
  f.storage.fail=true;f.$('opacity').value='100';f.$('opacity').dispatchEvent(new f.window.Event('change'));await f.settle();
  assert.equal(f.$('opacity').value,'75');assert.equal(f.storage.data[C.OPACITY.key],75);assert.match(f.$('message').textContent,/not saved/);
  f.dom.window.close();
  const restored=await fixture('/u/2/photo/A',{[C.OPACITY.key]:100});assert.equal(restored.$('opacity').value,'100');restored.dom.window.close();
  const invalid=await fixture('/u/2/photo/A',{[C.OPACITY.key]:1});assert.equal(invalid.$('opacity').value,String(C.OPACITY.default));assert.match(invalid.$('message').textContent,/invalid/);assert.equal(invalid.storage.data[C.OPACITY.key],1);invalid.dom.window.close();
});

test('repeated review choices toggle off without clearing the independent field',async()=>{
  const f=await fixture();await f.library();
  const rate=f.root.querySelector('[data-stars="4"]'),accept=f.root.querySelector('[data-decision="accept"]'),reject=f.root.querySelector('[data-decision="reject"]');
  rate.click();await f.settle();accept.click();await f.settle();
  rate.click();await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].stars,0);assert.equal(f.storage.data[C.key('Personal','A')].decision,'accept');
  accept.click();await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'unreviewed');
  reject.click();await f.settle();reject.click();await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'unreviewed');
  assert.equal(f.root.querySelector('[data-stars="0"]'),null);assert.equal(f.root.querySelector('[data-decision="unreviewed"]'),null);
  const press=key=>f.window.document.body.dispatchEvent(new f.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  press('3');await f.settle();press('3');await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].stars,0);
  press('a');await f.settle();press('a');await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'unreviewed');
  f.dom.window.close();
});

test('settings opens a larger separate panel, pauses review shortcuts and preserves controls',async()=>{
  const f=await fixture();await f.library();
  const opener=f.$('settings');assert.ok(opener.querySelector('svg'));
  opener.click();assert.equal(f.$('settings-panel').hidden,false);assert.equal(f.$('hud-panel').hidden,true);assert.equal(opener.getAttribute('aria-expanded'),'true');assert.equal(f.root.activeElement,f.$('settings-close'));
  f.window.document.body.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'a',bubbles:true}));await f.settle();assert.equal(f.storage.data[C.key('Personal','A')],undefined);
  f.$('settings-library').value='Work';f.$('settings-library-form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));await f.settle();assert.equal(f.storage.data['photoReviewHudLibraryV1:2'],'Work');
  f.$('settings-close').click();assert.equal(f.$('settings-panel').hidden,true);assert.equal(f.$('hud-panel').hidden,false);assert.equal(f.root.activeElement,opener);assert.match(f.$('hud-library').textContent,/Work/);
  f.dom.window.close();
});

test('A/B comparison pins visible images, switches layouts and clears memory without storing images',async()=>{
  const f=await fixture();await f.library();
  const image=f.window.document.createElement('img');image.src='data:image/svg+xml,%3Csvg%3E%3C/svg%3E';
  Object.defineProperties(image,{complete:{get:()=>true},naturalWidth:{get:()=>600}});image.getBoundingClientRect=()=>({width:600,height:400,left:0,top:0,right:600,bottom:400});f.window.document.querySelector('main').append(image);
  f.$('pin-a').click();assert.match(f.$('message').textContent,/A pinned/);assert.equal(f.$('compare-open').disabled,true);
  f.window.history.pushState({},'',url('B'));image.src='data:image/svg+xml,%3Csvg%20id=%22B%22%3E%3C/svg%3E';f.$('pin-b').click();assert.equal(f.$('compare-open').disabled,false);
  f.$('compare-open').click();assert.equal(f.$('compare-panel').hidden,false);assert.equal(f.$('hud-panel').hidden,true);assert.match(f.$('label-a').textContent,/A/);assert.match(f.$('label-b').textContent,/B/);
  assert.equal(f.$('compare-stage').classList.contains('overlay'),false);f.$('mode-overlay').click();assert.equal(f.$('compare-stage').classList.contains('overlay'),true);assert.equal(f.$('compare-stage').classList.contains('show-b'),false);
  f.$('overlay-toggle').click();assert.equal(f.$('compare-stage').classList.contains('show-b'),true);f.$('compare-stage').click();assert.equal(f.$('compare-stage').classList.contains('show-b'),false);
  f.$('mode-side').click();assert.equal(f.$('compare-stage').classList.contains('overlay'),false);
  assert.equal(JSON.stringify(f.storage.data).includes('data:image'),false);
  f.$('compare-close').click();assert.equal(f.$('image-a').hasAttribute('src'),false);assert.equal(f.$('compare-open').disabled,false);
  f.$('compare-open').click();f.$('compare-clear').click();assert.equal(f.$('compare-panel').hidden,true);assert.equal(f.$('compare-open').disabled,true);assert.equal(f.$('image-b').hasAttribute('src'),false);
  f.dom.window.close();
});

test('comparison rejects absent or ambiguous visible images and releases pinned data on library change',async()=>{
  const f=await fixture();await f.library();f.$('pin-a').click();assert.match(f.$('message').textContent,/Could not identify/);
  function addImage(){const img=f.window.document.createElement('img');img.src='data:image/png;base64,AA==';Object.defineProperties(img,{complete:{get:()=>true},naturalWidth:{get:()=>600}});img.getBoundingClientRect=()=>({width:600,height:400,left:0,top:0,right:600,bottom:400});f.window.document.querySelector('main').append(img);return img;}
  const first=addImage(),second=addImage();f.$('pin-a').click();assert.match(f.$('message').textContent,/Could not identify/);second.getBoundingClientRect=()=>({width:600,height:400,left:-1000,top:0,right:-400,bottom:400});f.$('pin-a').click();assert.match(f.$('message').textContent,/A pinned/);second.remove();
  f.$('pin-a').click();f.window.history.pushState({},'',url('B'));f.$('pin-b').click();assert.equal(f.$('compare-open').disabled,false);
  f.$('settings').click();f.$('settings-library').value='Other';f.$('settings-library-form').dispatchEvent(new f.window.Event('submit',{cancelable:true}));await f.settle();f.$('settings-close').click();assert.equal(f.$('compare-open').disabled,true);
  first.remove();f.dom.window.close();
});

test('selection scrolls for delayed photos and checks all saved target IDs without toggling earlier selections',async()=>{
  const records=['A','B','C'].map(id=>C.record({library:'Personal',...C.identity(url(id)),decision:'reject',stars:3,updatedAt:'2025-01-01T00:00:00Z'}));
  const f=await fixture('/u/2/',Object.fromEntries(records.map(r=>[C.key(r.library,r.id),r]))),main=f.window.document.querySelector('main');
  main.style.overflowY='auto';let top=0,loaded=false,clicks=0;
  function card(id){const div=f.window.document.createElement('div');div.setAttribute('role','gridcell');div.innerHTML=`<a href="${url(id)}">${id}</a><button role="checkbox" aria-checked="false">Select</button>`;div.querySelector('button').onclick=event=>{clicks++;event.currentTarget.setAttribute('aria-checked','true');};main.append(div);}
  card('A');Object.defineProperties(main,{clientHeight:{get:()=>200},scrollHeight:{get:()=>loaded?1200:800},scrollTop:{get:()=>top,set:value=>{top=Math.min(value,1000);if(value>=150&&!loaded){loaded=true;setTimeout(()=>{card('B');card('C');},30);}}}});
  await f.library();assert.match(f.$('counts').textContent,/3 saved matches.*1 matches in the loaded grid/);
  f.$('select').click();for(let n=0;n<55&&f.$('stop').hidden===false;n++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(loaded,true);assert.equal(clicks,3);assert.match(f.$('message').textContent,/All saved targets confirmed.*3 of 3 target matches confirmed/);
  assert.equal(f.$('stop').hidden,true);f.dom.window.close();
});

test('selection reports missing saved matches as partial instead of claiming completion',async()=>{
  const records=['A','B'].map(id=>C.record({library:'Personal',...C.identity(url(id)),decision:'reject',stars:3,updatedAt:'2025-01-01T00:00:00Z'}));
  const f=await fixture('/u/2/',Object.fromEntries(records.map(r=>[C.key(r.library,r.id),r])));
  f.window.document.querySelector('main').innerHTML=`<div role="gridcell"><a href="${url('A')}">A</a><button role="checkbox" aria-checked="false">Select</button></div>`;
  const button=f.window.document.querySelector('main button');button.onclick=()=>button.setAttribute('aria-checked','true');await f.library();
  f.$('select').click();await new Promise(resolve=>setTimeout(resolve,100));
  assert.match(f.$('message').textContent,/1 of 2 target matches confirmed.*1 not found in this view.*Partial result/);assert.doesNotMatch(f.$('message').textContent,/All saved targets confirmed/);
  f.dom.window.close();
});

test('selection enforces its time limit inside a loaded batch before clicking',async()=>{
  const record=C.record({library:'Personal',...C.identity(url('A')),decision:'reject',stars:3,updatedAt:'2025-01-01T00:00:00Z'});
  const f=await fixture('/u/2/',{[C.key(record.library,record.id)]:record});
  f.window.document.querySelector('main').innerHTML=`<div role="gridcell"><a href="${url('A')}">A</a><button role="checkbox" aria-checked="false">Select</button></div>`;
  let clicks=0;f.window.document.querySelector('main button').onclick=()=>clicks++;await f.library();
  let ticks=0;f.window.Date.now=()=>++ticks<=2?0:120001;
  f.$('select').click();await f.settle();assert.equal(clicks,0);assert.match(f.$('message').textContent,/Scan limit reached.*0 of 1.*Partial result/);f.dom.window.close();
});

test('decision checkboxes combine accept/reject/unreviewed consistently and no decisions enables ratings-only',async()=>{
  const records=['accept','reject','unreviewed'].map((decision,index)=>C.record({library:'Personal',...C.identity(url(String(index))),decision,stars:3,updatedAt:'2025-01-01T00:00:00Z'}));
  const f=await fixture('/u/2/',Object.fromEntries(records.map(r=>[C.key(r.library,r.id),r])));
  f.window.document.querySelector('main').innerHTML=records.map(r=>`<div role="gridcell"><a href="${r.url}">${r.decision}</a><button role="checkbox" aria-checked="false">Select</button></div>`).join('');
  const clicked=[];for(const button of f.window.document.querySelectorAll('main button'))button.onclick=()=>{button.setAttribute('aria-checked','true');clicked.push(button.parentElement.querySelector('a').textContent);};
  await f.library();const checks=[...f.root.querySelectorAll('#decision-filters input')];assert.deepEqual(checks.filter(i=>i.checked).map(i=>i.value),['reject']);
  checks.find(i=>i.value==='accept').click();assert.match(f.$('counts').textContent,/2 saved matches.*2 matches in the loaded grid/);assert.equal(f.$('saved').children.length,2);
  f.$('select').click();await new Promise(resolve=>setTimeout(resolve,130));await f.settle();assert.deepEqual(clicked,['accept','reject']);assert.match(f.$('message').textContent,/2 of 2 target matches confirmed/);
  for(const input of checks)input.checked=false;checks[0].dispatchEvent(new f.window.Event('change'));assert.equal(f.$('select').disabled,false);assert.match(f.$('message').textContent,/Ratings only/);assert.match(f.$('counts').textContent,/3 saved matches/);
  checks.find(i=>i.value==='unreviewed').click();assert.match(f.$('counts').textContent,/1 saved matches/);f.dom.window.close();
});

test('a HUD invalidated by another tab marks its refresh control for local page recovery',async()=>{
  const f=await fixture();await f.library();
  f.window.chrome.runtime.id=null;const future=Date.now()+11000;f.window.Date.now=()=>future;
  f.window.dispatchEvent(new f.window.Event('focus'));await f.settle();
  assert.equal(f.$('refresh-plugin').hidden,true);assert.equal(f.$('refresh-plugin').dataset.update,'true');assert.match(f.$('refresh-plugin').getAttribute('aria-label'),/Refresh this tab/);assert.equal(f.$('update').textContent,'Refresh this tab');
  assert.equal(f.storage.data['photoReviewHudLibraryV1:2'],'Personal');f.dom.window.close();
});

test('library choices discover legacy reviews and retain named empty libraries across switches',async()=>{
  const work=C.record({library:'Work',...C.identity(url('W')),decision:'accept',stars:4,updatedAt:'2025-01-01T00:00:00Z'});
  const storage=memory({[C.key('Work','W')]:work,'photoReviewHudLibraryV1:1':'Old empty'});
  assert.deepEqual(C.libraryNames(storage.data),['Old empty','Work']);
  await Promise.all([useLibrary({library:'Personal'},storage,'2'),useLibrary({library:'Travel'},storage,'3')]);
  await useLibrary({library:'Work'},storage,'2');
  assert.deepEqual(C.libraryNames(storage.data),['Old empty','Personal','Travel','Work']);
  assert.equal(storage.data[C.key('Work','W')].stars,4);assert.equal(storage.data['photoReviewHudLibraryV1:2'],'Work');
});

test('clear-round resets only the confirmed library fields, preserves identities and rejects changed snapshots',async()=>{
  const a=C.record({library:'Personal',...C.identity(url('A')),decision:'reject',stars:5,updatedAt:'2025-01-01T00:00:00Z'}),b={...a,id:'B',url:url('B'),library:'Work'};
  const storage=memory({[C.key('Personal','A')]:a,[C.key('Work','B')]:b,[C.OPACITY.key]:85,'photoReviewWorkspaceV1':{legacy:true}});
  const stamp=C.reviewStamp([a]);
  await clearReviews({library:'Personal',stamp},storage);
  const reset=storage.data[C.key('Personal','A')];assert.equal(reset.decision,'unreviewed');assert.equal(reset.stars,0);assert.equal(reset.id,a.id);assert.equal(reset.url,a.url);
  assert.deepEqual(storage.data[C.key('Work','B')],b);assert.equal(storage.data[C.OPACITY.key],85);assert.deepEqual(storage.data.photoReviewWorkspaceV1,{legacy:true});
  await assert.rejects(clearReviews({library:'Personal',stamp},storage));
  await updateReview({library:'Personal',url:url('A'),patch:{stars:3}},storage);const before=structuredClone(storage.data);storage.fail=true;
  await assert.rejects(clearReviews({library:'Personal',stamp:C.reviewStamp([storage.data[C.key('Personal','A')]])},storage));assert.deepEqual(storage.data,before);
});

test('HUD switches saved libraries without typing and clear-round requires explicit confirmation',async()=>{
  const record=C.record({library:'Personal',...C.identity(url('A')),decision:'reject',stars:5,updatedAt:'2025-01-01T00:00:00Z'}),other={...record,id:'B',url:url('B'),library:'Work'};
  const f=await fixture('/u/2/photo/A',{[C.key('Personal','A')]:record,[C.key('Work','B')]:other});await f.library();
  assert.deepEqual([...f.$('quick-library').options].map(o=>o.value),['Personal','Work','']);
  f.$('quick-library').value='Work';f.$('quick-library').dispatchEvent(new f.window.Event('change'));await f.settle();assert.equal(f.storage.data['photoReviewHudLibraryV1:2'],'Work');
  f.$('settings').click();f.$('clear-reviews').click();assert.equal(f.$('reset-confirm').hidden,false);assert.match(f.$('reset-description').textContent,/1 photo.*Work/);
  f.$('reset-cancel').click();assert.equal(f.storage.data[C.key('Work','B')].stars,5);
  f.$('clear-reviews').click();await f.storage.set({[C.key('Work','B')]:{...other,stars:4,updatedAt:new Date().toISOString()}});await f.settle();assert.equal(f.$('reset-confirm').hidden,true);assert.match(f.$('message').textContent,/Reviews changed while confirmation/);assert.match(f.$('reset-feedback').textContent,/Reviews changed while confirmation/);
  f.$('clear-reviews').click();f.$('reset-apply').click();await f.settle();assert.equal(f.storage.data[C.key('Work','B')].stars,0);assert.equal(f.storage.data[C.key('Personal','A')].stars,5);assert.match(f.$('message').textContent,/ready for a new round/);
  f.$('settings-close').click();f.$('quick-library').value='Personal';f.$('quick-library').dispatchEvent(new f.window.Event('change'));await f.settle();assert.match(f.$('photo').textContent,/Rejected.*5 stars/);f.dom.window.close();
});

test('HUD update button stays hidden without a detected newer version or if checking fails',async()=>{
  const f=await fixture();await f.library();assert.equal(f.$('refresh-plugin').hidden,true);
  let now=Date.now()+11000;f.window.Date.now=()=>now;f.window.chrome.runtime.sendMessage=async()=>({ok:true,current:'0.4.11',version:'0.4.11',available:true});
  f.window.dispatchEvent(new f.window.Event('focus'));await f.settle();assert.equal(f.$('refresh-plugin').hidden,false);
  now+=11000;f.window.chrome.runtime.sendMessage=async()=>{throw new Error('Unavailable');};f.window.dispatchEvent(new f.window.Event('focus'));await f.settle();assert.equal(f.$('refresh-plugin').hidden,true);f.dom.window.close();
});

test('delete library frees its records and bindings, keeps other empty names and rejects stale saves',async()=>{
  const a=C.record({library:'Personal',...C.identity(url('A')),decision:'unreviewed',stars:0,updatedAt:'2025-01-01T00:00:00Z'}),b={...a,id:'B',url:url('B'),decision:'reject',stars:4};
  const storage=memory({[C.key('Personal','A')]:a,[C.key('Personal','B')]:b,[C.LIBRARIES_KEY]:['Personal','Empty Work'],'photoReviewHudLibraryV1:2':'Personal','photoReviewHudLibraryV1:3':'Personal',[C.OPACITY.key]:80,photoReviewWorkspaceV1:{legacy:true}});
  const result=await deleteLibrary({library:'Personal',stamp:C.libraryStamp([a,b])},storage);
  assert.equal(result.count,2);assert.ok(result.bytes>0);assert.equal(storage.data[C.key('Personal','A')],undefined);assert.equal(storage.data['photoReviewHudLibraryV1:2'],undefined);assert.equal(storage.data['photoReviewHudLibraryV1:3'],undefined);
  assert.deepEqual(C.libraryNames(storage.data),['Empty Work']);assert.equal(storage.data[C.OPACITY.key],80);assert.deepEqual(storage.data.photoReviewWorkspaceV1,{legacy:true});
  await assert.rejects(updateReview({library:'Personal',url:url('A'),patch:{stars:5},accountSlot:'2'},storage));assert.equal(storage.data[C.key('Personal','A')],undefined);
  await useLibrary({library:'Personal'},storage,'2');assert.deepEqual(C.libraryNames(storage.data),['Empty Work','Personal']);
});

test('delete-library stale confirmation and failed removal preserve review data and library choices',async()=>{
  const record=C.record({library:'Personal',...C.identity(url('A')),decision:'accept',stars:5,updatedAt:'2025-01-01T00:00:00Z'});
  const storage=memory({[C.key('Personal','A')]:record,'photoReviewHudLibraryV1:2':'Personal',[C.LIBRARIES_KEY]:['Personal','Empty Work']});
  await assert.rejects(deleteLibrary({library:'Personal',stamp:'stale'},storage));assert.deepEqual(storage.data[C.key('Personal','A')],record);
  storage.remove=async()=>{throw new Error('remove failed');};await assert.rejects(deleteLibrary({library:'Personal',stamp:C.libraryStamp([record])},storage));
  assert.deepEqual(storage.data[C.key('Personal','A')],record);assert.equal(storage.data['photoReviewHudLibraryV1:2'],'Personal');assert.deepEqual(C.libraryNames(storage.data),['Empty Work','Personal']);
});

test('delete-library UI requires confirmation and permits choosing a retained library afterward',async()=>{
  const record=C.record({library:'Personal',...C.identity(url('A')),decision:'accept',stars:3,updatedAt:'2025-01-01T00:00:00Z'});
  const f=await fixture('/u/2/photo/A',{[C.key('Personal','A')]:record,[C.LIBRARIES_KEY]:['Personal','Work']});await f.library();f.$('settings').click();f.$('delete-library').click();assert.match(f.$('delete-description').textContent,/Personal.*1 saved photo link/);
  f.$('delete-cancel').click();assert.ok(f.storage.data[C.key('Personal','A')]);f.$('delete-library').click();f.$('delete-apply').click();await f.settle();
  assert.equal(f.storage.data[C.key('Personal','A')],undefined);assert.deepEqual([...f.$('library-select').options].map(o=>o.value),['Work','']);assert.match(f.$('delete-feedback').textContent,/Deleted.*Personal/);
  f.$('library-select').value='Work';f.$('library-select').dispatchEvent(new f.window.Event('change'));await f.settle();assert.equal(f.storage.data['photoReviewHudLibraryV1:2'],'Work');f.dom.window.close();
});

test('same-origin blob pinning clones browser memory, preserves sources across navigation and releases owned URLs',async()=>{
  const f=await fixture();await f.library();const image=f.window.document.createElement('img');image.src='blob:https://photos.google.com/original-A';Object.defineProperties(image,{complete:{get:()=>true},naturalWidth:{get:()=>600}});image.getBoundingClientRect=()=>({width:600,height:400,left:0,top:0,right:600,bottom:400});f.window.document.querySelector('main').append(image);
  const fetched=[],revoked=[];let created=0;
  f.window.fetch=async src=>{fetched.push(src);return {ok:true,blob:async()=>new f.window.Blob(['synthetic image'])};};
  f.window.URL.createObjectURL=()=>`blob:https://photos.google.com/owned-${++created}`;f.window.URL.revokeObjectURL=src=>revoked.push(src);
  f.$('pin-a').click();await f.settle();assert.match(f.$('message').textContent,/A pinned/);
  f.window.history.pushState({},'',url('B'));image.src='blob:https://photos.google.com/original-B';f.$('pin-b').click();await f.settle();f.$('compare-open').click();assert.match(f.$('image-a').src,/owned-1$/);assert.match(f.$('image-b').src,/owned-2$/);
  assert.deepEqual(fetched,['blob:https://photos.google.com/original-A','blob:https://photos.google.com/original-B']);assert.equal(JSON.stringify(f.storage.data).includes('blob:'),false);
  f.$('compare-clear').click();assert.deepEqual(revoked,['blob:https://photos.google.com/owned-1','blob:https://photos.google.com/owned-2']);f.dom.window.close();
});

test('ratings-only selects matching scores across all decisions and excludes other scores',async()=>{
  const records=[['accept',5],['reject',5],['unreviewed',3]].map(([decision,stars],n)=>C.record({library:'Personal',...C.identity(url(String(n))),decision,stars,updatedAt:'2025-01-01T00:00:00Z'}));
  const f=await fixture('/u/2/',Object.fromEntries(records.map(r=>[C.key(r.library,r.id),r])));await f.library();
  for(const input of f.root.querySelectorAll('#rating-filters input'))input.checked=input.value==='5';f.$('ratings-only').click();assert.equal([...f.root.querySelectorAll('#decision-filters input:checked')].length,0);assert.match(f.$('counts').textContent,/2 saved matches/);assert.equal(C.matches({decision:'unreviewed',stars:5},[],[5]),true);f.dom.window.close();
});

test('a missing saved photo stops after two complete sweeps without re-clicking an earlier selection',async()=>{
  const records=['A','B'].map(id=>C.record({library:'Personal',...C.identity(url(id)),decision:'reject',stars:3,updatedAt:'2025-01-01T00:00:00Z'}));
  const f=await fixture('/u/2/',Object.fromEntries(records.map(r=>[C.key(r.library,r.id),r]))),main=f.window.document.querySelector('main');
  const originalTimeout=f.window.setTimeout.bind(f.window);f.window.setTimeout=(fn,ms,...args)=>originalTimeout(fn,Math.min(ms,10),...args);main.style.overflowY='auto';let top=0,resets=0,clicks=0;
  main.innerHTML=`<div role="gridcell"><a href="${url('A')}">A</a><button role="checkbox" aria-checked="false">Select</button></div>`;const button=main.querySelector('button');button.onclick=()=>{clicks++;button.setAttribute('aria-checked','true');};
  Object.defineProperties(main,{clientHeight:{get:()=>200},scrollHeight:{get:()=>400},scrollTop:{get:()=>top,set:value=>{top=Math.max(0,Math.min(value,200));if(value===0)resets++;}}});await f.library();f.$('select').click();
  for(let n=0;n<150&&!f.$('stop').hidden;n++)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(resets,2);assert.equal(clicks,1);assert.match(f.$('message').textContent,/Finished two scans.*1 of 2.*Partial result/);f.dom.window.close();
});

test('pin diagnostics exclude complete URLs, path tokens, credentials, IDs and image payloads',()=>{
  assert.deepEqual(C.pinSourceShape(''),{scheme:'unknown',hostname:'',origin:''});
  const source='https://alice:SECRET@images.example.test/private-photo-id.JPG?token=PRIVATE_TOKEN#PRIVATE_FRAGMENT';
  const shape=C.pinSourceShape(source);assert.deepEqual(shape,{scheme:'https:',hostname:'images.example.test',origin:'https://images.example.test'});
  const encoded=JSON.stringify(shape);for(const secret of ['alice','SECRET','private-photo-id','PRIVATE_TOKEN','PRIVATE_FRAGMENT'])assert.equal(encoded.includes(secret),false);
  assert.deepEqual(C.pinSourceShape('blob:https://photos.google.com/private-blob-id'),{scheme:'blob:',hostname:'',origin:'https://photos.google.com'});
  assert.equal(JSON.stringify(C.pinSourceShape('data:image/jpeg;base64,PRIVATE_IMAGE_BYTES')).includes('PRIVATE_IMAGE_BYTES'),false);
});

test('unsupported image exposes copyable redacted pin details without changing pin policy',async()=>{
  const f=await fixture();await f.library();const img=f.window.document.createElement('img');img.src='https://images.example.test/private-photo.jpg?secret=DO_NOT_COPY';
  Object.defineProperties(img,{complete:{get:()=>true},naturalWidth:{get:()=>600},naturalHeight:{get:()=>400}});img.getBoundingClientRect=()=>({width:600,height:400,left:0,top:0,right:600,bottom:400});f.window.document.querySelector('main').append(img);
  f.$('pin-a').click();await f.settle();assert.equal(f.$('copy-pin-diagnostics').hidden,false);assert.equal(f.$('compare-open').disabled,true);
  f.$('copy-pin-diagnostics').click();await f.settle();const details=f.$('pin-diagnostics').value;
  assert.match(details,/images.example.test/);assert.equal(details.includes('private-photo.jpg'),false);assert.equal(details.includes('DO_NOT_COPY'),false);assert.equal(JSON.stringify(f.storage.data).includes('images.example.test'),false);f.dom.window.close();
});

test('pin accepts the reported Google Photos FIFE host and excludes lookalike domains',async()=>{
  for(const hostname of ['photos.fife.usercontent.google.com','photos.fife.usercontent.google.com.example.test']){
    const f=await fixture();await f.library();const img=f.window.document.createElement('img');img.src=`https://${hostname}/synthetic-image`;
    Object.defineProperties(img,{complete:{get:()=>true},naturalWidth:{get:()=>817},naturalHeight:{get:()=>1089}});img.getBoundingClientRect=()=>({width:400,height:533,left:0,top:0,right:400,bottom:533});f.window.document.querySelector('main').append(img);
    f.$('pin-a').click();await f.settle();
    if(hostname==='photos.fife.usercontent.google.com'){assert.match(f.$('message').textContent,/Photo A pinned/);assert.equal(f.$('copy-pin-diagnostics').hidden,true);}
    else{assert.match(f.$('message').textContent,/not supported/);assert.equal(f.$('copy-pin-diagnostics').hidden,false);}
    f.dom.window.close();
  }
});

test('minimized HUD keeps review shortcuts active across photo navigation while preserving typing and native keys',async()=>{
  const f=await fixture();try{
    await f.library();f.$('close').click();
    const press=(key,target=f.window.document.body,extra={})=>{const event=new f.window.KeyboardEvent('keydown',{key,bubbles:true,composed:true,cancelable:true,...extra});target.dispatchEvent(event);return event;};
    press('a');await f.settle();assert.equal(f.storage.data[C.key('Personal','A')]?.decision,'accept');assert.equal(f.$('hud-panel').hidden,true);
    press('5');await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].stars,5);
    press('a',f.window.document.getElementById('typing'));press('3',f.window.document.body,{ctrlKey:true});await f.settle();assert.equal(f.storage.data[C.key('Personal','A')].decision,'accept');assert.equal(f.storage.data[C.key('Personal','A')].stars,5);
    for(const key of ['ArrowLeft','ArrowRight','Escape'])assert.equal(press(key).defaultPrevented,false);
    f.window.history.pushState({},'',url('B'));f.window.dispatchEvent(new f.window.PopStateEvent('popstate'));press('r');await f.settle();assert.equal(f.storage.data[C.key('Personal','B')].decision,'reject');assert.equal(f.storage.data[C.key('Personal','A')].decision,'accept');
    press('u');await f.settle();press('0');await f.settle();assert.equal(f.storage.data[C.key('Personal','B')].decision,'unreviewed');
  }finally{f.dom.window.close();}
});


test('Vim photo navigation works expanded and hidden, pauses in panels and typing, and leaves saving attached to its photo',async()=>{
  const f=await fixture();
  try{
    await f.library();
    const arrows=[];
    f.window.document.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)&&!event.defaultPrevented){arrows.push([event.key,event.keyCode]);f.window.history.pushState({},'',url(event.key==='ArrowLeft'?'A':'B'));}});
    const press=(key,target=f.window.document.body,extra={})=>{const event=new f.window.KeyboardEvent('keydown',{key,bubbles:true,composed:true,cancelable:true,...extra});target.dispatchEvent(event);return event;};
    for(const key of ['h','j','k','l'])assert.equal(press(key).defaultPrevented,true);
    assert.deepEqual(arrows,[['ArrowLeft',37],['ArrowRight',39],['ArrowLeft',37],['ArrowRight',39]]);
    assert.equal(f.$('expand').hidden,true);
    press('H',undefined,{shiftKey:true});assert.equal(f.$('expand').hidden,false);
    press('h');assert.equal(arrows.length,5);assert.equal(f.$('expand').hidden,false);
    for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{repeat:true},{isComposing:true}])assert.equal(press('j',undefined,extra).defaultPrevented,false);
    press('l',f.window.document.getElementById('typing'));assert.equal(arrows.length,5);
    press('H',undefined,{shiftKey:true});press('?');press('j');assert.equal(arrows.length,5);
    f.$('settings-close').click();
    const image=f.window.document.createElement('img');image.src='data:image/png;base64,AA==';Object.defineProperties(image,{complete:{get:()=>true},naturalWidth:{get:()=>600}});image.getBoundingClientRect=()=>({width:600,height:400,left:0,top:0,right:600,bottom:400});f.window.document.querySelector('main').append(image);
    f.$('pin-a').click();f.window.history.pushState({},'',url('B'));f.$('pin-b').click();
    f.$('compare-open').click();press('k');assert.equal(arrows.length,5);f.$('compare-close').click();
    let finish;
    const original=f.window.chrome.runtime.sendMessage;
    f.window.chrome.runtime.sendMessage=message=>message.type==='hud-save'?new Promise(resolve=>{finish=()=>original(message).then(resolve);}):original(message);
    f.window.history.pushState({},'',url('A'));press('a');press('l');
    assert.equal(arrows.length,6);assert.equal(f.window.location.href,url('B'));
    assert.equal(typeof finish,'function');await finish();await f.settle();
    assert.equal(f.storage.data[C.key('Personal','A')].decision,'accept');
    assert.equal(f.storage.data[C.key('Personal','B')],undefined);
    f.window.history.pushState({},'','/u/2/album/DEMO');assert.equal(press('h').defaultPrevented,false);assert.equal(arrows.length,6);
  }finally{f.dom.window.close();}
});


test('resume points retain album context, reject stale libraries and older visits, and clear with their library',async()=>{
  const storage=memory();await useLibrary({library:'Personal'},storage,'2');await useLibrary({library:'Other'},storage,'3');
  const point={url:'https://photos.google.com/u/2/album/DEMO/photo/A?private=omit#omit',updatedAt:'2026-11-03T10:00:00.000Z'};
  await rememberPhoto({library:'Personal',accountSlot:'2',point},storage);
  await rememberPhoto({library:'Other',accountSlot:'3',point:{...point,url:'https://photos.google.com/u/3/photo/OTHER'}},storage);
  storage.fail=true;await assert.rejects(rememberPhoto({library:'Personal',accountSlot:'2',point:{...point,url:url('B')}},storage));storage.fail=false;
  assert.equal(storage.data[C.resumeKey('Personal')].url,'https://photos.google.com/u/2/album/DEMO/photo/A');
  await rememberPhoto({library:'Personal',accountSlot:'2',point:{...point,url:url('B'),updatedAt:'2026-11-02T10:00:00.000Z'}},storage);
  assert.equal(storage.data[C.resumeKey('Personal')].id,'A');
  await assert.rejects(rememberPhoto({library:'Other',accountSlot:'2',point},storage));
  await assert.rejects(rememberPhoto({library:'Personal',accountSlot:'3',point},storage));
  await assert.rejects(rememberPhoto({library:'Personal',accountSlot:'2',point:{...point,url:'https://example.com/photo/A'}},storage));
  await clearReviews({library:'Personal',stamp:C.reviewStamp([])},storage);assert.equal(storage.data[C.resumeKey('Personal')],null);
  await rememberPhoto({library:'Personal',accountSlot:'2',point},storage);
  await deleteLibrary({library:'Personal',stamp:C.libraryStamp([])},storage);assert.equal(storage.data[C.resumeKey('Personal')],undefined);
  await assert.rejects(rememberPhoto({library:'Personal',accountSlot:'2',point},storage));
  assert.equal(storage.data[C.resumeKey('Other')].id,'OTHER');
});

test('HUD remembers the last photo, resumes from the grid after reload, and offers an optional hidden review badge',async()=>{
  const f=await fixture('/u/2/album/DEMO/photo/A');
  try{
    await f.library();await f.settle();assert.equal(f.storage.data[C.resumeKey('Personal')].id,'A');assert.equal(f.$('resume').hidden,true);
    assert.equal(f.$('resume').href,'https://photos.google.com/u/2/album/DEMO/photo/A');
    f.$('close').click();assert.equal(f.$('review-badge').hidden,false);assert.match(f.$('review-badge').textContent,/Unreviewed/);
    f.window.document.body.dispatchEvent(new f.window.KeyboardEvent('keydown',{key:'r',bubbles:true}));await f.settle();assert.match(f.$('review-badge').textContent,/Rejected/);
    f.$('expand').click();assert.equal(f.$('review-badge').hidden,true);
    f.$('settings').click();f.storage.fail=true;f.$('badge-enabled').checked=false;f.$('badge-enabled').dispatchEvent(new f.window.Event('change'));await f.settle();assert.equal(f.$('badge-enabled').checked,true);assert.match(f.$('settings-message').textContent,/badge setting could not be saved/);f.storage.fail=false;f.$('badge-enabled').checked=false;f.$('badge-enabled').dispatchEvent(new f.window.Event('change'));await f.settle();
    f.$('settings-close').click();f.$('close').click();assert.equal(f.$('review-badge').hidden,true);
    f.window.history.pushState({},'','/u/2/album/DEMO');f.window.dispatchEvent(new f.window.PopStateEvent('popstate'));await new Promise(resolve=>setTimeout(resolve,210));await f.settle();
    assert.equal(f.storage.data[C.resumeKey('Personal')].id,'A');assert.equal(f.$('review-badge').hidden,true);assert.equal(f.$('resume').hidden,false);
    const g=await fixture('/u/2/album/DEMO',f.storage.data);
    try{assert.equal(g.$('resume').hidden,false);assert.equal(g.$('resume').href,'https://photos.google.com/u/2/album/DEMO/photo/A');assert.equal(g.$('badge-enabled').checked,false);}finally{g.dom.window.close();}
  }finally{f.dom.window.close();}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';

test('toolbar opens Google Photos HUD and local updates preserve the legacy workspace', async () => {
  let action, installed, id, created=0, focused=0, closed=false;let googlePages=[],shown=0,injected=0;
  const refreshed=[];
  const creations=[];let openPages=[{id:42},{id:43}],pending={windowId:5,active:false,createdAt:Date.now()};
  globalThis.chrome={
    action:{onClicked:{addListener:fn=>action=fn}},runtime:{getURL:()=> 'chrome-extension://synthetic/index.html',onInstalled:{addListener:fn=>installed=fn}},
    storage:{local:{get:async()=>({photoReviewReloadWorkspaceV1:pending}),remove:async()=>{pending=undefined;}},session:{get:async()=>({workspaceTabId:id}),set:async data=>{id=data.workspaceTabId;}}},
    tabs:{query:async({url})=>{if(url==='https://photos.google.com/*')return googlePages;assert.equal(url,'chrome-extension://synthetic/index.html');return openPages;},sendMessage:async()=>{if(closed)throw new Error('Old page');shown++;},reload:async tabId=>refreshed.push(tabId),get:async tabId=>{if(closed)throw new Error('No tab');return {id:tabId,url:'chrome-extension://synthetic/index.html',windowId:5};},create:async options=>{creations.push(options);created++;return{id:created};},update:async()=>{focused++;}},
    windows:{update:async()=>{}},scripting:{executeScript:async()=>{injected++;}}
  };
  await import('../background.js');
  await Promise.all([action(),action()]);assert.equal(created,1);
  googlePages=[{id:8,url:'https://photos.google.com/',windowId:5}];
  await action();assert.equal(created,1);assert.equal(focused,1);assert.equal(shown,1);
  closed=true;await action();assert.equal(created,1);assert.equal(injected,1);
  await installed({reason:'install'});assert.deepEqual(refreshed,[]);
  const previousFocus=focused;
  await installed({reason:'update'});assert.deepEqual(refreshed,[42,43]);assert.equal(id,42);assert.equal(focused,previousFocus);assert.equal(created,1);
  openPages=[];pending={windowId:5,active:false,createdAt:Date.now()};
  await installed({reason:'update'});assert.equal(created,2);assert.equal(id,2);assert.deepEqual(creations.at(-1),{url:'chrome-extension://synthetic/index.html',windowId:5,active:false});assert.equal(pending,undefined);
  await installed({reason:'update'});assert.equal(created,2);
  pending={windowId:5,active:true,createdAt:Date.now()-120000};await installed({reason:'update'});assert.equal(created,2);assert.equal(pending,undefined);
  delete globalThis.chrome;
});

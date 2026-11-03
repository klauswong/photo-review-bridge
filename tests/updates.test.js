import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkLocalVersion,resumeHudReload,HUD_RELOAD_KEY} from '../hud-updates.js';
const C=globalThis.PhotoReviewHUDCore;
test('local update checks read only the extension manifest and compare numeric versions',async()=>{
  assert.equal(C.newerVersion('0.4.10','0.4.9'),true);assert.equal(C.newerVersion('0.4.3','0.4.3'),false);assert.equal(C.newerVersion('0.4.2','0.4.3'),false);assert.equal(C.validVersion('not-a-version'),false);
  const runtime={getURL:path=>'chrome-extension://test/'+path,getManifest:()=>({version:'0.4.3'})};
  const result=await checkLocalVersion(runtime,async(url,options)=>{assert.match(url,/^chrome-extension:\/\/test\/manifest.json\?local-version=/);assert.equal(options.cache,'no-store');return {ok:true,json:async()=>({version:'0.4.4'})};});
  assert.deepEqual(result,{current:'0.4.3',version:'0.4.4',available:true});
  await assert.rejects(checkLocalVersion(runtime,async()=>({ok:false})));
  await assert.rejects(checkLocalVersion(runtime,async()=>({ok:true,json:async()=>({version:'bad'})})));
});
test('HUD refresh consumes its marker once and reloads only a fresh matching Google tab',async()=>{
  let pending={tabId:7,createdAt:Date.now()},url='https://photos.google.com/u/2/album/EVENT',reloads=[];
  const storage={get:async()=>({[HUD_RELOAD_KEY]:pending}),remove:async key=>{assert.equal(key,HUD_RELOAD_KEY);pending=undefined;}};
  const tabs={get:async id=>{assert.equal(id,7);return {url};},reload:async id=>reloads.push(id)};
  assert.equal(await resumeHudReload(storage,tabs),true);assert.deepEqual(reloads,[7]);assert.equal(await resumeHudReload(storage,tabs),false);
  pending={tabId:7,createdAt:Date.now()-61000};assert.equal(await resumeHudReload(storage,tabs),false);assert.deepEqual(reloads,[7]);
  pending={tabId:7,createdAt:Date.now()};url='https://example.com/';assert.equal(await resumeHudReload(storage,tabs),false);assert.deepEqual(reloads,[7]);
});

test('HUD reload refuses unauthorized senders and never reloads when saving its return marker fails',async()=>{
  let listener,reloads=0;
  globalThis.chrome={runtime:{id:'test',onInstalled:{addListener(){}},onMessage:{addListener:fn=>listener=fn},reload:()=>reloads++},action:{onClicked:{addListener(){}}},storage:{local:{set:async()=>{throw new Error('quota');}}}};
  await import('../background.js?update-guards');
  let replied=false;assert.equal(listener({type:'hud-reload'},{id:'other',tab:{id:7,url:'https://photos.google.com/'}},()=>{replied=true;}),undefined);assert.equal(replied,false);
  const result=await new Promise(resolve=>listener({type:'hud-reload'},{id:'test',tab:{id:7,url:'https://photos.google.com/'}},resolve));
  assert.deepEqual(result,{ok:false});assert.equal(reloads,0);delete globalThis.chrome;
});

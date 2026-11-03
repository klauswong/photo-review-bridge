import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source=await readFile(new URL('../network-reader.js',import.meta.url),'utf8');
const url='https://search.adobe.io/uss/v3/query';
const query=(flags=[1],start=0)=>({queries:[{id:'q1',scope:{entities:['DMeLrAsset']},start,limit:100,filters:[{'reviews.flag':flags}]}]});
const response=(items=[{id:'asset-A',assetName:'A.JPG'}],total=items.length,start=0)=>({status:{httpCode:200},queryResults:[{id:'q1',status:{httpCode:200},metadata:{totalHits:total,start},items}]});
function setup(armed=true) {
  const dom=new JSDOM('',{url:'https://lightroom.adobe.com/libraries/library-A/search/assets?flagFilter=reject',runScripts:'outside-only'});
  let reply=response(), lastPromise;
  const original=(...args)=>{lastPromise=Promise.resolve(new Response(JSON.stringify(reply)));return lastPromise;};
  dom.window.fetch=original;
  if(armed)dom.window.sessionStorage.setItem('photoReviewPendingCaptureV1',JSON.stringify({id:'capture-A',path:dom.window.location.pathname+dom.window.location.search,expires:Date.now()+90_000}));
  dom.window.eval(source);
  const tick=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
  return {dom,original,setReply:value=>reply=value,lastPromise:()=>lastPromise,tick,
    snapshot:()=>dom.window.__photoReviewNetworkCapture.snapshot(),
    fetch:async(request=query(),target=url)=>{await dom.window.fetch(target,{method:'POST',body:JSON.stringify(request)});await tick();},
    close:()=>{dom.window.__photoReviewNetworkCapture?.stop();dom.window.close();}};
}
test('network reader is inert when not explicitly armed',()=>{
  const p=setup(false);assert.equal(p.dom.window.fetch,p.original);assert.equal(p.dom.window.__photoReviewNetworkCapture,undefined);p.close();
});
test('observed reject response preserves same-name asset identities and original fetch promise',async()=>{
  const p=setup();p.setReply(response([{id:'asset-A',assetName:'SAME.JPG'},{id:'asset-B',assetName:'SAME.JPG'}]));
  const returned=p.dom.window.fetch(url,{method:'POST',body:JSON.stringify(query())});
  assert.equal(returned,p.lastPromise());await returned;await p.tick();
  const state=p.snapshot();assert.equal(state.phase,'captured');assert.equal(state.records.length,2);
  assert.notEqual(state.records[0].sourceUrl,state.records[1].sourceUrl);
  assert.equal(p.dom.window.fetch,p.original);assert.equal(p.dom.window.sessionStorage.getItem('photoReviewPendingCaptureV1'),null);p.close();
});
test('unfiltered, keeper, mixed, conventional -1 and unrelated requests are ignored',async()=>{
  const p=setup();
  for(const flags of [[],[0],[-1],[1,0]])await p.fetch(query(flags));
  await p.fetch({queries:[{id:'q1',start:0,limit:100,filters:[]}]});
  await p.fetch(query(),'https://unrelated.example/uss/v3/query');
  await p.fetch({...query(),queries:[...query().queries,...query().queries]});
  await p.fetch({queries:[{...query().queries[0],scope:{entities:['OtherAsset']}}]});
  assert.equal(p.snapshot().phase,'waiting');assert.equal(p.snapshot().records.length,0);p.close();
});
test('invalid item or query mismatch fails without importing part of a response',async()=>{
  for(const bad of [response([{id:'asset-A',assetName:'A.JPG'},{id:'asset-B',assetName:'not a file'}]),response([{id:'asset-A',assetName:'A.JPG'},{id:'asset-A',assetName:'B.JPG'}]),response([{id:123,assetName:'A.JPG'}]),{...response(),queryResults:[{...response().queryResults[0],id:'other-query'}]},response(undefined,10001)]) {
    const p=setup();p.setReply(bad);await p.fetch();assert.equal(p.snapshot().phase,'error');assert.equal(p.snapshot().records.length,0);assert.equal(p.dom.window.fetch,p.original);p.close();
  }
});
test('changing the view or request constraints aborts instead of mixing batches',async()=>{
  for(const change of ['url','query']){
    const p=setup();p.setReply(response([{id:'asset-A',assetName:'A.JPG'}],2,0));await p.fetch();
    p.setReply(response([{id:'asset-B',assetName:'B.JPG'}],2,1));
    const next=query([1],1);
    if(change==='url')p.dom.window.history.replaceState({},'','?flagFilter=reject&q=another-event');
    else next.queries[0].filters.push({event:'another-event'});
    await p.fetch(next);assert.equal(p.snapshot().phase,'error');assert.equal(p.snapshot().records.length,1);p.close();
  }
});
test('out-of-order pages stay partial until contiguous complete coverage exists',async()=>{
  const p=setup();p.setReply(response([{id:'asset-B',assetName:'B.JPG'}],2,1));await p.fetch(query([1],1));
  assert.equal(p.snapshot().phase,'partial');
  p.setReply(response([{id:'asset-A',assetName:'A.JPG'}],2,0));await p.fetch();
  assert.equal(p.snapshot().phase,'captured');assert.equal(p.snapshot().records.length,2);p.close();
});
test('stop restores browser functions and ignores subsequent page responses',async()=>{
  const p=setup();p.dom.window.__photoReviewNetworkCapture.stop();await p.fetch();assert.equal(p.snapshot().phase,'stopped');assert.equal(p.snapshot().records.length,0);assert.equal(p.dom.window.fetch,p.original);p.close();
});
test('XHR observation preserves its normal send and reads only the matching response',async()=>{
  const p=setup(false);let sends=0;
  class FakeXHR extends p.dom.window.EventTarget {
    open(){}
    send(){sends++;this.status=200;this.responseType='json';this.response=response();this.dispatchEvent(new p.dom.window.Event('load'));}
  }
  p.dom.window.XMLHttpRequest=FakeXHR;
  p.dom.window.sessionStorage.setItem('photoReviewPendingCaptureV1',JSON.stringify({id:'capture-X',path:p.dom.window.location.pathname+p.dom.window.location.search,expires:Date.now()+90_000}));p.dom.window.eval(source);
  const xhr=new FakeXHR();xhr.open('POST',url);xhr.send(JSON.stringify(query()));
  assert.equal(sends,1);assert.equal(p.snapshot().phase,'captured');assert.equal(p.snapshot().records.length,1);p.close();
});

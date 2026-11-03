// Runs in Lightroom's MAIN world only for an explicitly armed, short capture.
// Observes normal page responses; never sends/replays requests or reads headers.
(() => {
  const KEY = 'photoReviewPendingCaptureV1';
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return; }
  if (!pending || typeof pending.id !== 'string' || typeof pending.path !== 'string' || pending.expires <= Date.now() || pending.expires > Date.now() + 120_000) return;
  const base = location.pathname.match(/^\/libraries\/([\w-]+)\/search\/assets\/?$/);
  if (location.hostname !== 'lightroom.adobe.com' || !base || location.pathname+location.search !== pending.path || new URL(location.href).searchParams.get('flagFilter') !== 'reject') return;
  sessionStorage.removeItem(KEY);
  const records = new Map();
  const pages = new Map();
  const state = {id:pending.id, phase:'waiting', records:[], expectedCount:null, message:''};
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const requests = new WeakMap();
  let closed = false, timer;
  let querySignature;
  const snapshot = () => ({...state, records:[...records.values()]});
  const cleanup = () => {
    closed = true; clearTimeout(timer);
    if (window.fetch === observedFetch) window.fetch = originalFetch;
    if (XMLHttpRequest.prototype.open === observedOpen) XMLHttpRequest.prototype.open = originalOpen;
    if (XMLHttpRequest.prototype.send === observedSend) XMLHttpRequest.prototype.send = originalSend;
  };
  const stop = () => { if (!closed) { state.phase='stopped'; cleanup(); } return snapshot(); };
  window.__photoReviewNetworkCapture = {snapshot,stop};
  const fail = message => {
    if (closed) return;
    state.phase='error'; state.message=message;
    console.error('observe-reject-response Lightroom attempt=1 error=InvalidResponse status=unknown');
    cleanup();
  };
  function requestQuery(url, method, body) {
    try {
      const u = new URL(url, location.href);
      if (method.toUpperCase() !== 'POST' || u.protocol !== 'https:' || !/(^|\.)adobe\.(com|io)$/.test(u.hostname) || u.pathname !== '/uss/v3/query') return null;
      if (typeof body !== 'string' || body.length > 100_000) return null;
      const request = JSON.parse(body);
      if (request.queries?.length !== 1) return null;
      const query = request.queries[0];
      if (query.scope?.entities?.length !== 1 || query.scope.entities[0] !== 'DMeLrAsset') return null;
      const flagFilters = query.filters?.filter(f => Object.hasOwn(f,'reviews.flag')) || [];
      if (flagFilters.length !== 1 || Object.keys(flagFilters[0]).length !== 1) return null;
      const flags = flagFilters[0]['reviews.flag'];
      // Observed on this web UI with Rejected exclusively selected: [1].
      if (!Array.isArray(flags) || flags.length !== 1 || flags[0] !== 1) return null;
      if (typeof query.id !== 'string' || !Number.isInteger(query.start) || query.start < 0 || !Number.isInteger(query.limit) || query.limit < 1) return null;
      return {id:query.id,start:query.start,limit:query.limit,signature:JSON.stringify({...query,id:undefined,start:undefined,limit:undefined})};
    } catch { return null; }
  }
  function receive(query, response) {
    if (closed || !query) return;
    try {
      if(location.pathname+location.search !== pending.path || (querySignature && querySignature !== query.signature)) throw new Error('view-changed');
      if (response.status?.httpCode !== 200 || response.queryResults?.length !== 1) throw new Error('shape');
      const result = response.queryResults[0];
      if (result.id !== query.id || result.status?.httpCode !== 200 || !Array.isArray(result.items)) throw new Error('shape');
      const total = result.metadata?.totalHits;
      if (!Number.isInteger(total) || total < 0 || total > 10000 || result.metadata.start !== query.start || result.items.length > query.limit) throw new Error('bounds');
      if (state.expectedCount !== null && total !== state.expectedCount) throw new Error('changed');
      const incoming = [];
      const incomingIds = new Set();
      for (const item of result.items) {
        const filename = typeof item.assetName === 'string' ? item.assetName.trim().normalize('NFC') : '';
        if (typeof item.id!=='string' || !/^[\w-]{1,200}$/.test(item.id) || incomingIds.has(item.id) || !filename || filename.length > 255 || /[\x00-\x1f/\\]/.test(filename) || !/\.(?:jpe?g|png|heic|heif|webp|avif|tiff?|dng|cr[23]|nef|arw|raf|orf|rw2|pef|srw|mp4|mov|m4v|avi|mts)$/i.test(filename)) throw new Error('filename');
        incomingIds.add(item.id);
        const source=new URL(location.href);
        source.pathname=`/libraries/${base[1]}/search/assets/${item.id}/metadata`;
        source.hash='';
        for(const key of [...source.searchParams.keys()])if(!['panel','q','tab','sortBy','sortDir','flagFilter'].includes(key))source.searchParams.delete(key);
        incoming.push({filename,captureTime:'',sourceUrl:source.href});
      }
      // Validate the complete response before adding any of its records.
      for (const record of incoming) {
        const previous=records.get(record.sourceUrl);
        if (previous && previous.filename !== record.filename) throw new Error('changed');
      }
      state.expectedCount=total;
      querySignature=query.signature;
      for (const record of incoming) records.set(record.sourceUrl,record);
      pages.set(query.start,result.items.length);
      if (records.size > total) throw new Error('changed');
      let position=0;
      while (pages.has(position) && pages.get(position)>0) position+=pages.get(position);
      state.phase = position === total && records.size === total ? 'captured' : 'partial';
      if (state.phase==='captured') cleanup();
    } catch { fail('Lightroom returned an unsupported or changing batch. Nothing from this capture has been saved. Refresh the rejected view and try again.'); }
  }
  function observedFetch(input, init) {
    const result = originalFetch.apply(this,arguments);
    if (closed) return result;
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const method = init?.method || input?.method || 'GET';
    // This endpoint's observed page request supplies a JSON string body.
    const query = requestQuery(url,method,init?.body);
    if (query) result.then(async response => {
      if (closed) return;
      if (!response.ok) { fail('Lightroom could not load the rejected photos. Try collection again after the page recovers.'); return; }
      const copy=response.clone();
      const body=await copy.text();
      if (body.length>5_000_000) { fail('This batch is too large. Filter Lightroom to a smaller event and try again.'); return; }
      receive(query,JSON.parse(body));
    }).catch(error=>{ console.error('observe-reject-response Lightroom attempt=1',error.name,'status=unknown');fail('Lightroom could not load a readable reject batch. Try collection again.'); });
    return result;
  }
  function observedOpen(method,url) {
    const result=originalOpen.apply(this,arguments);
    requests.set(this,{method,url});
    return result;
  }
  function observedSend(body) {
    const request=requests.get(this);
    const query=request && requestQuery(request.url,request.method,body);
    if (query && !closed) this.addEventListener('load',()=>{
      if (closed) return;
      if (this.status!==200) { fail('Lightroom could not load the rejected photos. Try collection again after the page recovers.'); return; }
      try {
        if (this.responseType==='json') receive(query,this.response);
        else if (!this.responseType || this.responseType==='text') {
          if(this.responseText.length>5_000_000) throw new Error('bounds');
          receive(query,JSON.parse(this.responseText));
        } else fail('Lightroom returned an unsupported reject response. Nothing from this capture has been saved.');
      } catch { fail('Lightroom returned an unreadable reject response. Nothing from this capture has been saved.'); }
    },{once:true});
    return originalSend.apply(this,arguments);
  }
  window.fetch=observedFetch;
  XMLHttpRequest.prototype.open=observedOpen;
  XMLHttpRequest.prototype.send=observedSend;
  timer=setTimeout(()=>{state.phase='expired';state.message='Collection timed out. No new records were saved. Try again from the rejected grid.';cleanup();},Math.min(90_000,pending.expires-Date.now()));
})();

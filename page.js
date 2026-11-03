// Executed in Chrome's isolated content-script world. No private APIs or page state access.
export async function pageOperation(command, options = {}) {
  const host = location.hostname;
  if (command.startsWith('lightroom-network-')) {
    if(host !== 'lightroom.adobe.com') throw new Error('Open Lightroom web before collecting rejects.');
    if(command==='lightroom-network-arm') {
      const url=new URL(location.href);
      const match=url.pathname.match(/^(\/libraries\/[\w-]+)\/(?:search\/)?assets(?:\/[\w-]+(?:\/metadata)?)?\/?$/);
      if(!match) throw new Error('First open the Lightroom Photos grid or photo search results. Collection selects Rejected without changing your search.');
      const key='photoReviewPendingCaptureV1';
      let old;try{old=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
      if(old?.expires>Date.now() || ['waiting','partial'].includes(window.__photoReviewNetworkCapture?.snapshot().phase)) throw new Error('A capture is already running in this tab. Stop it first.');
      window.__photoReviewNetworkCapture?.stop();
      url.pathname=match[1]+'/search/assets';url.hash='';url.searchParams.set('flagFilter','reject');
      sessionStorage.setItem(key,JSON.stringify({id:options.id,path:url.pathname+url.search,expires:Date.now()+90_000}));
      return {url:url.href};
    }
    const reader=window.__photoReviewNetworkCapture;
    if(command==='lightroom-network-stop') {
      sessionStorage.removeItem('photoReviewPendingCaptureV1');
      return reader?.stop() || {phase:'stopped',records:[]};
    }
    if(command==='lightroom-network-read') {
      const state=reader?.snapshot();
      return state?.id===options.id ? state : {phase:'waiting',records:[],expectedCount:null};
    }
    throw new Error('This operation is not supported.');
  }
  const visible = el => Boolean(el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const nameRE = /\.(?:jpe?g|png|heic|heif|webp|avif|tiff?|dng|cr[23]|nef|arw|raf|orf|rw2|pef|srw|mp4|mov|m4v|avi|mts)$/i;
  const filename = value => {
    if (!value) return '';
    let s = value.trim().replace(/^(?:file\s*name|original\s*file\s*name)\s*[:：]\s*/i, '').normalize('NFC');
    return s.length <= 255 && !/[\x00-\x1f/\\]/.test(s) && nameRE.test(s) ? s : '';
  };
  const text = el => (el.innerText || el.textContent || '').trim();
  const elementFilename = el => {
    if (!el) return '';
    if (['INPUT','TEXTAREA'].includes(el.tagName)) {
      return el.readOnly && (el.tagName === 'TEXTAREA' || el.type === 'text') ? filename(el.value) : '';
    }
    return filename(text(el));
  };
  const nodes = (root = document) => [...root.querySelectorAll('[data-filename], [title], [aria-label], img[alt], input[readonly], textarea[readonly], dt, dd, span, p, h1, h2, h3, div')].filter(visible);
  const names = (root = document) => {
    const found = [];
    for (const el of nodes(root)) {
      const values = [el.getAttribute('data-filename'), el.getAttribute('title'), el.getAttribute('aria-label'), el.getAttribute('alt')];
      if ((el.tagName === 'INPUT' && ['text', ''].includes(el.type)) || el.tagName === 'TEXTAREA') {
        if (el.readOnly) values.push(el.value);
      }
      if (el.children.length === 0) values.push(text(el));
      for (const value of values) { const f = filename(value); if (f) found.push({el, filename: f}); }
    }
    return found;
  };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const buttons = () => [...document.querySelectorAll('button,[role="button"],[role="menuitem"]')].filter(visible);
  const buttonName = el => (el.getAttribute('aria-label') || el.getAttribute('title') || text(el)).trim();
  const uniqueButton = re => { const found = buttons().filter(el => re.test(buttonName(el))); return found.length === 1 ? found[0] : null; };
  const waitFor = async find => { for (let i = 0; i < 24; i++) { const el = find(); if (el) return el; await pause(250); } return null; };
  if (command === 'stop') { window.__photoReviewStop = true; return {stopped: true}; }

  if (command === 'lightroom-capture') {
    if (host !== 'lightroom.adobe.com') throw new Error('Open Lightroom web before collecting rejects.');
    if (!options.rejectsConfirmed) throw new Error('First filter Lightroom to rejected photos and confirm the filter.');
    if (window.__photoReviewRunning) throw new Error('A capture is already running in this tab. Stop it first.');
    window.__photoReviewRunning = true; window.__photoReviewStop = false;
    const found = new Map(); let passes = 0, quiet = 0, reason = 'Visible page captured';
    const viewport = [...document.querySelectorAll('main, [role="main"], section, div')].filter(el => visible(el) && /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 100 && el.clientHeight > 200).sort((a,b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0] || document.scrollingElement;
    try {
      const limit = options.scroll ? 60 : 1;
      for (; passes < limit; passes++) {
        if (window.__photoReviewStop) { reason = 'Stopped by you'; break; }
        const before = found.size;
        const entries = names();
        for (const entry of entries) {
          const anchor = entry.el.closest('a[href]');
          const sourceUrl = anchor?.href?.startsWith('https://lightroom.adobe.com/') ? anchor.href : '';
          // Multiple DOM labels can describe one asset. Same filename without an asset URL cannot safely distinguish duplicates.
          const key = entry.filename + '\u0000' + sourceUrl;
          found.set(key, {filename: entry.filename, captureTime: '', sourceUrl});
        }
        if (!options.scroll) break;
        const oldTop = viewport.scrollTop;
        viewport.scrollTop += Math.max(200, viewport.clientHeight * 0.75);
        await pause(700);
        quiet = found.size === before && viewport.scrollTop === oldTop ? quiet + 1 : 0;
        if (quiet >= 3) { reason = 'No further scroll progress; completeness is not guaranteed'; break; }
        reason = '60-step scan limit reached; continue from the current scroll position';
      }
      return {records: [...found.values()], passes: passes + 1, reason, url: location.origin + location.pathname, incomplete: true};
    } finally { window.__photoReviewRunning = false; }
  }

  const currentUrl = () => location.origin + location.pathname.replace(/\/$/, '');
  const infoNames = () => {
    // Never let a filename on a background thumbnail qualify the open photo.
    const panels = [...document.querySelectorAll('aside,[role="complementary"],[role="region"]')].filter(el => visible(el) && /^(Info|Photo info|Photo information|Details)$/i.test(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')?.split(' ').map(id => document.getElementById(id)?.textContent || '').join(' ') || ''));
    if (panels.length === 1) return [...new Set(names(panels[0]).map(r => r.filename))];
    const picked = window.__photoReviewPicked;
    if (picked && picked.url === currentUrl() && picked.el.isConnected && visible(picked.el) && elementFilename(picked.el) === picked.filename) return [picked.filename];
    return [];
  };
  if (command === 'google-pick-name' || command === 'lightroom-pick-name') {
    const lightroom = command === 'lightroom-pick-name';
    if (host !== (lightroom ? 'lightroom.adobe.com' : 'photos.google.com')) throw new Error('Open the matching service tab before choosing a filename.');
    if (lightroom && !options.rejectsConfirmed) throw new Error('First filter Lightroom to rejected photos and confirm the filter.');
    if (!lightroom && !/^\/(?:u\/\d+\/)?(?:album\/[^/]+\/)?photo\/[^/]+\/?$/.test(location.pathname)) throw new Error('Open an individual Google Photos photo and its Info panel first.');
    if (window.__photoReviewPicking) throw new Error('A filename picker is already open. Click the filename or press Escape in Google Photos.');
    window.__photoReviewPicking = true;
    const url = currentUrl();
    const banner = document.createElement('div');
    banner.textContent = 'Photo Review Bridge: click the original filename in Info. Escape cancels.';
    banner.setAttribute('role', 'status');
    Object.assign(banner.style, {position:'fixed',bottom:'24px',left:'24px',zIndex:'2147483647',padding:'14px 20px',background:'#205b43',color:'#fff',font:'15px system-ui',borderRadius:'6px',pointerEvents:'none'});
    document.body.append(banner);
    return await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); banner.remove(); document.removeEventListener('click', click, true); document.removeEventListener('keydown', key, true); window.__photoReviewPicking = false; };
      const click = event => {
        event.preventDefault(); event.stopImmediatePropagation();
        const el = event.target.closest('input,textarea,span,p,div,dd,h1,h2,h3');
        const f = elementFilename(el);
        if (!f) { banner.textContent = 'Click only the filename text (for example IMG_1234.JPG), or press Escape.'; return; }
        if (currentUrl() !== url) { cleanup(); reject(new Error('That photo changed. Start the filename picker again.')); return; }
        window.__photoReviewPicked = {url, filename:f, el}; cleanup();
        resolve(lightroom ? {records:[{filename:f,captureTime:'',sourceUrl:url}],reason:'Filename chosen by you'} : {url, filenames:[f]});
      };
      const key = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cleanup(); reject(new Error('Capture cancelled. Your manifest is unchanged.')); } };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Capture timed out. Start again and click the filename in Google Photos.')); }, 45000);
      document.addEventListener('click', click, true); document.addEventListener('keydown', key, true);
    });
  }
  if (command === 'lightroom-diagnostics') {
    if (host !== 'lightroom.adobe.com') throw new Error('Open Lightroom web first.');
    // Instrumentation only: capture still uses the unchanged document reader.
    // Report structure and counts, never filenames, field values or page text.
    const roots = [document];
    for (let i = 0; i < roots.length; i++) {
      for (const el of roots[i].querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
    }
    const shadowEntries = roots.slice(1).flatMap(root => names(root));
    const structures = new Map();
    for (const {el} of shadowEntries) {
      const shape = {tag:el.tagName, parent:el.parentElement?.tagName || '', shadowHost:el.getRootNode().host.tagName, attributes:['data-filename','title','aria-label','alt'].filter(attr=>filename(el.getAttribute(attr))), readonly:Boolean(el.readOnly), leaf:el.children.length===0};
      structures.set(JSON.stringify(shape), shape);
    }
    return {readerVersion:'0.2.0', diagnosticVersion:2, visibleElements:nodes().length, readableFilenames:new Set(names().map(r=>r.filename)).size, readonlyTextFields:[...document.querySelectorAll('input[readonly],textarea[readonly]')].filter(el=>visible(el) && (el.tagName==='TEXTAREA' || el.type==='text')).length, frames:document.querySelectorAll('iframe').length, openShadowRoots:roots.length-1, shadowReadableFilenames:new Set(shadowEntries.map(r=>r.filename)).size, filenameStructures:[...structures.values()].slice(0,20)};
  }
  if (host !== 'photos.google.com') throw new Error('Use a Google Photos tab for this step.');
  if (command === 'google-read') {
    return {url: currentUrl(), filenames: infoNames()};
  }
  if (command === 'google-album') {
    // Require the exact human-approved URL and visible original filename immediately before the write.
    const filenames = infoNames();
    if (currentUrl() !== options.url || filenames.length !== 1 || filenames[0] !== options.filename) {
      throw new Error('The photo or its Info panel changed. Reopen the approved photo and its Info panel before adding it.');
    }
    if (!options.album?.trim()) throw new Error('Enter the exact name of an existing review album.');
    if (/^(New album|New shared album|Create album|Create shared album)$/i.test(options.album.trim())) throw new Error('Choose an existing album with a name distinct from Google Photos menu commands.');
    let add = uniqueButton(/^Add to album$/i);
    if (!add) {
      const more = uniqueButton(/^(More options|More)$/i);
      if (!more) throw new Error('Could not identify a unique album control. Use Google Photos to add this item manually.');
      more.click();
      add = await waitFor(() => uniqueButton(/^Add to album$/i));
    }
    if (!add) throw new Error('The Add to album menu is unavailable. Add the photo manually; nothing was deleted.');
    add.click();
    const album = await waitFor(() => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
      if (dialogs.length !== 1) return null;
      const rows = [...dialogs[0].querySelectorAll('button,[role="button"],[role="option"],[role="listitem"]')].filter(el => visible(el) && (buttonName(el) === options.album.trim() || text(el) === options.album.trim()));
      return rows.length === 1 ? rows[0] : null;
    });
    if (!album) throw new Error('Could not identify that album unambiguously. Select it manually in the open dialog.');
    if (currentUrl() !== options.url) throw new Error('That photo changed while the album menu was open. Nothing further was clicked.');
    album.click();
    // Do not claim successful placement from a click alone.
    return {requested: true, message: 'Album placement requested. Verify the photo is in the album, then mark it done.'};
  }
  throw new Error('This operation is not supported.');
}

/* Runs only on Google Photos, in the extension's isolated world. */
(() => {
  if(globalThis.__photoReviewHUD){globalThis.__photoReviewHUD.show();return;}
  const C=globalThis.PhotoReviewHUDCore;
  const host=document.createElement('div');host.id='photo-review-hud';
  const root=host.attachShadow({mode:'open'});
  const paths={refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',settings:'<path d="M3 6h5m4 0h9M3 12h9m4 0h5M3 18h3m4 0h11"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',check:'<path d="m5 12 4 4L19 6"/>',cross:'<path d="m6 6 12 12M18 6 6 18"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',hide:'<path d="m6 9 6 6 6-6"/>',pin:'<path d="m9 3 6 0-1 6 4 4H6l4-4ZM12 13v8"/>',compare:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'};
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
  root.innerHTML=`<style>
    :host{all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;color-scheme:light dark;font:13px/1.4 system-ui,sans-serif;--surface:255 255 255;--ink:#18261e;--muted:#3e4e43;--line:#9dad9f;--control:#fff;--hover:#edf3ef;--accent:#225b3c;--pressed:#fff;--active-hover:#17472c;--focus:#276bbc;--error:#a02620;--link:#225b3c;--panel-alpha:1;color:var(--ink)}
    *{box-sizing:border-box}[hidden]{display:none!important}::selection{background:var(--accent);color:var(--pressed)}
    section{width:300px;max-width:calc(100vw - 24px);max-height:calc(100vh - 32px);overflow:auto;background:rgb(var(--surface)/var(--panel-alpha));border:1px solid var(--line);border-radius:12px;padding:12px;scrollbar-color:var(--line) transparent}
    header,.row{display:flex;align-items:center;gap:6px}header{justify-content:space-between;margin-bottom:8px}h2{font-size:14px;line-height:1.3;margin:0;font-weight:650}p{margin:6px 0}small,.hint{font-size:11px;color:var(--muted)}.hint{margin:6px 0 8px}
    button,input,select{font:inherit;color:inherit;accent-color:var(--accent)}button{min-height:34px;padding:6px 9px;border:1px solid var(--line);background:var(--control);border-radius:6px;cursor:pointer}button:hover{background:var(--hover)}button[aria-pressed=true],.primary{background:var(--accent);color:var(--pressed);border-color:var(--accent)}button.primary:hover,button[aria-pressed=true]:hover{background:var(--active-hover);color:var(--pressed)}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
    input,select{width:100%;padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--control);min-height:34px}input{caret-color:var(--ink)}label{display:block;font-weight:600;margin:8px 0 4px}.row>*{flex:1}#close,#expand{min-width:34px}#close{font-size:11px;padding:4px 6px;min-height:28px}#expand{background:var(--accent);color:var(--pressed)}
    #photo{font-size:12px;margin:2px 0 7px;color:var(--muted)}#message{font-size:11px;min-height:15px;margin:7px 0 0;overflow-wrap:anywhere}#message:empty{display:none}#message.error{color:var(--error)}#decisions{gap:4px}#decisions button{padding:6px 5px;font-size:12px}#decisions kbd{font-size:10px;margin-left:3px;opacity:.85}kbd{font:inherit;font-weight:600}
    #rating-buttons{display:flex;gap:4px}#rating-buttons button{flex:1;padding:5px;min-width:0}#rating-label{font-size:11px;color:var(--muted);margin:8px 0 4px}#selection{padding-top:1px}#select{width:100%;margin-top:4px}summary{cursor:pointer;margin-top:9px;font-size:12px;font-weight:600}#saved{max-height:180px;overflow:auto;margin:8px 0;padding-left:18px}#saved a{color:var(--link);text-underline-offset:3px;overflow-wrap:anywhere}#saved li{margin:7px 0}#library-line{font-size:12px;overflow-wrap:anywhere;margin-top:8px}#change{min-height:28px;padding:3px 6px;font-size:11px}#library-line span{font-weight:600}details .row{margin-top:8px}#backup{font-size:11px}
    fieldset{padding:0;margin:9px 0 0;border:0}legend{font-size:11px;font-weight:600;margin-bottom:4px}#rating-filters,#decision-filters{display:flex;flex-wrap:wrap;gap:4px}#rating-filters label,#decision-filters label{display:flex;align-items:center;gap:3px;min-height:32px;margin:0;padding:3px 4px;font-size:12px;font-weight:400;cursor:pointer}#rating-filters input,#decision-filters input{width:14px;height:14px;min-height:0;margin:0;padding:0}#opacity{padding:0;border:0;width:100%;background:transparent}#opacity-label{display:flex;justify-content:space-between;font-size:12px}#shortcuts{margin:8px 0;padding:0;list-style:none;color:var(--muted);font-size:12px}#shortcuts li{margin:5px 0}#native-nav{font-size:11px;color:var(--muted);margin:7px 0 0}
    svg{width:17px;height:17px;flex:none;pointer-events:none}.header-actions{display:flex;gap:5px}.icon-button{width:32px;min-height:30px;display:inline-flex;align-items:center;justify-content:center;padding:5px}#decisions button,#rating-buttons button,#compare-controls button{display:flex;align-items:center;justify-content:center;gap:5px}#rating-buttons button.rated svg{fill:currentColor}#compare-controls{margin-top:10px}#compare-controls button{font-size:11px;padding:5px;min-width:0}#compare-controls button svg{width:14px;height:14px}#hud-library{margin:7px 0 0}#quick-library{font-size:11px;min-height:28px;padding:4px}#reset-confirm{margin-top:10px;padding-top:4px}#reset-description{font-weight:600}#pin-diagnostics{width:100%;height:130px;font-size:11px;color:var(--ink);background:var(--control);border:1px solid var(--line);border-radius:6px;margin-top:6px}#copy-pin-diagnostics{font-size:11px;margin-top:6px}#reset-feedback:empty,#delete-feedback:empty{display:none}#delete-confirm{margin-top:10px}#delete-description{font-weight:600}#ratings-only{font-size:11px;min-height:28px;margin-top:4px}
    .large-panel{position:fixed;top:20px;right:20px;bottom:20px;width:500px;max-width:calc(100vw - 40px);display:flex;flex-direction:column;background:rgb(var(--surface));border:1px solid var(--line);border-radius:12px;color:var(--ink);overflow:hidden}.panel-header{flex:none;margin:0;padding:18px 20px;border-bottom:1px solid var(--line);align-items:flex-start}.panel-header h2{font-size:20px}.panel-header p{margin:5px 0 0}.panel-body{overflow:auto;padding:0 20px 20px;scrollbar-color:var(--line) transparent}.settings-group{padding-top:18px}.settings-group h3{font-size:14px;margin:0 0 8px}.settings-group p{font-size:13px}.settings-group .hint{font-size:12px}.settings-group label{font-size:12px}#settings-library{min-width:0}#settings-library-form .row button{flex:0 0 auto}.panel-message{font-size:12px;overflow-wrap:anywhere}.panel-message.error{color:var(--error)}#shortcuts{font-size:13px;line-height:1.6}#settings-panel .icon-button,#compare-panel .icon-button{min-width:36px;min-height:36px}
    #compare-panel{left:20px;width:auto;max-width:none}#compare-panel .compare-toolbar{flex:none;display:flex;align-items:center;gap:12px;padding:12px 20px}#compare-panel .compare-toolbar .row{width:290px}#compare-stage{position:relative;display:flex;gap:16px;flex:1;min-height:0;padding:0 20px}#compare-stage figure{position:relative;margin:0;flex:1;min-width:0;display:flex;align-items:center;justify-content:center;background:var(--control);border-radius:8px;overflow:hidden}#compare-stage figcaption{position:absolute;top:10px;left:10px;padding:4px 8px;background:rgb(var(--surface));border-radius:4px;font-size:12px;z-index:1}#compare-stage img{width:100%;height:100%;object-fit:contain;display:block}#compare-stage.overlay{display:block;margin:0 20px;padding:0}#compare-stage.overlay figure{position:absolute;inset:0}#compare-stage.overlay #figure-b{visibility:hidden}#compare-stage.overlay.show-b #figure-b{visibility:visible}#compare-panel footer{padding:12px 20px;flex:none}#compare-panel footer button{font-size:12px}
    @media(max-width:600px){.large-panel{top:12px;right:12px;bottom:12px;max-width:calc(100vw - 24px)}#compare-panel{left:12px}#compare-panel .compare-toolbar{flex-wrap:wrap;padding:10px}#compare-panel .compare-toolbar .row{width:100%}#compare-stage{padding:0 10px;gap:8px}#compare-stage.overlay{margin:0 10px}#compare-panel footer{padding:10px}.panel-header{padding:14px}.panel-body{padding:0 14px 14px}}
    #refresh-plugin{position:relative}#refresh-plugin[data-update="true"]::after{content:"";position:absolute;right:3px;top:3px;width:7px;height:7px;border-radius:50%;background:var(--accent)}
    @media(prefers-color-scheme:dark){:host{--surface:23 29 25;--ink:#f1f6f2;--muted:#d1dcd4;--line:#6e8174;--control:#28382e;--hover:#35493c;--accent:#b0d8bc;--pressed:#102b1c;--active-hover:#c5e6ce;--focus:#9dc3ff;--error:#ffb9b1;--link:#b0d8bc}}
    @media(prefers-reduced-transparency:reduce){section{background:rgb(var(--surface))}}
    @media(forced-colors:active){section{background:Canvas;color:CanvasText;border-color:CanvasText}button{forced-color-adjust:auto}}
    @media(max-width:480px){:host{right:12px;bottom:12px}section{padding:10px;width:290px}}
    @media(prefers-reduced-motion:no-preference){section{animation:appear .16s ease-out}@keyframes appear{from{transform:translateY(6px)}to{transform:translateY(0)}}}
  </style>
  <button id="expand" hidden aria-label="Show Photo Review HUD (H)">Photo Review · H</button>
  <section id="hud-panel" aria-label="Photo Review HUD">
    <header><h2>Photo Review <small id="version"></small></h2><div class="header-actions"><button id="refresh-plugin" class="icon-button" hidden aria-label="Refresh plugin and this tab" title="Apply local files and refresh this tab. Clears temporary pins and Google selection; saved reviews stay.">${icon('refresh')}</button><button id="settings" class="icon-button" aria-label="Open settings" title="Settings (?)" aria-controls="settings-panel" aria-expanded="false">${icon('settings')}</button><button id="close" class="icon-button" aria-label="Minimize Photo Review HUD (H)" title="Hide (H)">${icon('hide')}</button></div></header>
    <form id="setup"><label for="library">Name this local review library</label><p class="hint">For example, Personal. Use a different name for each Google account. Reviews stay in this browser.</p><div class="row"><input id="library" maxlength="60" placeholder="Personal" required><button class="primary" type="submit">Use library</button></div></form>
    <div id="workspace" hidden>
      <div id="review-controls"><p id="photo">Open a photo to review it.</p>
      <div id="decisions" class="row" role="group" aria-label="Review decision"><button data-decision="accept" aria-pressed="false" aria-keyshortcuts="A" title="Accept (A). Activate again to clear.">${icon('check')}<span>Accept <kbd>A</kbd></span></button><button data-decision="reject" aria-pressed="false" aria-keyshortcuts="R" title="Reject (R). Activate again to clear.">${icon('cross')}<span>Reject <kbd>R</kbd></span></button></div>
      <p id="rating-label">Rating · click again to clear</p><div id="rating-buttons" role="group" aria-labelledby="rating-label">${[1,2,3,4,5].map(n=>`<button data-stars="${n}" aria-label="${n} ${n===1?'star':'stars'}; activate again to clear" aria-keyshortcuts="${n}" aria-pressed="false" title="${n} stars (${n}). Activate again to clear.">${icon('star')}<span>${n}</span></button>`).join('')}</div>
      <p id="native-nav">Left / Right: Google Photos navigation · ? settings</p></div>
      <div id="compare-controls" class="row" aria-label="Pin photos for comparison"><button id="pin-a" title="Pin the currently visible photo as A">${icon('pin')}<span>Pin A</span></button><button id="pin-b" title="Pin the currently visible photo as B">${icon('pin')}<span>Pin B</span></button><button id="compare-open" title="Compare pinned photos">${icon('compare')}<span>Compare</span></button></div>
      <button id="copy-pin-diagnostics" hidden>Copy pin details</button><textarea id="pin-diagnostics" aria-label="Redacted pin details" readonly hidden></textarea>
      <div id="hud-library"><select id="quick-library" aria-label="Local review library"></select></div>
      <div id="selection"><fieldset><legend>Decision · optional</legend><div id="decision-filters"><label><input type="checkbox" value="accept">Accepted</label><label><input type="checkbox" value="reject" checked>Rejected</label><label><input type="checkbox" value="unreviewed">Unreviewed</label></div><button id="ratings-only">Ratings only</button><p id="decision-help" class="hint">No decisions checked means any decision.</p></fieldset>
      <fieldset><legend>Ratings · combine any</legend><div id="rating-filters"><label><input type="checkbox" value="0" checked>Unrated</label><label><input type="checkbox" value="1" checked>1</label><label><input type="checkbox" value="2" checked>2</label><label><input type="checkbox" value="3" checked>3</label><label><input type="checkbox" value="4" checked>4</label><label><input type="checkbox" value="5" checked>5</label></div></fieldset>
      <p id="counts" class="hint"></p><button id="select" class="primary">Select matches & scroll</button><button id="stop" hidden>Stop selection</button><p class="hint">Scans this view up to twice to find matches and checks the count. Existing selections stay; nothing is moved or deleted.</p></div>
      <details id="saved-details"><summary id="saved-title">Saved matches</summary><ol id="saved"></ol><p id="saved-limit" class="hint"></p></details>
    </div>
    <p id="message" role="status" aria-live="polite"></p>
  </section>
  <aside id="settings-panel" class="large-panel" aria-label="Photo Review settings" hidden>
    <header class="panel-header"><div><h2>Settings</h2><p class="hint">Photo Review · saved on this browser</p></div><button id="settings-close" class="icon-button" aria-label="Close settings" title="Return to HUD">${icon('cross')}</button></header>
    <div class="panel-body">
      <div class="settings-group"><h3>Review library</h3><label for="library-select">Choose a saved library</label><select id="library-select"></select><form id="settings-library-form" hidden><label for="settings-library">New library name</label><div class="row"><input id="settings-library" maxlength="60" required placeholder="Personal"><button class="primary" type="submit">Create library</button></div></form><p class="hint">Use a separate name for each Google account. Reviews stay local; Google account order is not a permanent identity.</p><p id="delete-count" class="hint"></p><button id="delete-library">Delete library…</button><p id="delete-feedback" class="panel-message"></p><div id="delete-confirm" hidden><p id="delete-description"></p><p class="hint">Permanently removes this local library, all saved review values and photo links. No Undo. Export first if needed. Google Photos and other libraries stay unchanged.</p><div class="row"><button id="delete-cancel">Cancel</button><button id="delete-apply">Delete library permanently</button></div></div></div>
      <div class="settings-group"><h3>Start another review round</h3><p id="reset-count" class="hint"></p><p id="reset-feedback" class="panel-message"></p><button id="clear-reviews">Clear this round’s reviews</button><div id="reset-confirm" hidden><p id="reset-description"></p><p class="hint">Accept/Reject decisions and all ratings will be cleared. Photo links and the library stay; Google Photos and its current selection are unchanged. Export a backup first if you want to keep this round.</p><div class="row"><button id="reset-cancel">Cancel</button><button id="reset-apply">Clear reviews</button></div></div></div>
      <div class="settings-group"><h3>Appearance</h3><label id="opacity-label" for="opacity">HUD background opacity <output id="opacity-value"></output></label><input id="opacity" type="range"><p class="hint">Follows system light/dark mode. Text and this settings panel stay solid. Opacity is saved on this browser.</p></div>
      <div class="settings-group"><h3>Keyboard &amp; review</h3><ul id="shortcuts"><li><kbd>A</kbd> accept · <kbd>R</kbd> reject · <kbd>U</kbd> clear decision</li><li><kbd>1–5</kbd> rate · <kbd>0</kbd> clear rating</li><li>Choose the same decision or score again to clear it. Other review fields stay unchanged.</li><li><kbd>H</kbd> hide/show HUD · <kbd>?</kbd> open settings</li><li>Left/Right and Escape belong to Google Photos. Typing fields keep their normal keys.</li><li>Review shortcuts pause while settings, comparison or the minimized HUD are open.</li></ul></div>
      <div class="settings-group"><h3>Compare A &amp; B</h3><p>Open a photo and pin A. Navigate to another photo and pin B. Choose Compare for side-by-side or an overlay you can show and hide.</p><p class="hint">Comparison images stay in tab memory and are cleared on reload or when changing libraries. No image data is written to the review backup.</p></div>
      <div class="settings-group"><h3>Local data &amp; backup</h3><p class="hint">Only decisions, ratings and photo links are stored. These reviews do not sync to Google Photos or other browsers.</p><div class="row"><button id="export">Export reviews</button><button id="import">Restore reviews</button><input id="file" type="file" accept="application/json,.json" hidden></div><p id="backup" class="hint">Restore merges this library’s reviews; newer saved decisions win.</p><button id="update">Apply local update</button></div>
      <p id="settings-message" class="panel-message" role="status" aria-live="polite"></p>
    </div>
  </aside>
  <aside id="compare-panel" class="large-panel" aria-label="Compare pinned photos" hidden>
    <header class="panel-header"><div><h2>Compare A &amp; B</h2><p class="hint">Pinned images · this tab only</p></div><button id="compare-close" class="icon-button" aria-label="Close comparison" title="Return to HUD">${icon('cross')}</button></header>
    <div class="compare-toolbar"><div class="row" role="group" aria-label="Comparison layout"><button id="mode-side" aria-pressed="true">Side by side</button><button id="mode-overlay" aria-pressed="false">Overlay</button></div><button id="overlay-toggle" hidden aria-pressed="false">Show B over A</button></div>
    <div id="compare-stage"><figure id="figure-a"><figcaption id="label-a">A</figcaption><img id="image-a" alt="Pinned photo A"></figure><figure id="figure-b"><figcaption id="label-b">B</figcaption><img id="image-b" alt="Pinned photo B"></figure></div>
    <footer><p id="compare-hint" class="hint">Each image is fitted without cropping.</p><button id="compare-clear">Clear pinned images</button><p id="compare-message" class="panel-message" role="status" aria-live="polite"></p></footer>
  </aside>`;
  document.documentElement.append(host);
  const $=id=>root.getElementById(id);
  const slot=()=>location.pathname.match(/^\/u\/(\d+)(?:\/|$)/)?.[1]||'0';
  const scopeKey=()=>`photoReviewHudLibraryV1:${slot()}`;
  const appearance=C.OPACITY;
  let opacity=appearance.default;
  $('opacity').min=String(appearance.min);$('opacity').max=String(appearance.max);$('opacity').step=String(appearance.step);
  function displayOpacity(value){host.style.setProperty('--panel-alpha',String(value/100));$('opacity').value=String(value);$('opacity-value').textContent=`${value}%`;}
  displayOpacity(opacity);
  const decisions=()=>[...root.querySelectorAll('#decision-filters input:checked')].map(input=>input.value);
  const ratings=()=>[...root.querySelectorAll('#rating-filters input:checked')].map(input=>Number(input.value));
  let library='',reviews=new Map(),busy=false,stopping=false,hidden=false,revision=0,loadedSlot=slot(),lastPhoto=location.href,timer,settingsOpen=false,compareOpen=false;
  const pinEpoch={a:0,b:0},pinning={a:false,b:false};
  let pinned={a:null,b:null},compareMode='side',showOverlay=false,libraries=[],creatingLibrary=false,resetSnapshot=null,deleteSnapshot=null;
  const say=(message,error=false)=>{for(const id of ['message','settings-message','compare-message']){$(id).textContent=message;$(id).classList.toggle('error',error);}};
  const log=(operation,error)=>{console.error('photo-review-hud',operation,'chrome/local attempt=1',error.name,'status=unknown');};
  function resetFeedback(message,error=false){$('reset-feedback').textContent=message;$('reset-feedback').classList.toggle('error',error);}
  function deleteFeedback(message,error=false){$('delete-feedback').textContent=message;$('delete-feedback').classList.toggle('error',error);}
  const alive=()=>{try{return Boolean(chrome.runtime?.id);}catch{return false;}};
  function panelVisibility(){
    $('hud-panel').hidden=hidden||settingsOpen||compareOpen;$('settings-panel').hidden=hidden||!settingsOpen;$('compare-panel').hidden=hidden||!compareOpen;$('expand').hidden=!hidden;
    $('settings').setAttribute('aria-expanded',String(settingsOpen&&!hidden));
  }
  function minimize(){hidden=true;settingsOpen=false;compareOpen=false;panelVisibility();}
  function show(){hidden=false;panelVisibility();schedule();}
  function openSettings(create=false){hidden=false;settingsOpen=true;compareOpen=false;creatingLibrary=create;renderLibraryChoices();say('');panelVisibility();(create?$('settings-library'):$('settings-close')).focus();}
  function closeSettings(){settingsOpen=false;panelVisibility();$('settings').focus();}
  $('settings').onclick=()=>openSettings();$('settings-close').onclick=closeSettings;
  globalThis.__photoReviewHUD={show};
  $('version').textContent=`v${chrome.runtime.getManifest().version}`;
  $('close').onclick=minimize;
  $('expand').onclick=show;
  chrome.runtime.onMessage.addListener(message=>{if(message?.type==='hud-show')show();});
  function visible(el){return Boolean(el.getClientRects().length)&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';}
  function cards(){
    const found=new Map();
    for(const anchor of document.querySelectorAll('a[href]')){
      const photo=C.identity(anchor.href,location.href);if(!photo||photo.slot!==slot()||!visible(anchor))continue;
      const list=found.get(photo.id)||[];list.push({anchor,photo});found.set(photo.id,list);
    }
    return found;
  }
  function checkbox(entry){
    let node=entry.anchor;
    for(let depth=0;node&&depth<4;depth++,node=node.parentElement){
      const ids=new Set([...node.querySelectorAll('a[href]'),...(node.matches('a[href]')?[node]:[])].map(a=>C.identity(a.href,location.href)?.id).filter(Boolean));
      if(ids.size!==1||!ids.has(entry.photo.id))return null;
      const checks=[...node.querySelectorAll('[role="checkbox"][aria-checked],input[type="checkbox"]')].filter(visible);
      if(node.matches('[role="checkbox"][aria-checked],input[type="checkbox"]')&&visible(node))checks.push(node);
      if(checks.length===1)return checks[0];
      if(checks.length>1)return null;
    }
    return null;
  }
  const checked=el=>el.matches('input')?el.checked:el.getAttribute('aria-checked')==='true';
  function matchingReviews(selectedDecisions,selectedRatings){return [...reviews.values()].filter(r=>C.matches(r,selectedDecisions,selectedRatings)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));}
  function render(){
    if(resetSnapshot&&!busy&&(resetSnapshot.library!==library||resetSnapshot.stamp!==C.reviewStamp([...reviews.values()]))){resetSnapshot=null;$('reset-confirm').hidden=true;resetFeedback('Reviews changed while confirmation was open. Check the updated count before clearing.',true);say('Reviews changed while confirmation was open. Check the updated count before clearing.',true);}
    $('setup').hidden=Boolean(library);$('workspace').hidden=!library;
    renderLibraryChoices();
    if(deleteSnapshot&&!busy&&(deleteSnapshot.library!==library||deleteSnapshot.stamp!==C.libraryStamp([...reviews.values()]))){deleteSnapshot=null;$('delete-confirm').hidden=true;deleteFeedback('This library changed. Check the updated count before deleting.',true);}
    $('delete-count').textContent=library?`${reviews.size} saved photo links in “${library}”. This is local text metadata, not photo files.`:'Choose a library to manage its saved data.';
    $('delete-library').disabled=busy||!library;$('delete-apply').disabled=busy;$('delete-cancel').disabled=busy;
    const active=C.activeReviews([...reviews.values()]);$('reset-count').textContent=library?`${active.length} reviewed photo${active.length===1?'':'s'} in “${library}”. Clears this whole library, regardless of filters.`:'Choose a library to start a new round.';
    $('clear-reviews').disabled=busy||!library||!active.length;$('reset-apply').disabled=busy;$('reset-cancel').disabled=busy;
    $('quick-library').disabled=busy;$('library-select').disabled=busy;
    $('pin-a').disabled=busy||pinning.a||!C.identity(location.href);$('pin-b').disabled=busy||pinning.b||!C.identity(location.href);$('compare-open').disabled=busy||!pinned.a||!pinned.b;
    $('pin-a').querySelector('span').textContent=pinning.a?'Pinning A…':pinned.a?'A pinned':'Pin A';$('pin-b').querySelector('span').textContent=pinning.b?'Pinning B…':pinned.b?'B pinned':'Pin B';
    const photo=C.identity(location.href),value=photo&&reviews.get(photo.id);
    $('pin-a').hidden=!photo;$('pin-b').hidden=!photo;$('compare-controls').hidden=!photo&&(!pinned.a||!pinned.b);
    $('review-controls').hidden=!photo;$('selection').hidden=Boolean(photo);$('saved-details').hidden=Boolean(photo);
    $('photo').textContent=photo?`${value?.decision==='accept'?'Accepted':value?.decision==='reject'?'Rejected':'Unreviewed'} · ${value?.stars?`${value.stars} stars`:'No rating'}`:'Open a photo to review it.';
    $('photo').title=photo?`Photo ${photo.id}`:'';
    for(const button of root.querySelectorAll('[data-decision]')){button.disabled=busy||!photo;button.setAttribute('aria-pressed',String(Boolean(photo)&&(value?.decision||'unreviewed')===button.dataset.decision));}
    for(const button of root.querySelectorAll('[data-stars]')){button.disabled=busy||!photo;button.setAttribute('aria-pressed',String(Boolean(photo)&&(value?.stars||0)===Number(button.dataset.stars)));button.classList.toggle('rated',Boolean(photo)&&Number(button.dataset.stars)<=(value?.stars||0));}
    $('settings-library-form').querySelector('button').disabled=busy;$('refresh-plugin').disabled=busy||refreshing;for(const input of root.querySelectorAll('#rating-filters input,#decision-filters input'))input.disabled=busy;$('export').disabled=busy;$('import').disabled=busy;$('update').disabled=busy||refreshing;
    const selectedDecisions=decisions(),selectedRatings=ratings(),matches=matchingReviews(selectedDecisions,selectedRatings),grid=cards(),loaded=[...grid].filter(([id])=>C.matches(reviews.get(id),selectedDecisions,selectedRatings));
    $('counts').textContent=`${matches.length} saved matches · ${loaded.length} matches in the loaded grid`;
    $('select').disabled=busy||Boolean(photo)||!selectedRatings.length||(!loaded.length&&!matches.length);$('stop').hidden=!busy;
    $('saved-title').textContent=`Saved matches (${matches.length})`;$('saved').replaceChildren();
    for(const value of matches.slice(0,100)){
      const li=document.createElement('li'),a=document.createElement('a');
      const url=new URL(value.url);url.pathname=url.pathname.replace(/^\/u\/\d+\//,`/u/${slot()}/`);
      a.href=url.href;a.textContent=`${value.decision} · ${value.stars?`${value.stars} stars`:'No rating'} · ${value.id.slice(-10)}`;li.append(a);$('saved').append(li);
    }
    $('saved-limit').textContent=matches.length>100?'Showing the latest 100 saved matches. Export includes all saved reviews.':matches.length?'Open a saved link to revisit a photo.':'No saved reviews match these filters yet.';
  }
  async function load(){
    const generation=++revision;
    try{
      const saved=await chrome.storage.local.get(null);if(generation!==revision)return;
      opacity=C.validOpacity(saved[appearance.key])?saved[appearance.key]:appearance.default;displayOpacity(opacity);
      if(saved[appearance.key]!==undefined&&!C.validOpacity(saved[appearance.key]))say('The saved opacity was invalid. Using the default until you change it.',true);
      libraries=C.libraryNames(saved);
      const previousLibrary=library;
      library=typeof saved[scopeKey()]==='string'?C.libraryName(saved[scopeKey()]):'';
      if(previousLibrary&&previousLibrary!==library){releasePins();if(compareOpen){compareOpen=false;panelVisibility();}}
      reviews=new Map();for(const [key,value]of Object.entries(saved))if(key.startsWith(C.PREFIX)){
        try{const r=C.record(value);if(r.library===library&&key===C.key(r.library,r.id))reviews.set(r.id,r);}catch{}
      }
      render();
    }catch(error){log('load',error);say('Your reviews could not load. Reload this Google Photos tab; saved data has not been cleared.',true);}
  }
  function renderLibraryChoices(){
    for(const id of ['quick-library','library-select']){
      const select=$(id),signature=JSON.stringify(libraries);
      if(select.dataset.libraries!==signature){
        select.replaceChildren();
        for(const name of libraries){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}
        const option=document.createElement('option');option.value='';option.textContent='New review library…';select.append(option);select.dataset.libraries=signature;
      }
      const value=id==='library-select'&&creatingLibrary?'':library;if(select.value!==value)select.value=value;
    }
    $('settings-library-form').hidden=!creatingLibrary&&Boolean(library);
  }
  async function changeLibrary(raw){
    if(busy)return;busy=true;render();
    try{const name=C.libraryName(raw),result=await chrome.runtime.sendMessage({type:'hud-use-library',library:name});if(!result?.ok)throw new Error('LibrarySaveFailed');creatingLibrary=false;resetSnapshot=null;deleteSnapshot=null;$('reset-confirm').hidden=true;$('delete-confirm').hidden=true;resetFeedback('');deleteFeedback('');await load();$('settings-library').value='';say('Review library ready. Its saved reviews are restored.');}
    catch(error){log('choose-library',error);say('Could not choose that library. Use a name between 1 and 60 characters and try again.',true);}
    finally{busy=false;render();}
  }
  $('setup').onsubmit=event=>{event.preventDefault();changeLibrary($('library').value);};
  $('settings-library-form').onsubmit=event=>{event.preventDefault();changeLibrary($('settings-library').value);};
  $('quick-library').onchange=()=>{if($('quick-library').value)changeLibrary($('quick-library').value);else openSettings(true);};
  $('library-select').onchange=()=>{if($('library-select').value)changeLibrary($('library-select').value);else{creatingLibrary=true;$('settings-library-form').hidden=false;$('settings-library').focus();}};
  $('clear-reviews').onclick=()=>{
    if(busy||!library)return;const active=C.activeReviews([...reviews.values()]);if(!active.length)return;
    resetFeedback('');resetSnapshot={library,stamp:C.reviewStamp([...reviews.values()])};$('reset-description').textContent=`Clear reviews for ${active.length} photo${active.length===1?'':'s'} in “${library}” and start a new round?`;$('reset-confirm').hidden=false;$('reset-cancel').focus();
  };
  $('reset-cancel').onclick=()=>{resetSnapshot=null;$('reset-confirm').hidden=true;$('clear-reviews').focus();};
  $('reset-apply').onclick=async()=>{
    if(busy||!resetSnapshot)return;const request=resetSnapshot;busy=true;render();
    try{const result=await chrome.runtime.sendMessage({type:'hud-clear-reviews',library:request.library,stamp:request.stamp});if(!result?.ok)throw new Error('ResetFailed');resetSnapshot=null;$('reset-confirm').hidden=true;releasePins();await load();resetFeedback(`Cleared reviews for ${result.count} ${result.count===1?'photo':'photos'}. This library is ready for a new round.`);say(`Cleared reviews for ${result.count} ${result.count===1?'photo':'photos'}. This library is ready for a new round.`);}
    catch(error){log('clear-reviews',error);resetSnapshot=null;$('reset-confirm').hidden=true;await load();resetFeedback('Could not clear these reviews, or they changed in another tab. Check the count and try again; existing reviews were kept.',true);say('Could not clear these reviews, or they changed in another tab. Check the count and try again; existing reviews were kept.',true);}
    finally{busy=false;render();}
  };
  $('delete-library').onclick=()=>{
    if(busy||!library)return;deleteFeedback('');deleteSnapshot={library,stamp:C.libraryStamp([...reviews.values()])};$('delete-description').textContent=`Delete “${library}” and its ${reviews.size} saved photo ${reviews.size===1?'link':'links'}?`;$('delete-confirm').hidden=false;$('delete-cancel').focus();
  };
  $('delete-cancel').onclick=()=>{deleteSnapshot=null;$('delete-confirm').hidden=true;$('delete-library').focus();};
  $('delete-apply').onclick=async()=>{
    if(busy||!deleteSnapshot)return;const request=deleteSnapshot;busy=true;render();
    try{const result=await chrome.runtime.sendMessage({type:'hud-delete-library',library:request.library,stamp:request.stamp});if(!result?.ok)throw new Error('DeleteFailed');deleteSnapshot=null;resetSnapshot=null;$('delete-confirm').hidden=true;$('reset-confirm').hidden=true;releasePins();await load();const size=Number.isFinite(result.bytes)?` Removed ${result.bytes<1024?`${result.bytes} bytes`:`${(result.bytes/1024).toFixed(1)} KB`} of library data.`:'';deleteFeedback(`Deleted “${request.library}”.${size} Choose another library or create one.`);say(`Deleted local library “${request.library}”. Google Photos is unchanged.`);}
    catch(error){log('delete-library',error);deleteSnapshot=null;$('delete-confirm').hidden=true;await load();deleteFeedback('Could not delete this library, or it changed. Check its count and try again; saved records were kept.',true);}
    finally{busy=false;render();}
  };
  async function save(patch){
    const photo=C.identity(location.href);if(!library||!photo||busy)return;
    const before=location.href,scope=library;busy=true;render();say('Saving review…');
    try{
      const result=await chrome.runtime.sendMessage({type:'hud-save',library:scope,url:photo.url,patch});
      if(!result?.ok)throw new Error('SaveFailed');
      if(scope===library)reviews.set(photo.id,C.record(result.value));
      say(before===location.href?'Review saved on this browser.':'Review saved for the previous photo.');
    }catch(error){log('save-review',error);say(alive()?'Your review was not saved. Try again; if storage is full, export your reviews first.':'The plugin was updated. Reload this Google Photos tab to continue.',true);}
    finally{busy=false;render();}
  }
  function chooseDecision(decision){const photo=C.identity(location.href),current=photo&&reviews.get(photo.id);return save({decision:decision!=='unreviewed'&&current?.decision===decision?'unreviewed':decision});}
  function chooseStars(stars){const photo=C.identity(location.href),current=photo&&reviews.get(photo.id);return save({stars:stars>0&&current?.stars===stars?0:stars});}
  for(const button of root.querySelectorAll('[data-decision]'))button.onclick=()=>chooseDecision(button.dataset.decision);
  for(const button of root.querySelectorAll('[data-stars]'))button.onclick=()=>chooseStars(Number(button.dataset.stars));
  const filtersChanged=()=>{render();say(!ratings().length?'No ratings selected. Check at least one rating to find photos.':(decisions().length?'Filters updated. Selection scans this view for matching photos.':'Ratings only: matches include any review decision.'));};
  for(const input of root.querySelectorAll('#rating-filters input,#decision-filters input'))input.onchange=filtersChanged;
  $('ratings-only').onclick=()=>{for(const input of root.querySelectorAll('#decision-filters input'))input.checked=false;filtersChanged();};
  $('opacity').oninput=()=>{const value=Number($('opacity').value);if(C.validOpacity(value))displayOpacity(value);};
  $('opacity').onchange=async()=>{
    const value=Number($('opacity').value),previous=opacity;
    if(!C.validOpacity(value)){displayOpacity(previous);say('Choose an opacity between 75% and 100%.',true);return;}
    $('opacity').disabled=true;
    try{await chrome.storage.local.set({[appearance.key]:value});opacity=value;displayOpacity(value);say(`HUD opacity saved at ${value}%.`);}
    catch(error){log('save-opacity',error);displayOpacity(previous);say('Opacity was not saved. Your previous setting has been restored.',true);}
    finally{$('opacity').disabled=false;}
  };
  let pinDetails=null;
  function pinFailure(reason,message,image=null,source=''){
    let version='unavailable';try{version=chrome.runtime.getManifest().version;}catch{}
    pinDetails={pinReader:'source-diagnostics-v1',runtimeVersion:version,reason,source:C.pinSourceShape(source),image:image?{naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight}:null};
    $('copy-pin-diagnostics').hidden=false;say(message+' Use Copy pin details to share the source type without sharing the photo URL.',true);
  }
  $('copy-pin-diagnostics').onclick=async()=>{
    if(!pinDetails)return;const details=JSON.stringify(pinDetails,null,2);
    try{await navigator.clipboard.writeText(details);say('Pin details copied. Paste them into our chat; no photo URL, image, filename or sign-in data is included.');}
    catch{$('pin-diagnostics').value=details;$('pin-diagnostics').hidden=false;$('pin-diagnostics').focus();$('pin-diagnostics').select();say('Copy the selected pin details and paste them into our chat. Photo URLs and sign-in data are excluded.');}
  };
  function clearImages(){for(const id of ['image-a','image-b'])$(id).removeAttribute('src');}
  function releasePins(){for(const which of ['a','b']){pinEpoch[which]++;pinning[which]=false;if(pinned[which]?.owned)URL.revokeObjectURL(pinned[which].src);}pinned={a:null,b:null};clearImages();}
  async function pin(which){
    if(busy||!library)return;const photo=C.identity(location.href);if(!photo)return;
    pinDetails=null;$('copy-pin-diagnostics').hidden=true;$('pin-diagnostics').hidden=true;
    const shown=img=>{const r=img.getBoundingClientRect();return {width:Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left)),height:Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))};};
    const area=img=>{const r=shown(img);return r.width*r.height;};
    const images=[...document.images].filter(img=>{const r=shown(img);return visible(img)&&img.complete&&img.naturalWidth>0&&r.width>=180&&r.height>=120;}).sort((a,b)=>area(b)-area(a));
    const image=images[0];
    if(!image||(images[1]&&area(images[1])>=area(image)*.9)){pinFailure('ambiguous-or-missing-image','Could not identify one visible photo. Open the photo fully and wait for it to load, then pin it again.');return;}
    const source=image.currentSrc||image.src;let parsed;
    try{parsed=new URL(source,location.href);}catch{pinFailure('unusable-source','The visible photo has no usable image source. Reopen it and try again.',image);return;}
    const localBlob=parsed.protocol==='blob:'&&parsed.origin===location.origin;
    const allowed=localBlob||(parsed.protocol==='https:'&&(parsed.hostname.endsWith('.googleusercontent.com')||parsed.hostname==='photos.fife.usercontent.google.com'||parsed.origin===location.origin))||/^data:image\/(?:png|jpeg|webp|svg\+xml)[;,]/i.test(source);
    if(!allowed){log('pin-image',{name:`UnsupportedSource(${parsed.protocol},${parsed.hostname})`});pinFailure('unsupported-source','This visible image source is not supported yet.',image,source);return;}
    const scope=library,ticket=++pinEpoch[which];let src=source,owned=false;pinning[which]=true;render();
    try{
      if(localBlob){
        // Fetch only the already displayed, same-origin browser-memory Blob, never an API URL.
        const response=await fetch(source);if(!response.ok)throw new Error('BlobUnavailable');
        const blob=await response.blob();if(!blob.size)throw new Error('EmptyImage');
        src=URL.createObjectURL(blob);owned=true;
      }
      if(scope!==library||ticket!==pinEpoch[which]){if(owned)URL.revokeObjectURL(src);return;}
      if(pinned[which]?.owned)URL.revokeObjectURL(pinned[which].src);
      pinned[which]={id:photo.id,url:photo.url,src,owned};say(`Photo ${which.toUpperCase()} pinned in this tab. ${pinned.a&&pinned.b?'Choose Compare.':'Navigate to another photo and pin the other slot.'}`);
    }catch(error){log('pin-image',error);pinFailure('temporary-image-copy-failed','That temporary image could not be kept for comparison. Reopen the photo, wait for it to finish loading and pin it again.',image,source);}
    finally{if(ticket===pinEpoch[which])pinning[which]=false;render();}
  }

  function renderComparison(){
    $('mode-side').setAttribute('aria-pressed',String(compareMode==='side'));$('mode-overlay').setAttribute('aria-pressed',String(compareMode==='overlay'));
    $('compare-stage').classList.toggle('overlay',compareMode==='overlay');$('compare-stage').classList.toggle('show-b',showOverlay);
    $('overlay-toggle').hidden=compareMode!=='overlay';$('overlay-toggle').setAttribute('aria-pressed',String(showOverlay));$('overlay-toggle').textContent=showOverlay?'Hide B · show A':'Show B over A';
    $('compare-hint').textContent=compareMode==='overlay'?`Showing ${showOverlay?'B over A':'A'}. Click the image or the button to show/hide B. Images are fitted without cropping.`:'Each image is fitted without cropping. Pinning uses the image currently visible in Google Photos.';
  }
  $('pin-a').onclick=()=>pin('a');$('pin-b').onclick=()=>pin('b');
  $('compare-open').onclick=()=>{
    if(!pinned.a||!pinned.b)return;hidden=false;settingsOpen=false;compareOpen=true;say('');
    for(const which of ['a','b']){$('image-'+which).src=pinned[which].src;$('label-'+which).textContent=`${which.toUpperCase()} · ${pinned[which].id.slice(-10)}`;}
    renderComparison();panelVisibility();$('compare-close').focus();
  };
  $('compare-close').onclick=()=>{compareOpen=false;clearImages();panelVisibility();$('compare-open').focus();};
  $('mode-side').onclick=()=>{compareMode='side';renderComparison();};$('mode-overlay').onclick=()=>{compareMode='overlay';renderComparison();};
  const toggleOverlay=()=>{if(compareMode==='overlay'){showOverlay=!showOverlay;renderComparison();}};
  $('overlay-toggle').onclick=toggleOverlay;$('compare-stage').onclick=toggleOverlay;
  $('compare-clear').onclick=()=>{releasePins();compareOpen=false;panelVisibility();render();say('Pinned images cleared from this tab. Saved reviews were kept.');};
  for(const id of ['image-a','image-b'])$(id).onerror=()=>{log('render-comparison-image',{name:'ImageLoadError'});say(`Pinned image ${id==='image-a'?'A':'B'} is no longer available. Close comparison, reopen that photo and pin it again.`,true);};
  $('stop').onclick=()=>{stopping=true;say('Stopping after the current selection…');};
  function scrollTarget(){
    const anchor=[...cards().values()][0]?.[0]?.anchor;
    for(let node=anchor?.parentElement;node&&node!==document.body;node=node.parentElement){
      if(visible(node)&&node.clientHeight>=120&&node.scrollHeight>node.clientHeight+2&&/auto|scroll/.test(getComputedStyle(node).overflowY))return node;
    }
    const main=document.querySelector('main,[role="main"],[role="grid"]');
    if(main&&visible(main)&&main.scrollHeight>main.clientHeight+2&&/auto|scroll/.test(getComputedStyle(main).overflowY))return main;
    const page=document.scrollingElement;
    return page&&page.scrollHeight>page.clientHeight+2?page:null;
  }
  $('select').onclick=async()=>{
    if(busy||!library||C.identity(location.href))return;
    const selectedDecisions=decisions(),selectedRatings=ratings();if(!selectedRatings.length)return;
    const start=location.href,scope=library,snapshot=new Map(reviews),began=Date.now();
    const targets=new Set([...snapshot.values()].filter(r=>C.matches(r,selectedDecisions,selectedRatings)).map(r=>r.id));
    const openEnded=selectedRatings.includes(0)&&(!selectedDecisions.length||selectedDecisions.includes('unreviewed'));
    if(targets.size>10000){say('Too many matches for one scan. Narrow the review filters and try again.',true);return;}
    const seen=new Set(),added=new Set(),existing=new Set(),unsupported=new Set(),attempted=new Set(),lost=new Set();
    const cancelled=()=>stopping||location.href!==start||library!==scope;
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    let reason='',passes=0,quiet=0,viewPass=1,scroller=null,startedAtTop=false;
    busy=true;stopping=false;render();say(`Selecting matches · 0 of ${targets.size} saved targets confirmed…`);
    try{
      while(passes++<120&&Date.now()-began<120000&&seen.size<10000){
        if(cancelled()){reason='Stopped';break;}
        const beforeSeen=seen.size,grid=cards();
        for(const [id,entries]of grid){
          if(Date.now()-began>=120000||(!seen.has(id)&&seen.size>=10000)){reason='Scan limit reached';break;}
          seen.add(id);if(!C.matches(snapshot.get(id),selectedDecisions,selectedRatings))continue;targets.add(id);
          if(cancelled()){reason='Stopped';break;}
          const control=entries.length===1&&checkbox(entries[0]);
          if(added.has(id)||existing.has(id)){
            if(control&&!checked(control))lost.add(id);
            continue;
          }
          if(!control||control.disabled||control.getAttribute('aria-disabled')==='true'){unsupported.add(id);continue;}
          unsupported.delete(id);
          if(checked(control)){existing.add(id);continue;}
          if(attempted.has(id))continue;
          attempted.add(id);control.click();let confirmed=false;
          for(let attempt=0;attempt<12;attempt++){
            if(cancelled())break;
            const fresh=cards().get(id)||[],check=fresh.length===1&&checkbox(fresh[0]);
            if(check&&checked(check)){confirmed=true;break;}
            await pause(100);
          }
          if(!confirmed){unsupported.add(id);reason=cancelled()?'Stopped':'Stopped after an unconfirmed click';break;}
          added.add(id);say(`Selecting · ${added.size+existing.size} of ${targets.size} targets confirmed · ${seen.size} photos encountered…`);
          await pause(40);
        }
        if(reason||cancelled()){reason=reason||'Stopped';break;}
        if(lost.size){reason='Stopped because some selections changed';break;}
        if(!openEnded&&added.size+existing.size===targets.size){reason='All saved targets confirmed';break;}
        scroller=scrollTarget();
        if(!scroller){reason='No further scrollable photos';break;}
        const oldHeight=scroller.scrollHeight,oldTop=scroller.scrollTop;
        const atBottom=oldTop+scroller.clientHeight>=oldHeight-2;
        const loading=[...document.querySelectorAll('[aria-busy="true"],[role="progressbar"]')].some(visible);
        if(startedAtTop&&atBottom&&seen.size===beforeSeen&&!loading)quiet++;else quiet=0;
        if(quiet>=3){if(viewPass<2){viewPass++;quiet=0;scroller.scrollTop=0;say('Checking this view once more for missing matches…');await pause(250);continue;}reason='Finished two scans of this view';break;}
        if(!startedAtTop){scroller.scrollTop=0;startedAtTop=true;}
        else scroller.scrollTop+=Math.max(180,scroller.clientHeight*.75);
        say(`Loading more photos · ${added.size+existing.size} of ${targets.size} targets confirmed · ${seen.size} encountered…`);
        // Let lazy loading/rendering respond. An uncertain selection click is never retried.
        for(let tick=0;tick<6;tick++){
          await pause(250);if(cancelled())break;
          if(scroller.scrollHeight!==oldHeight||[...cards().keys()].some(id=>!seen.has(id)))break;
        }
      }
      if(!reason)reason=cancelled()?'Stopped':'Scan limit reached';
      const confirmed=added.size+existing.size-lost.size;
      const notAttempted=Math.max(0,targets.size-added.size-existing.size-unsupported.size);
      const missing=[...targets].filter(id=>!seen.has(id)).length;
      say(`${reason}. Count check: ${confirmed} of ${targets.size} target matches confirmed · ${added.size} newly selected · ${existing.size} already selected · ${unsupported.size} unsupported or unconfirmed${notAttempted?` · ${notAttempted} not attempted`:''}${missing?` · ${missing} not found in this view`:''}${lost.size?` · ${lost.size} selections changed`:''}. ${openEnded?'Unrated/unreviewed counts cover encountered photos only. ':''}${confirmed<targets.size?'Partial result; missing photos may be outside this view. ':''}Existing selections were kept.`);
    }catch(error){log('select-grid',error);say(`Selection stopped. Count check: ${added.size+existing.size-lost.size} of ${targets.size} targets confirmed. Check Google Photos before continuing.`,true);}
    finally{busy=false;stopping=false;render();}
  };
  $('export').onclick=()=>{
    try{const blob=new Blob([JSON.stringify({format:'photo-review-hud',version:1,library,reviews:[...reviews.values()]},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='photo-review-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Review backup downloaded. It includes photo links; keep it private.');}
    catch(error){log('export',error);say('The backup could not download. Try again.',true);}
  };
  $('import').onclick=()=>$('file').click();
  $('file').onchange=async()=>{
    const file=$('file').files[0];if(!file||busy)return;busy=true;render();
    try{
      if(file.size>2_000_000)throw new Error('TooLarge');const data=JSON.parse(await file.text());
      if(data.format!=='photo-review-hud'||data.version!==1||data.library!==library||!Array.isArray(data.reviews)||data.reviews.length>10000)throw new Error('InvalidBackup');
      const result=await chrome.runtime.sendMessage({type:'hud-restore',library,reviews:data.reviews});if(!result?.ok)throw new Error('RestoreFailed');await load();say(`Restored ${result.count} reviews. Newer saved decisions were kept.`);
    }catch(error){log('restore',error);say('Backup could not be restored. Use a valid backup for this library, smaller than 2 MB. Existing reviews were kept.',true);}
    finally{$('file').value='';busy=false;render();}
  };
  let refreshing=false,checkingUpdate=false,lastUpdateCheck=0;
  async function applyUpdate(){
    if(busy||refreshing)return;refreshing=true;$('refresh-plugin').disabled=true;$('update').disabled=true;say('Saving reviews and applying local update. This tab will refresh…');
    if(!alive()){location.reload();return;}
    try{const result=await chrome.runtime.sendMessage({type:'hud-reload'});if(!result?.ok)throw new Error('UpdateFailed');}
    catch(error){if(!alive()){location.reload();return;}log('update',error);refreshing=false;$('refresh-plugin').disabled=busy;$('update').disabled=busy||refreshing;say('Open chrome://extensions, reload Photo Review Bridge, then reload this Google Photos tab.',true);}
  }
  $('update').onclick=applyUpdate;$('refresh-plugin').onclick=applyUpdate;
  function markStale(){const button=$('refresh-plugin');button.hidden=true;button.dataset.update='true';button.setAttribute('aria-label','Refresh this tab to load the updated plugin');button.title='Plugin updated in another tab. Click to refresh this tab; saved reviews stay.';$('update').textContent='Refresh this tab';}
  async function checkUpdate(){
    if(checkingUpdate||refreshing||hidden||document.visibilityState==='hidden'||Date.now()-lastUpdateCheck<10000)return;
    if(!alive()){markStale();return;}
    checkingUpdate=true;lastUpdateCheck=Date.now();
    try{const result=await chrome.runtime.sendMessage({type:'hud-check-update'});if(!result?.ok)throw new Error('CheckUnavailable');const button=$('refresh-plugin');button.hidden=!result.available;button.dataset.update=String(result.available);button.setAttribute('aria-label',result.available?`Update to v${result.version} and refresh this tab`:'Refresh plugin and this tab');$('update').textContent=result.available?`Update to v${result.version}`:'Apply local update';button.title=(result.available?`New local version ${result.version}. Click to update.`:'Refresh local plugin files.')+' Refresh clears temporary pins and Google selection; saved reviews stay.';}
    catch(error){if(!alive())markStale();else{log('check-local-update',error);$('refresh-plugin').hidden=true;$('refresh-plugin').title='Update check unavailable. Click to reload local files, or reload from chrome://extensions.';}}
    finally{checkingUpdate=false;}
  }
  window.addEventListener('focus',checkUpdate);document.addEventListener('visibilitychange',checkUpdate);
  setInterval(checkUpdate,60000);
  document.addEventListener('keydown',event=>{
    const target=event.composedPath()[0];
    if(event.defaultPrevented||event.isComposing||event.repeat||event.ctrlKey||event.metaKey||event.altKey||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]'))return;
    // Never cancel or reinterpret the site's navigation keys, even while saving.
    if(['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;
    if(event.key.toLowerCase()==='h'&&!event.shiftKey){event.preventDefault();event.stopImmediatePropagation();hidden?show():minimize();return;}
    if(event.key==='?'){event.preventDefault();event.stopImmediatePropagation();openSettings();return;}
    if(hidden||settingsOpen||compareOpen||busy||!library||!C.identity(location.href)||event.shiftKey)return;
    const decision={a:'accept',r:'reject',u:'unreviewed'}[event.key.toLowerCase()];
    if(!decision&&!/^[0-5]$/.test(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();decision?chooseDecision(decision):chooseStars(Number(event.key));
  },true);
  function schedule(){if(hidden||timer)return;timer=setTimeout(()=>{timer=null;if(!host.isConnected)document.documentElement.append(host);if(loadedSlot!==slot()){loadedSlot=slot();load();return;}const next=location.href;if(next!==lastPhoto){lastPhoto=next;say('');}render();},180);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','aria-checked']});
  window.addEventListener('popstate',schedule);window.addEventListener('pagehide',releasePins);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>k.startsWith(C.PREFIX)||k===scopeKey()||k===appearance.key||k===C.LIBRARIES_KEY||k.startsWith(C.LIBRARY_PREFIX)))load();});
  load();checkUpdate();
})();

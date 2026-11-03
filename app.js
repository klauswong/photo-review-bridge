import {mergeRecords, normalizeRecord, fromCSV, toCSV, assessCandidate, photoUrl} from './core.js';
import {pageOperation} from './page.js';

const $ = id => document.getElementById(id);
const KEY = 'photoReviewWorkspaceV1';
let state = {records: [], matches: {}, selected: '', album: ''};
let candidate = null, busy = false, scanningTab = null;
let stage = 'collect';
let networkCapture = false, captureCancelled = false;
const text = (tag, value, className) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };
const status = (value, error = false) => { $('status').textContent = value; $('status').classList.toggle('error', error); };
const current = () => state.records.find(r => r.id === state.selected);

function setBusy(value) {
  busy = value;
  document.querySelectorAll('button').forEach(b => { b.disabled = value; });
  $('import').disabled = value;
  $('stop').disabled = !value || !scanningTab;
  if (!value) render();
}
async function save() { await chrome.storage.local.set({[KEY]: state}); }
function resetCandidate() { candidate = null; $('candidate').hidden = true; $('candidate').replaceChildren(); $('compared').checked = false; $('compared').disabled = true; }
function render() {
  const r = current(); const match = r && state.matches[r.id];
  const list=document.querySelector('.records');
  const slot=$(stage==='collect'?'collect-list-slot':'review-list-slot');
  if(list.parentElement!==slot)slot.append(list);
  $('collect-panel').hidden = stage !== 'collect';
  $('review-panel').hidden = stage !== 'review';
  $('stage-collect').setAttribute('aria-pressed', String(stage === 'collect'));
  $('stage-review').setAttribute('aria-pressed', String(stage === 'review'));
  $('collected').hidden = !state.records.length;
  $('collected-count').textContent = `${state.records.length} filename${state.records.length === 1 ? '' : 's'} in your saved list. Check the list before continuing.`;
  $('comparison').hidden = !candidate?.assessment.ok;
  $('album-step').hidden = !match;
  $('retry-match').hidden = !candidate;
  $('search').hidden = Boolean(match || candidate?.assessment.ok);
  $('read').hidden = Boolean(match || candidate?.assessment.ok);
  $('current').replaceChildren();
  if (r) {
    $('current').append(text('strong', r.filename), text('small', r.captureTime || 'Capture date not collected — compare it in the apps.'));
    if (r.sourceUrl) { const a = text('a', 'Open Lightroom source'); a.href = r.sourceUrl; a.target = '_blank'; a.rel = 'noreferrer noopener'; $('current').append(a); }
  } else $('current').append(text('p', 'Choose a reject from the list to begin.'));
  const placed = Object.values(state.matches).filter(m => m.verified).length;
  $('summary').textContent = `${state.records.length} rejects · ${Object.keys(state.matches).length} approved matches · ${placed} album placements verified by you`;
  $('empty').hidden = state.records.length > 0;
  $('rows').replaceChildren();
  const query = $('filter').value.toLocaleLowerCase();
  const filtered = state.records.filter(row => row.filename.toLocaleLowerCase().includes(query));
  for (const row of filtered.slice(0, 200)) {
    const m = state.matches[row.id]; const tr = document.createElement('tr');
    if (row.id === state.selected) tr.className = 'active';
    tr.append(text('td', row.filename), text('td', row.captureTime || 'Not collected'));
    tr.append(text('td', m?.verified ? 'Album verified' : m ? 'Match approved' : 'Needs review', m?.verified ? 'verified' : 'state'));
    const td = document.createElement('td'); const b = text('button', row.id === state.selected ? 'Reviewing' : 'Review', 'quiet');
    b.type = 'button'; b.disabled = busy; b.setAttribute('aria-label', `Review ${row.filename}`);
    b.addEventListener('click', () => run(async () => { state.selected = row.id; resetCandidate(); await save(); render(); }));
    td.append(b); tr.append(td); $('rows').append(tr);
  }
  $('limit').textContent = filtered.length > 200 ? `Showing the first 200 of ${filtered.length} matching records. Filter by filename to find another record; all records are retained in the CSV.` : '';
  if (!busy) {
    $('reload-extension').disabled=!globalThis.chrome?.runtime?.reload;
    const hasGoogle=Boolean($('google-tab').value);
    $('search').disabled = !r || !hasGoogle; $('read').disabled = !r || !hasGoogle; $('pick-name').disabled = !r || !hasGoogle;
    $('approve').disabled = !hasGoogle || !candidate?.assessment.ok || !$('compared').checked;
    $('add').disabled = !hasGoogle || !match || match.verified;
    $('done').disabled = !match || match.verified;
    $('export').disabled = !state.records.length;
    $('reset').disabled = !state.records.length;
    $('next').disabled = !state.records.some(row => !state.matches[row.id]?.verified && row.id !== state.selected);
    $('next-main').disabled = $('next').disabled;
    $('stage-review').disabled = !state.records.length;
    $('stop').disabled = true;
  }
}

async function run(fn) {
  if (busy) return;
  setBusy(true);
  try { await fn(); }
  catch (error) {
    console.error('workspace-operation browser/local attempt=1', error.name, error.message);
    status(friendly(error), true);
  } finally { scanningTab = null; setBusy(false); }
}
function friendly(error) {
  const message = error?.message || '';
  if (/Receiving end|Cannot access|No tab|frame.*removed|tab.*closed|The tab was closed/i.test(message)) return 'That page is unavailable. Reopen it, refresh the tab list, and try again.';
  if (/\bquota\b/i.test(message)) return 'Browser storage is full. Export your manifest before clearing the workspace.';
  // Only our own plain-language errors cross this boundary. Browser errors stay in the console.
  if (/^(Open |Use |First |A capture|Each row|A capture date|The CSV|This CSV|Some CSV|The manifest|The photo|Enter |Could not |The Add|The Info|Choose |This Google|Select |Import |Capture |Create |No filenames|That photo|An album|The browser|Keep |Lightroom |This batch)/.test(message)) return message;
  return 'This step could not finish. Refresh the service page and try again. Your saved manifest is still available.';
}
async function tabs() {
  for (const [id, host] of [['lightroom-tab', 'lightroom.adobe.com'], ['google-tab', 'photos.google.com']]) {
    const old = $(id).value;
    const found = await chrome.tabs.query({url: `https://${host}/*`});
    $(id).replaceChildren();
    if (!found.length) { const o = text('option', `Open ${host}, then refresh tabs`); o.value = ''; $(id).append(o); }
    for (const tab of found) { const o = text('option', tab.title || host); o.value = String(tab.id); $(id).append(o); }
    if (found.some(t => String(t.id) === old)) $(id).value = old;
    const service = id === 'lightroom-tab' ? 'lightroom' : 'google';
    $(service + '-choice').open = found.length !== 1;
    updateTabLabel(service);
  }
}
function updateTabLabel(service) {
  const select = $(service === 'lightroom' ? 'lightroom-tab' : 'google-tab');
  $(service + '-selected').textContent = select.value ? `Using: ${select.selectedOptions[0]?.textContent || 'Selected tab'}` : `Open ${service==='google'?'Google Photos':'Lightroom'} in this browser, then refresh tabs.`;
}
for (const service of ['lightroom','google']) $(service === 'lightroom' ? 'lightroom-tab' : 'google-tab').addEventListener('change', () => updateTabLabel(service));
function tabId(id) {
  const n = Number($(id).value);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Choose an open service tab, then try again.');
  return n;
}
async function operate(id, command, options = {}) {
  const result = await chrome.scripting.executeScript({target: {tabId: id}, ...(command.startsWith('lightroom-network-')?{world:'MAIN'}:{}), func: pageOperation, args: [command, options]});
  if (!result?.[0]?.result) throw new Error('The browser returned no page information. Open the page and try again.');
  return result[0].result;
}
async function captureBatch() {
  const tab=tabId('lightroom-tab');
  const id=crypto.randomUUID();
  const target=await operate(tab,'lightroom-network-arm',{id});
  networkCapture=true;captureCancelled=false;scanningTab=tab;$('stop').disabled=false;
  $('capture-help').hidden=true;
  status('Selecting Rejected in Lightroom and collecting filenames. Your current search is preserved. Stop cancels without changing your saved list.');
  let result;
  try {
    await chrome.tabs.update(tab,{url:target.url});
    const deadline=Date.now()+95_000;
    while(Date.now()<deadline) {
      if(captureCancelled) return;
      result=await operate(tab,'lightroom-network-read',{id});
      if(captureCancelled) return;
      if(result.phase==='captured') break;
      if(['error','expired','stopped'].includes(result.phase)) throw new Error(result.message || 'Capture cancelled. Your saved list is unchanged.');
      if(result.expectedCount!==null)status(`Received ${result.records.length} of ${result.expectedCount} rejected photos. Keep Lightroom open; scroll the grid if more results need loading.`);
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(result?.phase!=='captured') throw new Error('Capture timed out. No new records were saved. Filter to a smaller event and try again.');
    $('stop').disabled=true;
    const before=state.records.length;
    const merged=mergeRecords(state.records,result.records);
    const next={...state,records:merged,selected:state.selected || merged[0]?.id || ''};
    await chrome.storage.local.set({[KEY]:next});state=next;
    $('capture-help').hidden=true;document.querySelector('.records').open=true;
    status(`Captured ${result.records.length} of ${result.expectedCount} rejects. Added ${merged.length-before} to your saved list; ${merged.length} total. Check the filenames before continuing.`);
  } catch(error) {
    if(result?.phase!=='captured' && !captureCancelled){$('capture-help').hidden=false;$('collection-options').open=true;document.querySelector('.records').open=true;}
    throw error;
  } finally {
    try {await operate(tab,'lightroom-network-stop');}
    catch(error){console.error('stop-network-capture Lightroom attempt=1',error.name,'status=unknown');}
    networkCapture=false;
  }
}
async function capture(scroll) {
  if (!$('rejects-only').checked) throw new Error('First filter Lightroom to rejected photos and confirm the filter.');
  const id = tabId('lightroom-tab');
  scanningTab = id; $('stop').disabled = false;
  status(scroll ? 'Collecting rendered filenames while scrolling. Stop at any time; keep the Lightroom tab open.' : 'Reading rendered Lightroom filenames…');
  const result = await operate(id, 'lightroom-capture', {rejectsConfirmed: true, scroll});
  if (!result.records.length) {
    $('capture-help').hidden = false;
    $('collection-options').open = true;
    document.querySelector('.records').open = true;
    throw new Error('No filenames were readable in this read. Your saved list is unchanged. Use Choose filename in Lightroom below.');
  }
  const before = state.records.length;
  state.records = mergeRecords(state.records, result.records);
  if (!state.selected) state.selected = state.records[0]?.id || '';
  await save();
  $('capture-help').hidden = true;
  status(`Added ${state.records.length - before} records; ${state.records.length} total. ${result.reason}. Check the count against Lightroom before exporting. Dates and duplicate identity need review.`);
}

/** @param {'collect'|'review'} next */
function showStage(next) {
  stage=next;render();
  status(next==='collect' ? 'Choose Collect rejected photos. Lightroom will switch to Rejected while preserving your current search.' : $('google-tab').value ? 'Find this photo in Google Photos, then open its Info panel.' : 'Open Google Photos in this browser, then refresh tabs to start reviewing.');
}
$('stage-collect').addEventListener('click', () => showStage('collect'));
$('stage-review').addEventListener('click', () => showStage('review'));
$('continue-review').addEventListener('click', () => showStage('review'));
$('lr-pick').addEventListener('click', () => run(async () => {
  if (!$('rejects-only').checked) throw new Error('First confirm that this Lightroom photo is a reject.');
  const id = tabId('lightroom-tab'); const tab = await chrome.tabs.get(id);
  await chrome.tabs.update(id, {active:true}); await chrome.windows.update(tab.windowId, {focused:true});
  status('In Lightroom, click the original filename in Info. Escape cancels.');
  const result = await operate(id, 'lightroom-pick-name', {rejectsConfirmed:true});
  state.records = mergeRecords(state.records, result.records);
  if (!state.selected) state.selected = state.records[0]?.id || '';
  await save(); $('capture-help').hidden = true; status('Filename collected. Return here to continue, or collect the next reject.');
}));
$('paste-import').addEventListener('click', () => run(async () => {
  if (!$('rejects-only').checked) throw new Error('First confirm that the filenames belong to rejected photos.');
  const names = $('paste-names').value.split(/\r?\n/).map(filename => filename.trim()).filter(Boolean);
  if (!names.length) throw new Error('Enter at least one original filename, including its extension.');
  state.records = mergeRecords(state.records, names.map(filename => ({filename})));
  if (!state.selected) state.selected = state.records[0]?.id || '';
  await save(); $('paste-names').value = ''; status(`Added ${names.length} filenames. Continue to Google Photos when ready.`);
}));
$('diagnose').addEventListener('click', () => run(async () => {
  const result = await operate(tabId('lightroom-tab'), 'lightroom-diagnostics');
  $('diagnostics').textContent = JSON.stringify(result, null, 2); $('diagnostics').hidden = false;
  status('Reader check complete. The summary contains counts, not filenames or photo content.');
}));

for(const id of ['refresh','refresh-google']) $(id).addEventListener('click', () => run(async () => { await tabs(); status('Tab list refreshed.'); }));
$('capture').addEventListener('click', () => run(() => capture(false)));
$('capture-batch').addEventListener('click', () => run(captureBatch));
$('scan').addEventListener('click', () => run(() => capture(true)));
$('stop').addEventListener('click', async () => {
  try {
    if(networkCapture){captureCancelled=true;if(scanningTab)await operate(scanningTab,'lightroom-network-stop');status('Capture cancelled. Your saved list is unchanged.');}
    else {if (scanningTab) await operate(scanningTab, 'stop'); status('Stopping after the current scroll step…');}
  }
  catch (error) { console.error('stop-capture lightroom attempt=1', error.name); status('Could not reach the page. The scan stops after at most 60 scroll steps.', true); }
});
$('filter').addEventListener('input', render);
async function nextPhoto() {
  const index = state.records.findIndex(r => r.id === state.selected);
  const ordered = [...state.records.slice(index + 1), ...state.records.slice(0, index + 1)];
  const next = ordered.find(r => !state.matches[r.id]?.verified && r.id !== state.selected);
  if (next) { state.selected = next.id; resetCandidate(); await save(); status(`Reviewing ${next.filename}.`); }
}
for (const id of ['next','next-main']) $(id).addEventListener('click', () => run(nextPhoto));
$('retry-match').addEventListener('click', () => { resetCandidate(); render(); status('Open another Google Photos candidate, then check its filename again.'); });
$('compared').addEventListener('change', render);
$('album').addEventListener('change', () => run(async () => { state.album = $('album').value.trim(); await save(); }));
$('export').addEventListener('click', () => run(async () => {
  const blob = new Blob([toCSV(state.records)], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'lightroom-rejects.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Reject manifest exported. No images were exported.');
}));
$('import').addEventListener('change', () => run(async () => {
  const file = $('import').files[0]; if (!file) return;
  if (file.size > 5_000_000) throw new Error('The manifest is too large. Use a CSV smaller than 5 MB.');
  const incoming = fromCSV(await file.text());
  state.records = mergeRecords(state.records, incoming);
  if (!state.selected) state.selected = state.records[0]?.id || '';
  await save(); $('import').value = ''; status(`Imported ${incoming.length} records. ${state.records.length} rejects in this workspace.`);
}));
$('search').addEventListener('click', () => run(async () => {
  const r = current(); if (!r) return;
  if (r.filename.includes('"')) throw new Error('This Google Photos search cannot quote a filename containing a quotation mark. Find this photo by date and check its Info filename.');
  resetCandidate();
  const id = tabId('google-tab');
  const existing = await chrome.tabs.get(id);
  const prefix = new URL(existing.url).pathname.match(/^\/u\/\d+/)?.[0] || '';
  await chrome.tabs.update(id, {url: `https://photos.google.com${prefix}/search/${encodeURIComponent(`"${r.filename}"`)}`, active: true});
  await chrome.windows.update(existing.windowId, {focused: true});
  status(`Search opened for ${r.filename}. Open the matching photo, show Info, then return here to read it. Search results alone are not proof of identity.`);
}));
async function readCandidate(pick = false) {
  resetCandidate(); const r = current(); if (!r) return;
  const id = tabId('google-tab');
  if (pick) {
    const tab = await chrome.tabs.get(id);
    await chrome.tabs.update(id, {active:true}); await chrome.windows.update(tab.windowId, {focused:true});
    status('In Google Photos, click the original filename in the Info panel. Escape cancels.');
  }
  const c = await operate(id, pick ? 'google-pick-name' : 'google-read');
  const assessment = assessCandidate(r, c, state.records, state.matches);
  candidate = {assessment, ...c};
  $('candidate').hidden = false;
  $('candidate').append(text('p', assessment.ok ? `Filename: ${c.filenames[0]}` : 'Candidate not ready'));
  $('candidate').append(text('p', assessment.ok ? assessment.warning : assessment.reason));
  if (assessment.ok) { const a = text('a', 'Open Google Photos candidate'); a.href = assessment.url; a.target = '_blank'; a.rel = 'noreferrer noopener'; $('candidate').append(a); }
  $('compared').disabled = !assessment.ok;
  status(assessment.ok ? 'Filename matches. Compare the image and date before approving.' : assessment.reason, !assessment.ok);
}
$('read').addEventListener('click', () => run(() => readCandidate()));
$('pick-name').addEventListener('click', () => run(() => readCandidate(true)));
$('approve').addEventListener('click', () => run(async () => {
  const r = current();
  if (!r || !candidate?.assessment.ok || !$('compared').checked) throw new Error('Select a matching photo and confirm your visual comparison first.');
  // Re-read to catch navigation between candidate capture and approval.
  const fresh = await operate(tabId('google-tab'), 'google-read');
  const assessment = assessCandidate(r, fresh, state.records, state.matches);
  if (!assessment.ok || assessment.url !== candidate.assessment.url) throw new Error('That photo changed. Read the open photo again before approving.');
  state.matches[r.id] = {url: assessment.url, verified: false, approvedAt: new Date().toISOString()};
  await save(); resetCandidate(); status('Match approved and saved locally. You can now add the open photo to your review album.');
}));
$('add').addEventListener('click', () => run(async () => {
  const r = current(); const m = r && state.matches[r.id];
  if (!m || !photoUrl(m.url)) throw new Error('Select and approve a match first.');
  state.album = $('album').value.trim();
  if (!state.album) throw new Error('Enter the exact name of an existing private review album.');
  await save();
  const result = await operate(tabId('google-tab'), 'google-album', {url: m.url, filename: r.filename, album: state.album});
  status(result.message);
}));
$('done').addEventListener('click', () => run(async () => {
  const r = current(); const m = r && state.matches[r.id]; if (!m) return;
  m.verified = true; m.album = $('album').value.trim(); m.verifiedAt = new Date().toISOString();
  await save(); status('Album placement marked verified by you. Choose the next reject to continue.');
}));
$('reset').addEventListener('click', () => run(async () => {
  if (!confirm('Clear this extension’s local reject list and match decisions? Google Photos and Lightroom will not be changed. Export a CSV first if you need the list.')) return;
  state = {records: [], matches: {}, selected: '', album: ''}; resetCandidate(); $('album').value = ''; await save(); status('Local workspace cleared. Service libraries were not changed.');
}));

$('reload-extension').addEventListener('click',()=>run(async()=>{
  if($('paste-names').value.trim())throw new Error('First add or clear the pasted filenames before applying an update.');
  const tab=await chrome.tabs.getCurrent();
  if(!tab)throw new Error('Could not find this workspace tab. Reopen it from the extension icon and try again.');
  await chrome.storage.local.set({[KEY]:state,photoReviewReloadWorkspaceV1:{windowId:tab.windowId,active:Boolean(tab.active),createdAt:Date.now()}});
  status('Applying local update. Your saved decisions will reopen.');
  chrome.runtime.reload();
}));

async function init() {
  if (!globalThis.chrome?.storage?.local || !globalThis.chrome?.scripting) { status('Load this folder as an unpacked Chrome extension, then open it using the toolbar icon.', true); return; }
  try {
    const version=chrome.runtime?.getManifest?.().version;
    $('version').textContent=version ? `v${version}` : 'Local extension';
    const saved = (await chrome.storage.local.get(KEY))[KEY];
    if (saved) {
      // Restore each saved ID, including legacy duplicates with separate decisions.
      const records = mergeRecords((saved.records || []).map(normalizeRecord), []);
      const matches = {};
      for (const r of records) { const m = saved.matches?.[r.id]; if (m && photoUrl(m.url)) matches[r.id] = {...m, url: photoUrl(m.url)}; }
      state = {records, matches, selected: records.some(r => r.id === saved.selected) ? saved.selected : records[0]?.id || '', album: typeof saved.album === 'string' ? saved.album.slice(0,150) : ''};
    }
    $('album').value = state.album; await tabs(); render();
    status(state.records.length ? 'Your local workspace is restored. Continue reviewing or collect another part of the same batch.' : 'Start in Lightroom: open Photos or your search results, then choose Collect rejected photos. Rejected is selected automatically.');
  } catch (error) { console.error('load-workspace browser/local attempt=1', error.name, error.message); status('The workspace could not load. Reload the extension page; existing saved data has not been cleared.', true); }
}
await init();

import './hud-core.js';
const C=globalThis.PhotoReviewHUDCore;
export const HUD_RELOAD_KEY='photoReviewHudReloadV1';
/** Reads only this unpacked extension's local manifest; never contacts an update server. */
export async function checkLocalVersion(runtime,fetcher=fetch) {
  const response=await fetcher(`${runtime.getURL('manifest.json')}?local-version=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw new Error('LocalManifestUnavailable');
  const {version}=await response.json(),current=runtime.getManifest().version;
  if(!C.validVersion(version)||!C.validVersion(current))throw new Error('InvalidLocalVersion');
  return {version,current,available:C.newerVersion(version,current)};
}
/** Reload only the requesting Google Photos tab after extension reload; consume once. */
export async function resumeHudReload(storage,tabs) {
  const pending=(await storage.get(HUD_RELOAD_KEY))[HUD_RELOAD_KEY];
  if(!pending)return false;
  await storage.remove(HUD_RELOAD_KEY);
  if(!Number.isInteger(pending.tabId)||!Number.isFinite(pending.createdAt)||Date.now()-pending.createdAt<0||Date.now()-pending.createdAt>60000)return false;
  const tab=await tabs.get(pending.tabId);
  if(!tab.url?.startsWith('https://photos.google.com/'))return false;
  await tabs.reload(pending.tabId);return true;
}

import {checkLocalVersion,resumeHudReload,HUD_RELOAD_KEY} from './hud-updates.js';
import {updateReview,restoreReviews,flushReviews,useLibrary,clearReviews,deleteLibrary} from './hud-store.js';
let opening = false;
chrome.runtime.onInstalled.addListener(async ({reason}) => {
  if(reason!=='update')return;
  try{await resumeHudReload(chrome.storage.local,chrome.tabs);}catch(error){console.error('refresh-requesting-tab chrome attempt=1',error.name,'status=unknown');}
  try {
    const key='photoReviewReloadWorkspaceV1';
    const pending=(await chrome.storage.local.get(key))[key];
    const pages=await chrome.tabs.query({url:chrome.runtime.getURL('index.html')});
    if(!pages.length && pending && Date.now()-pending.createdAt>=0 && Date.now()-pending.createdAt<60000) {
      const page=await chrome.tabs.create({url:chrome.runtime.getURL('index.html'),active:Boolean(pending.active),...(Number.isInteger(pending.windowId)?{windowId:pending.windowId}:{})});
      await chrome.storage.session.set({workspaceTabId:page.id});
    }
    if(pages[0])await chrome.storage.session.set({workspaceTabId:pages[0].id});
    for(const page of pages) {
      try {await chrome.tabs.reload(page.id);}
      catch(error){console.error('refresh-workspace chrome attempt=1',error.name,'status=unknown');}
    }
    if(pending)await chrome.storage.local.remove(key);
  }catch(error){console.error('reload-workspaces chrome attempt=1',error.name,'status=unknown');}
});
chrome.action.onClicked.addListener(async tab => {
  if(opening)return;
  opening=true;
  try {
    const google=tab?.url?.startsWith('https://photos.google.com/')?tab:(await chrome.tabs.query({url:'https://photos.google.com/*'}))[0];
    if(!google){await chrome.tabs.create({url:'https://photos.google.com/'});return;}
    await chrome.tabs.update(google.id,{active:true});
    await chrome.windows.update(google.windowId,{focused:true});
    try {await chrome.tabs.sendMessage(google.id,{type:'hud-show'});}
    catch {
      await chrome.scripting.executeScript({target:{tabId:google.id},files:['hud-core.js','hud.js']});
    }
  }catch(error){console.error('open-google-hud chrome attempt=1',error.name,'status=unknown');}
  finally{opening=false;}
});

chrome.runtime.onMessage?.addListener((message,sender,respond)=>{
  if(!['hud-save','hud-restore','hud-reload','hud-check-update','hud-use-library','hud-clear-reviews','hud-delete-library'].includes(message?.type))return;
  if(sender.id!==chrome.runtime.id || !sender.tab?.url?.startsWith('https://photos.google.com/'))return;
  (async()=>{
    try{
      const accountSlot=new URL(sender.tab.url).pathname.match(/^\/u\/(\d+)(?:\/|$)/)?.[1]||'0';
      if(message.type==='hud-save')respond({ok:true,value:await updateReview({...message,accountSlot},chrome.storage.local)});
      if(message.type==='hud-restore')respond({ok:true,count:await restoreReviews({...message,accountSlot},chrome.storage.local)});
      if(message.type==='hud-use-library')respond({ok:true,...await useLibrary(message,chrome.storage.local,new URL(sender.tab.url).pathname.match(/^\/u\/(\d+)(?:\/|$)/)?.[1]||'0')});
      if(message.type==='hud-delete-library')respond({ok:true,...await deleteLibrary(message,chrome.storage.local)});
      if(message.type==='hud-clear-reviews')respond({ok:true,...await clearReviews(message,chrome.storage.local)});
      if(message.type==='hud-check-update')respond({ok:true,...await checkLocalVersion(chrome.runtime)});
      if(message.type==='hud-reload'){await flushReviews();await chrome.storage.local.set({[HUD_RELOAD_KEY]:{tabId:sender.tab.id,createdAt:Date.now()}});respond({ok:true});setTimeout(()=>chrome.runtime.reload(),100);}
    }catch(error){console.error('hud-operation chrome/local attempt=1',error.name,'status=unknown');respond({ok:false});}
  })();
  return true;
});

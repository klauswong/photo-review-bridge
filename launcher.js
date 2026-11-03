const $=id=>document.getElementById(id);
$('version').textContent=`v${chrome.runtime.getManifest().version} · Local only`;
$('open-google').onclick=async()=>{
  $('open-google').disabled=true;
  try{
    const tab=(await chrome.tabs.query({url:'https://photos.google.com/*'}))[0];
    if(tab){await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});
      try{await chrome.tabs.sendMessage(tab.id,{type:'hud-show'});}catch{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['hud-core.js','hud.js']});}
    }else await chrome.tabs.create({url:'https://photos.google.com/'});
    $('status').textContent='Open a photo in Google Photos to start reviewing.';
  }catch(error){console.error('open-hud chrome attempt=1',error.name,'status=unknown');$('status').textContent='Open Google Photos, reload its tab, then click the extension icon.';}
  finally{$('open-google').disabled=false;}
};
$('reload-extension').onclick=async()=>{
  $('reload-extension').disabled=true;
  try{const tab=await chrome.tabs.getCurrent();await chrome.storage.local.set({photoReviewReloadWorkspaceV1:{windowId:tab.windowId,active:Boolean(tab.active),createdAt:Date.now()}});chrome.runtime.reload();}
  catch(error){console.error('apply-update chrome/local attempt=1',error.name,'status=unknown');$('status').textContent='The update could not finish. Reload Photo Review Bridge in chrome://extensions, then reload Google Photos.';$('reload-extension').disabled=false;}
};

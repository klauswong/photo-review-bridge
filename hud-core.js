/* Shared, pure helpers for the Google Photos content script. */
(() => {
  const PREFIX='photoReviewHudV1:';
  const decisions=['unreviewed','accept','reject'];
  function identity(raw, base='https://photos.google.com/') {
    try {
      const url=new URL(raw,base);
      if(url.origin!=='https://photos.google.com')return null;
      const match=url.pathname.match(/^\/(?:u\/(\d+)\/)?(?:album\/[^/]+\/)?photo\/([A-Za-z0-9_-]+)\/?$/);
      if(!match)return null;
      return {id:match[2],slot:match[1]||'0',url:`${url.origin}/u/${match[1]||'0'}/photo/${match[2]}`};
    }catch{return null;}
  }
  function libraryName(raw) {
    if(typeof raw!=='string')throw new Error('Enter a name for this local review library.');
    const value=raw.trim().normalize('NFC');
    if(!value || value.length>60 || /[\x00-\x1f]/.test(value))throw new Error('Use a library name between 1 and 60 characters.');
    return value;
  }
  function key(library,id){return `${PREFIX}${encodeURIComponent(libraryName(library))}:${id}`;}
  function record(raw) {
    if(!raw || typeof raw!=='object')throw new Error('That review record is invalid.');
    const photo=identity(raw.url);
    if(!photo || photo.id!==raw.id || !decisions.includes(raw.decision) || !Number.isInteger(raw.stars) || raw.stars<0 || raw.stars>5)throw new Error('That review record is invalid.');
    return {version:1,library:libraryName(raw.library),id:photo.id,url:photo.url,decision:raw.decision,stars:raw.stars,updatedAt:typeof raw.updatedAt==='string'?raw.updatedAt:''};
  }
  // Browser-local appearance preference. CSS resolves light/dark from the OS.
  const OPACITY=Object.freeze({key:'photoReviewHudOpacityV1',default:85,min:75,max:100,step:5});
  /** @param {unknown} value @returns {boolean} */
  function validOpacity(value){return Number.isInteger(value)&&value>=OPACITY.min&&value<=OPACITY.max&&(value-OPACITY.min)%OPACITY.step===0;}
  /** @param {{decision?:string,stars?:number}|undefined} value @param {Array<'accept'|'reject'|'unreviewed'>} selectedDecisions @param {number[]} ratings @returns {boolean} */
  function matches(value,selectedDecisions,ratings) {
    return (!selectedDecisions.length||selectedDecisions.includes(value?.decision||'unreviewed')) && ratings.includes(value?.stars||0);
  }
  function validVersion(value){return typeof value==='string'&&/^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(value)&&value.split('.').every(part=>Number(part)<=65535);}
  function newerVersion(candidate,current){if(!validVersion(candidate)||!validVersion(current))return false;const a=candidate.split('.').map(Number),b=current.split('.').map(Number);for(let n=0;n<4;n++){if((a[n]||0)!==(b[n]||0))return (a[n]||0)>(b[n]||0);}return false;}
  const RESUME_PREFIX='photoReviewHudResumeV1:';
  const BADGE_KEY='photoReviewHudBadgeV1';
  function resumeKey(library){return RESUME_PREFIX+encodeURIComponent(libraryName(library));}
  function resumePoint(raw){
    const photo=identity(raw?.url);
    if(!photo||!Number.isFinite(Date.parse(raw.updatedAt)))throw new Error('Invalid resume point.');
    const url=new URL(raw.url);url.search='';url.hash='';
    return {id:photo.id,url:url.href,updatedAt:raw.updatedAt};
  }
  const LIBRARY_PREFIX='photoReviewHudLibraryNameV1:';
  function libraryKey(name){return LIBRARY_PREFIX+encodeURIComponent(libraryName(name));}
  function libraryStamp(records){return JSON.stringify(records.map(r=>[r.id,r.decision,r.stars,r.updatedAt,r.url]).sort((a,b)=>a[0].localeCompare(b[0])));}
  const LIBRARIES_KEY='photoReviewHudLibrariesV1';
  function libraryNames(saved){
    const names=new Set(),add=value=>{try{names.add(libraryName(value));}catch{}};
    if(Array.isArray(saved[LIBRARIES_KEY]))for(const value of saved[LIBRARIES_KEY])add(value);
    for(const [key,value]of Object.entries(saved)){
      if(key.startsWith('photoReviewHudLibraryV1:'))add(value);
      if(key.startsWith(LIBRARY_PREFIX)&&value===true){try{const name=decodeURIComponent(key.slice(LIBRARY_PREFIX.length));if(libraryKey(name)===key)add(name);}catch{}}
      if(key.startsWith(PREFIX)){try{const r=record(value);if(key===`${PREFIX}${encodeURIComponent(r.library)}:${r.id}`)add(r.library);}catch{}}
    }
    return [...names].sort((a,b)=>a.localeCompare(b));
  }
  function activeReviews(records){return records.filter(r=>r.decision!=='unreviewed'||r.stars>0);}
  function reviewStamp(records){return JSON.stringify(activeReviews(records).map(r=>[r.id,r.decision,r.stars,r.updatedAt]).sort((a,b)=>a[0].localeCompare(b[0])));}
  /** Redacted image-source shape: never return path, query, fragment, credentials or payload. */
  function pinSourceShape(raw,base='https://photos.google.com/'){
    if(typeof raw!=='string'||!raw)return {scheme:'unknown',hostname:'',origin:''};
    try{const url=new URL(raw,base);return {scheme:url.protocol,hostname:url.hostname,origin:url.origin};}
    catch{return {scheme:'unknown',hostname:'',origin:''};}
  }
  globalThis.PhotoReviewHUDCore={PREFIX,RESUME_PREFIX,BADGE_KEY,resumeKey,resumePoint,identity,libraryName,key,record,matches,OPACITY,validOpacity,validVersion,newerVersion,LIBRARIES_KEY,libraryNames,activeReviews,reviewStamp,LIBRARY_PREFIX,libraryKey,libraryStamp,pinSourceShape};
})();

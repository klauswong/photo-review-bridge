import './hud-core.js';
const C=globalThis.PhotoReviewHUDCore;
let writes=Promise.resolve();
/** Serialize read/merge/write across HUD tabs, preserving independent fields. */
export function updateReview(message,storage) {
  const operation=writes.catch(()=>{}).then(async()=>{
    const library=C.libraryName(message.library),photo=C.identity(message.url);
    if(!photo)throw new Error('Open an individual Google Photos photo first.');
    const patch=message.patch;
    if(!patch || Object.keys(patch).some(key=>!['decision','stars'].includes(key)) || !Object.keys(patch).length)throw new Error('Choose a review decision or rating.');
    const key=C.key(library,photo.id),scope=message.accountSlot===undefined?null:`photoReviewHudLibraryV1:${message.accountSlot}`,saved=await storage.get(scope?[key,scope]:key),old=saved[key];
    if(scope&&saved[scope]!==library)throw new Error('Library is no longer active.');
    const value=C.record({library,...photo,decision:'unreviewed',stars:0,...(old?C.record(old):{}),...patch,updatedAt:new Date().toISOString()});
    await storage.set({[key]:value});return value;
  });
  writes=operation;return operation;
}

export function restoreReviews(message,storage) {
  const operation=writes.catch(()=>{}).then(async()=>{
    const library=C.libraryName(message.library);
    if(!Array.isArray(message.reviews)||message.reviews.length>10000)throw new Error('Invalid backup.');
    if(message.accountSlot!==undefined){const scope=`photoReviewHudLibraryV1:${message.accountSlot}`;if((await storage.get(scope))[scope]!==library)throw new Error('Library is no longer active.');}
    const records=message.reviews.map(C.record);
    if(records.some(r=>r.library!==library||!/^\d{4}-\d\d-\d\dT/.test(r.updatedAt)||!Number.isFinite(Date.parse(r.updatedAt))))throw new Error('Invalid backup.');
    const keys=records.map(r=>C.key(library,r.id));
    if(new Set(keys).size!==keys.length)throw new Error('Duplicate backup records.');
    const old=await storage.get(keys),changes={};
    for(const r of records){const key=C.key(library,r.id);if(!old[key]||C.record(old[key]).updatedAt<r.updatedAt)changes[key]=r;}
    await storage.set(changes);return Object.keys(changes).length;
  });
  writes=operation;return operation;
}

export async function flushReviews(){await writes.catch(()=>{});}

export function useLibrary(message,storage,slot) {
  const operation=writes.catch(()=>{}).then(async()=>{
    const library=C.libraryName(message.library);
    if(!/^\d+$/.test(slot))throw new Error('Invalid account slot.');
    const saved=await storage.get(null),libraries=[...new Set([...C.libraryNames(saved),library])].sort((a,b)=>a.localeCompare(b));
    await storage.set({...Object.fromEntries(libraries.map(name=>[C.libraryKey(name),true])),[C.LIBRARIES_KEY]:[],[`photoReviewHudLibraryV1:${slot}`]:library});
    return {library,libraries};
  });writes=operation;return operation;
}

/** Reset only this library's decisions/stars; keep photo identities and other libraries. */
export function clearReviews(message,storage) {
  const operation=writes.catch(()=>{}).then(async()=>{
    const library=C.libraryName(message.library),saved=await storage.get(null),records=[];
    const prefix=`${C.PREFIX}${encodeURIComponent(library)}:`;
    for(const [key,value]of Object.entries(saved))if(key.startsWith(prefix)){
      const record=C.record(value);if(record.library!==library||C.key(library,record.id)!==key)throw new Error('Invalid review record.');records.push(record);
    }
    if(message.stamp!==C.reviewStamp(records))throw new Error('Reviews changed.');
    const active=C.activeReviews(records),changes={},updatedAt=new Date().toISOString();
    for(const record of active)changes[C.key(library,record.id)]={...record,decision:'unreviewed',stars:0,updatedAt};
    if(active.length)await storage.set(changes);
    return {count:active.length};
  });writes=operation;return operation;
}

/** Remove local records, library registration and every account-slot binding in one removal. */
export function deleteLibrary(message,storage) {
  const operation=writes.catch(()=>{}).then(async()=>{
    const library=C.libraryName(message.library),saved=await storage.get(null),prefix=`${C.PREFIX}${encodeURIComponent(library)}:`,keys=Object.keys(saved).filter(key=>key.startsWith(prefix));
    const records=keys.map(key=>{const r=C.record(saved[key]);if(r.library!==library||C.key(library,r.id)!==key)throw new Error('Invalid review record.');return r;});
    if(!C.libraryNames(saved).includes(library)||message.stamp!==C.libraryStamp(records))throw new Error('Library changed.');
    // Migrate the old shared name array first, so actual removal can be one batch.
    const names=C.libraryNames(saved),registrations=Object.fromEntries(names.map(name=>[C.libraryKey(name),true]));
    await storage.set({...registrations,[C.LIBRARIES_KEY]:[]});
    const bindings=Object.keys(saved).filter(key=>key.startsWith('photoReviewHudLibraryV1:')&&saved[key]===library);
    const remove=[...keys,C.libraryKey(library),...bindings];
    const bytes=storage.getBytesInUse?await storage.getBytesInUse(remove):null;
    await storage.remove(remove);return {count:records.length,bytes};
  });writes=operation;return operation;
}

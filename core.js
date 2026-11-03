export const MAX_RECORDS = 10000;
export const IMAGE_NAME = /\.(?:jpe?g|png|heic|heif|webp|avif|tiff?|dng|cr[23]|nef|arw|raf|orf|rw2|pef|srw|mp4|mov|m4v|avi|mts)$/i;

export function validFilename(value) {
  return typeof value === 'string' && value.length <= 255 && !/[\x00-\x1f/\\]/.test(value) && IMAGE_NAME.test(value.trim());
}

export function normalizeRecord(raw) {
  const filename = String(raw.filename ?? '').trim().normalize('NFC');
  if (!validFilename(filename)) throw new Error('Each row needs an original photo or video filename, including its extension.');
  const captureTime = String(raw.captureTime ?? '').trim();
  if (captureTime.length > 160) throw new Error('A capture date is too long. Check the imported file.');
  const sourceUrl = safeUrl(raw.sourceUrl, 'lightroom.adobe.com');
  const id = `${filename}\u0000${captureTime}\u0000${sourceUrl}`;
  return {id, filename, captureTime, sourceUrl};
}

export function safeUrl(raw, host) {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname === host && !u.username && !u.password ? u.href : '';
  } catch { return ''; }
}

export function photoUrl(raw) {
  const value = safeUrl(raw, 'photos.google.com');
  if (!value) return '';
  const u = new URL(value);
  return /^\/(?:u\/\d+\/)?(?:album\/[^/]+\/)?photo\/[^/]+\/?$/.test(u.pathname) ? u.origin + u.pathname.replace(/\/$/, '') : '';
}

/** @param {string} sourceUrl @returns {string} */
function lightroomAssetKey(sourceUrl) {
  const safe=safeUrl(sourceUrl,'lightroom.adobe.com');
  if(!safe)return '';
  const match=new URL(safe).pathname.match(/^\/libraries\/([\w-]+)\/(?:search\/)?assets\/([\w-]+)(?:\/metadata)?\/?$/);
  return match ? `${match[1]}\u0000${match[2]}` : '';
}

export function mergeRecords(existing, incoming) {
  const result = new Map(existing.map(r => [r.id, r]));
  if (result.size > MAX_RECORDS) throw new Error('Use batches of 10,000 photos or fewer.');
  const assets=new Map();
  for(const record of existing){const key=lightroomAssetKey(record.sourceUrl);if(key && !assets.has(key))assets.set(key,record);}
  for (const value of incoming) {
    const r = normalizeRecord(value);
    const key=lightroomAssetKey(r.sourceUrl);
    const prior=key && assets.get(key);
    if(prior){
      if(prior.filename!==r.filename)throw new Error('The photo has conflicting original filenames. Review its Lightroom source before importing.');
      continue; // Keep the saved ID, navigation context and match-decision references.
    }
    // The same filename in different assets must remain distinct.
    if (!result.has(r.id)) result.set(r.id, r);
    if(key)assets.set(key,r);
    if (result.size > MAX_RECORDS) throw new Error('Use batches of 10,000 photos or fewer.');
  }
  return [...result.values()];
}

function csvCell(value) {
  // Protect spreadsheet users from formula injection. Reader reverses this only for a dangerous prefix.
  let s = String(value ?? '');
  if (/^['=+@\-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function toCSV(records) {
  return '\ufefffilename,captureTime,sourceUrl,bridgeEncoding\r\n' + records.map(r => [r.filename, r.captureTime, r.sourceUrl, 'apostrophe-v1'].map(csvCell).join(',')).join('\r\n');
}

export function fromCSV(text) {
  if (text.length > 5_000_000) throw new Error('The manifest is too large. Use a CSV smaller than 5 MB.');
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\ufeff/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error('This CSV has misplaced quotes. Export it again.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (rows.length > MAX_RECORDS + 1) throw new Error('Use batches of 10,000 photos or fewer.');
      }
    } else {
      if (closed) throw new Error('This CSV has text after a closing quote. Export it again.');
      cell += c;
    }
  }
  if (quoted) throw new Error('This CSV has an unfinished quoted field. Export it again.');
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  if (!headers?.includes('filename')) throw new Error('The CSV needs a filename column. Use the extension’s export format.');
  if (new Set(headers).size !== headers.length) throw new Error('The CSV has duplicate column names.');
  const records = rows.map(values => {
    if (values.length !== headers.length) throw new Error('Some CSV rows have missing or extra columns.');
    const encoded = headers.includes('bridgeEncoding') && values[headers.indexOf('bridgeEncoding')] === 'apostrophe-v1';
    return Object.fromEntries(headers.map((h, i) => [h, encoded ? values[i].replace(/^'(?=['=+@\-])/, '') : values[i]]));
  });
  return mergeRecords([], records);
}

export function assessCandidate(record, candidate, allRecords, matches) {
  const url = photoUrl(candidate.url);
  if (!url) return {ok: false, reason: 'Open an individual Google Photos photo, then open its Info panel.'};
  if (candidate.filenames?.length !== 1 || candidate.filenames[0].normalize('NFC') !== record.filename) {
    return {ok: false, reason: 'The Info panel must show exactly the same original filename. No match was approved.'};
  }
  const assetId = value => new URL(value).pathname.split('/').filter(Boolean).at(-1);
  const reused = Object.entries(matches).some(([id, m]) => id !== record.id && photoUrl(m.url) && assetId(m.url) === assetId(url));
  if (reused) return {ok: false, reason: 'This Google Photos item is already assigned to another reject. Review the duplicate filenames.'};
  const collision = allRecords.filter(r => r.filename === record.filename).length > 1;
  return {ok: true, url, warning: collision ? 'Repeated filename in this batch. Compare the Lightroom original and Google photo before approving.' : 'Compare the image and capture date before approving. A filename alone does not prove identity.'};
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRecord, mergeRecords, fromCSV, toCSV, photoUrl, assessCandidate} from '../core.js';

test('CSV preserves Unicode, commas, quotes, formula-like names and literal apostrophes', () => {
  const records = ['香港 圖片.jpg', 'IMG,"a".heic', '=example.jpg', "'=example.jpg", "''=example.jpg", '-name.mov', '@name.jpg'].map(filename => normalizeRecord({filename, captureTime:'2026-10-20 12:00:00'}));
  assert.deepEqual(fromCSV(toCSV(records)), records);
  assert.equal(fromCSV('filename\n\'=example.jpg')[0].filename, "'=example.jpg");
});
test('CSV rejects incomplete quoting, extra columns and duplicate headers', () => {
  for (const csv of ['filename\n"IMG.JPG', 'filename\nIMG.JPG,extra', 'filename,filename\nA.JPG,B.JPG', 'filename\n"A.JPG"x']) assert.throws(() => fromCSV(csv));
});
test('manifest validation rejects paths and wrong types, strips untrusted URLs', () => {
  for (const filename of ['../a.jpg', 'a.jpg\nB', 'https://x/a.jpg', 'a.exe', '']) assert.throws(() => normalizeRecord({filename}));
  assert.equal(normalizeRecord({filename:'a.jpg',sourceUrl:'javascript:alert(1)'}).sourceUrl, '');
  assert.equal(normalizeRecord({filename:'a.jpg',sourceUrl:'https://lightroom.adobe.com.evil.test/x'}).sourceUrl, '');
});
test('merge removes duplicate records but preserves filename collisions across assets', () => {
  const first = normalizeRecord({filename:'A.JPG',sourceUrl:'https://lightroom.adobe.com/a'});
  assert.equal(mergeRecords([first], [first]).length, 1);
  assert.equal(mergeRecords([first], [{filename:'A.JPG',sourceUrl:'https://lightroom.adobe.com/b'}]).length, 2);
});
test('Lightroom asset identity ignores view queries while preserving saved record IDs and links',()=>{
  const first=normalizeRecord({filename:'A.JPG',sourceUrl:'https://lightroom.adobe.com/libraries/L/search/assets/A/metadata?q=event&flagFilter=reject'});
  const incoming={filename:'A.JPG',sourceUrl:'https://lightroom.adobe.com/libraries/L/search/assets/A/metadata?q=narrow&flagFilter=reject'};
  assert.deepEqual(mergeRecords([first],[incoming]),[first]);
  assert.equal(mergeRecords([], [first,incoming]).length,1);
  assert.equal(mergeRecords([first],[{...incoming,sourceUrl:'https://lightroom.adobe.com/libraries/L/assets/A'}]).length,1);
  assert.equal(mergeRecords([first],[{...incoming,sourceUrl:'https://lightroom.adobe.com/libraries/L/search/assets/B/metadata'}]).length,2);
  assert.equal(mergeRecords([first],[{...incoming,sourceUrl:'https://lightroom.adobe.com/libraries/OTHER/search/assets/A/metadata'}]).length,2);
  assert.throws(()=>mergeRecords([first],[{...incoming,filename:'CONFLICT.JPG'}]),/conflicting original filenames/);
  const oldDuplicate=normalizeRecord(incoming);
  assert.equal(mergeRecords([first,oldDuplicate],[]).length,2);
});
test('only Google Photos individual-photo routes are accepted', () => {
  for (const path of ['/photo/ABC', '/album/EVENT/photo/ABC', '/u/1/photo/ABC', '/u/1/album/EVENT/photo/ABC/']) assert.ok(photoUrl('https://photos.google.com'+path));
  for (const url of ['https://evil.test/photo/A', 'https://photos.google.com/search/A', 'https://photos.google.com/album/A', 'http://photos.google.com/photo/A']) assert.equal(photoUrl(url), '');
});
test('matching requires exact filename, a unique visible name and non-reused photo identity', () => {
  const a = normalizeRecord({filename:'A.JPG'}), b = normalizeRecord({filename:'B.JPG'});
  const good = {url:'https://photos.google.com/photo/ABC',filenames:['A.JPG']};
  assert.equal(assessCandidate(a, good, [a], {}).ok, true);
  for (const c of [{...good,filenames:[]},{...good,filenames:['a.JPG']},{...good,filenames:['A.JPG','B.JPG']},{...good,url:'https://photos.google.com/search/A'}]) assert.equal(assessCandidate(a,c,[a],{}).ok,false);
  assert.equal(assessCandidate(a, good, [a,b], {[b.id]:{url:'https://photos.google.com/album/OTHER/photo/ABC'}}).ok,false);
});

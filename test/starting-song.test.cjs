const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../playlist-engine.js');
const seed={title:'Starting song',artist:'Artist A, Artist B',artists:['Artist A','Artist B'],uri:'spotify:track:1234567890123456789012'};
test('starting song comes first exactly once and counts toward the requested length',()=>{
 const result=E.includeSeed([{...seed},{title:'Other',artist:'C'},{title:'Third',artist:'D'}],seed,{count:2});
 assert.equal(result.length,2);assert.equal(result[0].uri,seed.uri);assert.equal(result[0].isSeed,true);assert.equal(result[1].title,'Other');
});
test('collaborator aliases and duplicate URI matches do not repeat the starting song',()=>{
 const result=E.includeSeed([{title:seed.title,artist:'Artist A'},{title:'Another label',artist:'Alias',uri:seed.uri},{title:'Other',artist:'C'}],seed,{count:10});assert.equal(result.length,2);assert.equal(result[1].title,'Other');
});
test('single-song playlists and empty recommendations still contain the selected song',()=>{
 assert.equal(E.includeSeed([{title:'Other',artist:'C'}],seed,{count:1}).length,1);assert.equal(E.includeSeed([],seed,{count:25})[0].title,seed.title);
});
test('no chosen song preserves the original list; different versions are retained',()=>{
 const tracks=[{title:'Starting song (Live)',artist:'Artist A'},{title:'Other',artist:'C'}];assert.deepEqual(E.includeSeed(tracks,null,{count:2}),tracks);assert.equal(E.includeSeed(tracks,seed,{count:3})[1].title,'Starting song (Live)');
});

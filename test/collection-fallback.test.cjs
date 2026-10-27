const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../playlist-engine.js');
const track=(artist,title,dates=[],qualified=1)=>({key:E.norm(artist)+'\0'+E.norm(title),artist,title,dates,qualified,plays:qualified});
test('collection ranks listening neighbors and labels, excludes seed and skips, and mixes artists',()=>{
 const seed=track('Seed Artist','Seed',[10000000]);
 const tracks=[seed,track('Neighbor','Nearby',[10001000]),track('Other','Far',[90000000]),track('Skipped','Skip',[],0),track('Seed Artist','Second'),track('Seed Artist','Third')];
 const result=E.fromCollection({tracks},{artist:'Seed Artist',title:'Seed'},{count:4,random:()=>0});
 assert.equal(result[0].title,'Second');assert.equal(result[1].artist,'Neighbor');assert.equal(result.length,4);assert.ok(result.every(t=>t.title!=='Seed'&&t.title!=='Skip'));assert.equal(new Set(result.map(t=>t.key)).size,4);
 const labeled=E.fromCollection({tracks:tracks.filter(t=>t.artist!=='Seed Artist'||t.title==='Seed')},{artist:'Seed Artist',title:'Seed'},{count:1,labels:{'seed artist':['indie'],other:['indie']},random:()=>0});assert.equal(labeled[0].artist,'Other');
});
test('unknown seed still builds from collection without requiring Spotify IDs',()=>{
 const result=E.fromCollection({tracks:[track('A','One'),track('B','Two')]},{artists:['Unknown'],title:'New song'},{count:20});assert.equal(result.length,2);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../playlist-engine.js');
const t=(artist,title,match)=>({artist,title,match});
test('widens pool through distinct strong anchors, retains seed similarity and survives branch failure',async()=>{
 const seed=t('Seed','Start'),calls=[];
 const pool=await E.similarPool(seed,async song=>{calls.push(song.artist);if(song.artist==='Seed')return [t('A','One',.9),t('A','Two',.8),t('B','Three',.7),t('Weak','Four',.1)];if(song.artist==='B')throw Error('offline');return [t('New','Fresh',.8),t('Seed','Start',1),t('Bad','Invalid','oops')];});
 assert.deepEqual(calls,['Seed','A','B']);assert.ok(pool.some(x=>x.artist==='New'));assert.ok(!pool.some(x=>x.artist==='Seed'||x.artist==='Bad'));assert.equal(pool.find(x=>x.artist==='New').similarity,.65*.9*.8);
});
test('similarity wins over play count; weak matches, duplicates, and artist flooding are excluded',()=>{
 const tracks=[{...t('Close','One'),similarity:.95,qualified:1},{...t('Popular','Two'),similarity:.2,qualified:100000},{...t('Weak','Three'),similarity:.01},...Array.from({length:8},(_,i)=>({...t('Same','Song '+i),similarity:.8}))];
 const result=E.selectSimilar([...tracks,tracks[0]],{count:20,random:()=>.5});
 assert.equal(result[0].artist,'Close');assert.equal(result.filter(x=>x.artist==='Same').length,3);assert.ok(!result.some(x=>x.artist==='Weak'));assert.equal(new Set(result.map(x=>x.key)).size,result.length);
});
test('recent recommendations rotate among close matches without displacing a much stronger match',()=>{
 const tracks=[{...t('A','One'),similarity:.9},{...t('B','Two'),similarity:.86},{...t('C','Three'),similarity:.2}];
 assert.equal(E.selectSimilar(tracks,{count:1,random:()=>.5})[0].artist,'A');
 assert.equal(E.selectSimilar(tracks,{count:1,recent:['a\0one'],random:()=>.5})[0].artist,'B');
});

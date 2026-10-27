'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../playlist-studio.js'),'utf8').split('// Keep imported listening history on this device across page reloads.')[1];
function setup(saved){
 const nodes=new Map(),writes=[];
 const store={get(){const request={};queueMicrotask(()=>{request.result=saved;request.onsuccess();});return request;},put(value){writes.push(value);}};
 const db={transaction(){return {objectStore:()=>store};}};
 const context={indexedDB:{open(){const request={};queueMicrotask(()=>{request.result=db;request.onsuccess();});return request;}},plays:[],labels:{},demo:false,importVersion:0,seen:new Set(),E:require('../playlist-engine.js'),refresh(){context.summary=context.E.summarize(context.plays);},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};
 vm.createContext(context);vm.runInContext(source+';globalThis.saveHistory=persistHistory;',context);return {context,writes};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('saved import restores plays, labels, and duplicate detection',async()=>{
 const play={artist:'Test artist',title:'Test song',ms:60000,date:1000,skipped:false};
 const {context}=setup({plays:[play],labels:{'test artist':['soul']}});await tick();
 assert.equal(context.summary.tracks[0].title,'Test song');assert.equal(context.labels['test artist'][0],'soul');assert.equal(context.seen.size,1);
});
test('new user action prevents late saved-history restoration',async()=>{
 const {context}=setup({plays:[{artist:'Old',title:'Old',ms:60000,date:1000}],labels:{}});context.importVersion++;await tick();assert.equal(context.plays.length,0);
});
test('saving snapshots imported plays and clearing stores an empty history',async()=>{
 const {context,writes}=setup(null);await tick();context.plays=[{title:'Saved song'}];context.saveHistory();context.plays=[];context.saveHistory();await tick();assert.equal(writes[0].plays[0].title,'Saved song');assert.equal(writes[1].plays.length,0);
});

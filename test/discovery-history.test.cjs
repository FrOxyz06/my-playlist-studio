'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('discovery reuses matching imported Spotify tracks instead of excluding them',async()=>{
 const nodes=new Map(),handlers={};const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='discovery-mode'?'discover':'6',disabled:false,reportValidity:()=>true,addEventListener(type,fn){handlers[id+':'+type]=fn;}});return nodes.get(id);};
 const track={key:'familiar artist\0familiar song',artist:'Familiar Artist',title:'Familiar Song',uri:'spotify:track:1234567890123456789012'};
 const context={URLSearchParams,AbortSignal,document:{getElementById:node},MutationObserver:class{observe(){}},window:{studioSeed:{title:'Seed Song',artist:'Seed Artist'}},summary:{tracks:[track]},playlist:[],demo:false,E:require('../playlist-engine.js'),SpotifyConnection:{connected:()=>true,api:async()=>{throw Error('Imported track should not need searching');}},fetch:async()=>({ok:true,json:async()=>({tracks:[{artist:track.artist,title:track.title,url:'https://www.last.fm/music/example'}]})}),render(){}};
 vm.createContext(context);const source=fs.readFileSync(require('node:path').join(__dirname,'../studio-polish.js'),'utf8');const start=source.indexOf("(()=>{const mode=document.getElementById('discovery-mode')");const end=source.indexOf("document.getElementById('recent-pick-first')",start);vm.runInContext(source.slice(start,end),context);await handlers['make:click']({stopImmediatePropagation(){}});assert.equal(context.playlist.length,1);assert.equal(context.playlist[0].uri,track.uri);
});

async function runFallback({fetch,api=async()=>({tracks:{items:[]}}),connected=true,tracks=[]}){
 const nodes=new Map(),handlers={};const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='discovery-mode'?'discover':'6',disabled:false,reportValidity:()=>true,addEventListener(type,fn){handlers[id+':'+type]=fn;}});return nodes.get(id);};
 const context={URLSearchParams,AbortSignal,document:{getElementById:node},MutationObserver:class{observe(){}},window:{studioSeed:{title:'Seed Song',artist:'Seed Artist'}},summary:{tracks},playlist:[],demo:false,E:require('../playlist-engine.js'),SpotifyConnection:{connected:()=>connected,api},fetch,render(){}};
 vm.createContext(context);const source=fs.readFileSync(require('node:path').join(__dirname,'../studio-polish.js'),'utf8');const start=source.indexOf("(()=>{const mode=document.getElementById('discovery-mode')"),end=source.indexOf("document.getElementById('recent-pick-first')",start);
 vm.runInContext(source.slice(start,end),context);await handlers['make:click']({stopImmediatePropagation(){}});return {context,status:node('status').textContent,handlers};
}
const localTrack={key:'local artist\0local song',artist:'Local Artist',title:'Local Song',qualified:4,dates:[],plays:4,uri:'spotify:track:1234567890123456789012'};
for(const kind of ['empty','http error','network error','no Spotify matches','Spotify error','disconnected']){
 test('collection fallback: '+kind,async()=>{
  const {context,status}=await runFallback({tracks:[localTrack],connected:kind!=='disconnected',fetch:async()=>{
   if(kind==='network error')throw Error('offline');
   return {ok:kind!=='http error',json:async()=>({tracks:kind==='empty'?[]:[{title:'Other song',artist:'Other artist'}]})};
  },api:async()=>{if(kind==='Spotify error')throw Error('unavailable');return {tracks:{items:[]}};}});
  assert.equal(context.playlist.length,1);assert.equal(context.playlist[0].uri,localTrack.uri);assert.match(status,/imported collection/);
 });
}
test('empty collection explains import requirement',async()=>{
 const {context,status}=await runFallback({tracks:[],connected:false});assert.equal(context.playlist.length,0);assert.match(status,/Import your Spotify listening history/);
});
test('clear during discovery prevents fallback from restoring cleared results',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 // Trigger clear from the request itself, before its result arrives.
 const nodes=new Map(),handlers={};const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='discovery-mode'?'discover':'6',disabled:false,reportValidity:()=>true,addEventListener(type,fn){handlers[id+':'+type]=fn;}});return nodes.get(id);};
 const context={URLSearchParams,AbortSignal,document:{getElementById:node},MutationObserver:class{observe(){}},window:{studioSeed:{title:'Seed Song',artist:'Seed Artist'}},summary:{tracks:[localTrack]},playlist:[],demo:false,E:require('../playlist-engine.js'),SpotifyConnection:{connected:()=>true},fetch:()=>pending,render(){throw Error('Must not render stale results');}};
 vm.createContext(context);const source=fs.readFileSync(require('node:path').join(__dirname,'../studio-polish.js'),'utf8');const start=source.indexOf("(()=>{const mode=document.getElementById('discovery-mode')"),end=source.indexOf("document.getElementById('recent-pick-first')",start);vm.runInContext(source.slice(start,end),context);
 const task=handlers['make:click']({stopImmediatePropagation(){}});handlers['clear:click']();resolve({ok:false});await task;assert.equal(context.playlist.length,0);
});

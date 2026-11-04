const {test}=require('node:test'),assert=require('node:assert/strict'),T=require('../playlist-transfer.js');
const songs=[{title:'One',artist:'A',uri:'spotify:track:1234567890123456789012',qualified:99,dates:[1],access_token:'secret'},{title:'Two',artist:'B'},{title:'One',artist:'A'}];
test('shared file preserves order and repeats but excludes private history and credentials',()=>{
 const text=T.encode('For a friend',songs),result=T.decode(text);
 assert.equal(result.name,'For a friend');assert.deepEqual(result.tracks.map(t=>t.title),['One','Two','One']);
 for(const key of ['qualified','dates','access_token','secret'])assert.ok(!text.includes(key));
});
test('invalid versions, history exports, empty files, invalid songs and oversized files fail',()=>{
 for(const value of ['bad','{}',JSON.stringify(songs),JSON.stringify({format:'playlist-studio',version:2,tracks:songs}),JSON.stringify({format:'playlist-studio',version:1,name:'X',tracks:[]}),JSON.stringify({format:'playlist-studio',version:1,name:'X',tracks:[{title:'X',artist:3}]})])assert.throws(()=>T.decode(value));
 assert.throws(()=>T.decode('x'.repeat(T.MAX_BYTES+1)));assert.throws(()=>T.encode('X',Array(5001).fill(songs[0])));
});
test('untrusted links and account information are discarded',()=>{
 const result=T.decode(JSON.stringify({format:'playlist-studio',version:1,name:'X',token:'private',tracks:[{title:'X',artist:'A',uri:'javascript:alert(1)',sourceUrl:'https://bad.example',durationMs:180000}]}));
 assert.deepEqual(result,{name:'X',tracks:[{title:'X',artist:'A',durationMs:180000}]});
});
test('Spotify saving batches shared lists and restarts incomplete saves without appending duplicates',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),nodes=new Map(),storage=new Map(),calls=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='name'?'Shared':'',disabled:false,hidden:false,addEventListener(){},replaceChildren(){},append(){}});return nodes.get(id);};
 let fail=true;
 const S={connected:()=>true,client:()=>'',canSave:()=>true,finish:()=>({then:()=>({catch(){}})}),api:async(url,options)=>{
  if(url==='/me')return {id:'me'};if(url==='/me/playlists'){calls.push('create');return {id:'p'};}
  const body=JSON.parse(options.body);calls.push([options.method,body.uris.length]);if(options.method==='POST'&&fail){fail=false;throw Error('offline');}return {};
 }};
 const context={SpotifyConnection:S,$:node,window:{},playlist:Array.from({length:205},(_,i)=>({title:'Song '+i,artist:'A',uri:'spotify:track:'+String(i).padStart(22,'0')})),demo:false,sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)},document:{createTextNode:t=>t,createElement:()=>({})},location:{protocol:'http:'}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../spotify-save.js'),'utf8'),context);
 await node('save-spotify').onclick();await node('save-spotify').onclick();
 assert.deepEqual(calls,['create',['PUT',100],['POST',100],['PUT',100],['POST',100],['POST',5]]);
});

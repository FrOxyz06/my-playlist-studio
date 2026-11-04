(function(root){
'use strict';
const MAX_TRACKS=5000,MAX_BYTES=5*1024*1024;
function cleanText(value,label,max=500){
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw Error('Invalid '+label+'.');
 return value.trim();
}
function sanitizeTrack(t){
 if(!t||typeof t!=='object')throw Error('Invalid song.');
 const title=cleanText(t.title,'song title'),artist=cleanText(t.artist,'artist');
 const result={title,artist};
 if(/^spotify:track:[A-Za-z0-9]{22}$/.test(t.uri||''))result.uri=t.uri;
 if(Number.isFinite(t.durationMs)&&t.durationMs>0&&t.durationMs<=86400000)result.durationMs=t.durationMs;
 return result;
}
function encode(name,tracks){
 if(!Array.isArray(tracks)||!tracks.length||tracks.length>MAX_TRACKS)throw Error('Choose between 1 and 5,000 songs.');
 const text=JSON.stringify({format:'playlist-studio',version:1,name:cleanText(name,'playlist name',200),tracks:tracks.map(sanitizeTrack)},null,2);
 if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Playlist file must be smaller than 5 MB.');
 return text;
}
function decode(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Playlist file must be smaller than 5 MB.');
 let file;try{file=JSON.parse(text);}catch{throw Error('Choose a Playlist Studio playlist JSON file.');}
 if(file?.format!=='playlist-studio'||file.version!==1)throw Error('Unsupported playlist file. Ask the sender to export a Playlist Studio playlist.');
 if(!Array.isArray(file.tracks)||!file.tracks.length||file.tracks.length>MAX_TRACKS)throw Error('Playlist must contain between 1 and 5,000 songs.');
 return {name:cleanText(file.name,'playlist name',200),tracks:file.tracks.map(sanitizeTrack)};
}
const api={encode,decode,MAX_BYTES};
if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
root.StudioTransfer=api;
const exportButton=document.getElementById('share-playlist'),input=document.getElementById('shared-playlist-file'),status=document.getElementById('shared-playlist-status'),dialog=document.getElementById('shared-playlist-preview');
let pending=null,revision=0;
exportButton.addEventListener('click',()=>{
 try{
  if(demo)throw Error('Make a playlist with your own songs before sharing.');
  const name=document.getElementById('name').value.trim()||'Shared playlist';
  const text=encode(name,playlist),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download=name.replace(/[^\p{L}\p{N} _-]/gu,'_').slice(0,80)+'.playlist.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.getElementById('status').textContent='Playlist file exported. Send it to your friend; they can choose Import shared playlist.';
 }catch(error){document.getElementById('status').textContent=error.message;}
});
input.addEventListener('change',async()=>{
 const file=input.files?.[0],ticket=++revision;input.value='';if(!file)return;
 try{
  if(file.size>MAX_BYTES)throw Error('Playlist file must be smaller than 5 MB.');
  const imported=decode(await file.text());if(ticket!==revision)return;
  pending=imported;document.getElementById('shared-preview-name').textContent=imported.name;
  document.getElementById('shared-preview-count').textContent=imported.tracks.length+' songs. Importing replaces your current mix.';
  const list=document.getElementById('shared-preview-tracks');list.replaceChildren();
  for(const t of imported.tracks.slice(0,8)){const item=document.createElement('li');item.textContent=t.title+' â€” '+t.artist;list.append(item);}
  status.textContent='';if(!dialog.open)dialog.showModal();
 }catch(error){status.textContent=error.message;}
});
document.getElementById('shared-preview-import').addEventListener('click',()=>{
 if(!pending)return;
 if(root.studioSaving||root.studioAccountBusy){document.getElementById('shared-preview-count').textContent='Finish the current save or account switch before importing.';return;}
 root.dispatchEvent(new Event('studio-playlist-import'));
 playlist=pending.tracks.map(t=>({...t,key:E.norm(t.artist)+'\0'+E.norm(t.title),reason:'Shared playlist'}));demo=false;
 document.getElementById('name').value=pending.name;document.getElementById('title').textContent=pending.name;
 sessionStorage.removeItem('studio-selected-playlist');sessionStorage.removeItem('studio-saved-playlist');
 render();document.getElementById('status').textContent='Imported '+playlist.length+' songs in their original order. Choose Convert to YouTube to match and save these songs.';
 pending=null;dialog.close();
});
document.getElementById('shared-preview-cancel').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{pending=null;});
document.getElementById('clear').addEventListener('click',()=>{revision++;pending=null;if(dialog.open)dialog.close();status.textContent='';});
})(globalThis);

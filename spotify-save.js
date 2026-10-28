'use strict';
(() => {
 const S=SpotifyConnection, status=$('spotify-status'), save=$('save-spotify'), pendingKey='studio-selected-playlist', savedKey='studio-saved-playlist';
 let saving=false;
 function update(){ $('disconnect-spotify').hidden=!S.connected();save.disabled=saving; }
 function rememberSelection(){sessionStorage.setItem(pendingKey,JSON.stringify({tracks:playlist,name:$('name').value,demo}));}
 $('client-id').value=S.client();
 $('connect-spotify').onclick=async()=>{if(saving||window.studioAccountBusy){status.textContent='Finish the current action before adding an account.';return;}try{rememberSelection();await S.connect($('client-id').value.trim(),true);}catch(e){status.textContent=e.message;}};
 $('disconnect-spotify').onclick=()=>{if(saving||window.studioAccountBusy)return;S.disconnect();window.studioProfile=null;window.dispatchEvent(new Event('studio-profile'));sessionStorage.removeItem(pendingKey);sessionStorage.removeItem(savedKey);status.textContent='Disconnected. Local playlist generation still works.';update();};
 $('clear').addEventListener('click',()=>{sessionStorage.removeItem(pendingKey);sessionStorage.removeItem(savedKey);});
 save.onclick=async()=>{
  if(saving||window.studioAccountBusy)return;
  if(!playlist.length||demo){status.textContent='Make a playlist from your own history first.';return;}
  if(!S.connected()){status.textContent='Sign in with Spotify to save your mix.';if(!$('connection').open)$('connection').showModal();$('connect-spotify').focus();return;}
  if(!S.canSave()){status.textContent='Reconnect to grant private playlist permission.';return;}
  saving=true;window.studioSaving=true;update();let saved=null;
  try{
   const tracks=playlist.map(t=>({...t})),name=$('name').value.trim()||'My next rotation';rememberSelection();
   status.textContent='Matching your selected songs on Spotify…';const uris=[],missing=[];
   const normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
   for(const t of tracks){if(/^spotify:track:[a-zA-Z0-9]{22}$/.test(t.uri||'')){uris.push(t.uri);continue;}const data=await S.api('/search?'+new URLSearchParams({q:'track:'+t.title+' artist:'+t.artist,type:'track',limit:'5'}));const match=data.tracks?.items?.find(x=>normalize(x.name)===normalize(t.title)&&x.artists?.some(a=>normalize(a.name)===normalize(t.artist)));if(match?.uri)uris.push(match.uri);else missing.push(t.title);}
   if(missing.length)throw Error('Remove these unmatched songs before saving: '+missing.join(', '));
   const unique=[...new Set(uris)];if(!unique.length)throw Error('No matching tracks to save.');
   const profile=await S.api('/me');const fingerprint=JSON.stringify({account:profile.id,name,uris:unique});
   try{saved=JSON.parse(sessionStorage.getItem(savedKey));}catch{}
   if(saved?.fingerprint!==fingerprint)saved=null;
   if(!saved){status.textContent='Creating your private playlist…';const created=await S.api('/me/playlists',{method:'POST',body:JSON.stringify({name,public:false,description:'Created locally with My Playlist Studio.'})});saved={id:created.id,fingerprint,complete:false};sessionStorage.setItem(savedKey,JSON.stringify(saved));}
   if(!saved.complete){await S.api('/playlists/'+encodeURIComponent(saved.id)+'/items',{method:'PUT',body:JSON.stringify({uris:unique})});saved.complete=true;sessionStorage.setItem(savedKey,JSON.stringify(saved));}
   status.replaceChildren(document.createTextNode('Saved '+unique.length+' songs to Spotify. '));const a=document.createElement('a');a.textContent='Open your playlist ↗';a.href='https://open.spotify.com/playlist/'+encodeURIComponent(saved.id);a.target='_blank';a.rel='noopener noreferrer';status.append(a);
  }catch(e){status.textContent=e.message+(saved&&!saved.complete?' Your playlist exists; click Save again to finish without duplicating songs.':'');}finally{saving=false;window.studioSaving=false;update();}
 };
 S.finish().then(async()=>{
  if(S.connected()){window.studioProfile=await S.api('/me');try{await S.rememberAccount(window.studioProfile);}catch(error){status.textContent=error.message;}window.dispatchEvent(new Event('studio-profile'));status.textContent='Connected. Make a playlist, then click Save to Spotify.';try{const pending=JSON.parse(sessionStorage.getItem(pendingKey));if(pending?.tracks?.length){playlist=pending.tracks;demo=!!pending.demo;$('name').value=pending.name||'My next rotation';render();notify('Your selected playlist is restored. Reimport history to generate additional mixes.');}}catch{}}
  else status.textContent=location.protocol==='file:'?'For Spotify saving, run Start Playlist Studio.cmd and open http://127.0.0.1:8791. Offline features still work here.':'Connect Spotify to enable direct saving.';update();
 }).catch(e=>{status.textContent=e.message;update();});
 update();
})();

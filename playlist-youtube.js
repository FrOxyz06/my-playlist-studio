'use strict';
(()=>{
 const button=document.createElement('button');button.type='button';button.className='secondary youtube-launch';button.textContent='Save to YouTube';document.getElementById('save-spotify').after(button);
 const nav=document.createElement('button');nav.type='button';nav.className='nav-item youtube-nav';nav.innerHTML='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/></svg><span>YouTube transfer</span>' ;document.querySelector('.rail nav').append(nav);
 const dialog=document.createElement('dialog');dialog.className='youtube-dialog';dialog.setAttribute('aria-labelledby','youtube-title');
 dialog.innerHTML=`<div class="youtube-heading settings-dialog-heading"><div><span class="settings-eyebrow">PLAYLIST STUDIO / YOUTUBE</span><h2 id="youtube-title">Your music, on YouTube.</h2><p>Connect your account, choose the right recordings, and save your mix.</p></div><button type="button" class="secondary settings-close" id="youtube-close" aria-label="Close YouTube transfer">Close</button></div>
 <div class="youtube-layout">
 <aside class="youtube-account-panel" aria-label="YouTube connection settings">
 <div class="settings-service-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="m10 9 5 3-5 3Z"/></svg></div>
 <span class="settings-eyebrow">01 / CONNECTION</span><h3>Your YouTube account</h3>
 <span id="youtube-connection-state" class="settings-state" role="status">Checking connection</span>
 <p id="youtube-account" class="field-help">Checking YouTube connection.</p>
 <div class="connect-row youtube-actions"><button id="youtube-connect" class="secondary" type="button">Connect YouTube</button><button id="youtube-disconnect" class="text-button" type="button" hidden>Disconnect</button></div>
 <details class="youtube-setup"><summary>Google app setup<span class="setup-summary-hint">OAuth configuration</span></summary>
 <p class="field-help">Set up once, then sign in with your Google account.</p>
 <ol class="setup-steps"><li><strong>Create your project</strong><span>In <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>, enable YouTube Data API v3.</span></li><li><strong>Allow your accounts</strong><span>Configure Google Auth Platform. While testing, add your email and your friend's email as test users.</span></li><li><strong>Load the configuration</strong><span>Create a <b>Desktop app</b> OAuth client and download its JSON file.</span></li></ol>
 <label class="secondary import-labels youtube-config-label" for="youtube-config">Load Google OAuth JSON<input id="youtube-config" type="file" accept=".json,application/json"></label></details>
 <p class="settings-privacy-note">Your configuration is encrypted on this computer. Sign-in opens in your browser. Access tokens are cleared when you disconnect or close the app.</p>
 </aside>
 <section class="youtube-transfer-panel" aria-labelledby="youtube-review-title">
 <div class="youtube-review-heading"><div><span class="settings-eyebrow">02 / MATCH & REVIEW</span><h3 id="youtube-review-title">Choose your recordings</h3></div><button id="youtube-match" class="secondary" type="button">Find YouTube matches</button></div>
 <p id="youtube-source" class="field-help"></p><p id="youtube-status" class="youtube-feedback" role="status" aria-live="polite"></p>
 <ol id="youtube-matches" class="youtube-matches"></ol>
 <div class="youtube-save-panel"><span class="settings-eyebrow">03 / SAVE YOUR MIX</span>
 <div class="youtube-save-fields"><div><label for="youtube-name">Playlist name</label><input id="youtube-name" maxlength="150" placeholder="Give your playlist a name"></div><div><label for="youtube-privacy">Visibility</label><select id="youtube-privacy"><option value="private">Private</option><option value="unlisted">Unlisted — share by link</option><option value="public">Public</option></select></div></div>
 <label class="youtube-confirm"><input id="youtube-reviewed" type="checkbox"><span>I reviewed the matches and am ready to create this playlist.</span></label>
 <div class="youtube-save-footer"><p id="youtube-summary" class="field-help"></p><button id="youtube-create" class="primary" type="button" disabled>Create playlist</button></div></div>
 </section></div>`;
 document.body.append(dialog);
 const $y=id=>document.getElementById('youtube-'+id),message=$y('status');let tracks=[],rows=[],signature='',busy=false,connected=false,configured=false,locked=false,completed=false;
 async function call(action,value){if(!globalThis.studioYouTube)throw Error('YouTube conversion is available in the desktop app. Open the updated Playlist Studio build.');const result=await studioYouTube.call(action,value);if(!result.ok)throw Error(result.error);return result.value;}
 function selected(){return rows.map(row=>row.selected).filter(Boolean);}
 function sync(){
  window.studioYouTubeBusy=busy;
  const count=selected().length;$y('summary').textContent=count+' of '+tracks.length+' songs selected. Songs without a selected match will be skipped. Original order is preserved.';
  $y('create').disabled=busy||!connected||!count||!$y('reviewed').checked||completed;
  $y('match').disabled=busy||!connected||!tracks.length||locked||rows.every(row=>row.done);
  $y('connect').disabled=busy||!configured;$y('disconnect').disabled=busy;$y('config').disabled=busy||locked;
  $y('name').disabled=busy||locked;$y('privacy').disabled=busy||locked;$y('reviewed').disabled=busy||locked;
  for(const row of rows)if(row.select)row.select.disabled=busy||locked||!row.done;
 }
 async function account(){const status=await call('status');connected=status.connected;configured=status.configured;$y('connection-state').textContent=connected?'Connected':configured?'Ready to connect':'Setup needed';$y('connection-state').classList.toggle('is-connected',connected);$y('connection-state').classList.toggle('needs-setup',!configured);dialog.querySelector('.youtube-setup').open=!configured;$y('account').textContent=connected?'Connected to YouTube: '+status.channel:status.configured?'Google setup is loaded. Connect your YouTube account.':'Load your Google OAuth JSON below to enable sign-in.';$y('disconnect').hidden=!connected;$y('connect').textContent=connected?'Switch YouTube account':'Connect YouTube';sync();return status;}
 function renderRows(){
  const list=$y('matches');list.replaceChildren();
  rows.forEach((row,index)=>{
   const item=document.createElement('li'),identity=document.createElement('strong');identity.textContent=tracks[index].title;const artist=document.createElement('span');artist.className='youtube-track-artist';artist.textContent=tracks[index].artist;item.append(identity,artist);
   const select=document.createElement('select');select.setAttribute('aria-label','YouTube match for '+tracks[index].title);
   const skip=document.createElement('option');skip.value='';skip.textContent=row.done?(row.candidates.length?'Skip this song':'No matches — skipped'):'Find matches to choose a video';select.append(skip);
   for(const candidate of row.candidates){const option=document.createElement('option');option.value=candidate.id;option.textContent=candidate.title+' · '+candidate.channel+(candidate.score<.85?' (review carefully)':'');select.append(option);}
   select.value=row.selected;select.disabled=!row.done;row.select=select;
   const link=document.createElement('a');link.textContent='Open on YouTube';link.target='_blank';link.rel='noopener noreferrer';
   const updateLink=()=>{link.hidden=!row.selected;if(row.selected)link.href='https://www.youtube.com/watch?v='+encodeURIComponent(row.selected);};updateLink();
   select.addEventListener('change',()=>{row.selected=select.value;updateLink();$y('reviewed').checked=false;sync();});item.append(select,link);list.append(item);
  });sync();
 }
 async function open(){
  const source=demo?[]:playlist.map(t=>({title:t.title,artist:t.artist,...(t.durationMs?{durationMs:t.durationMs}:{})})),next=JSON.stringify(source);
  if(next!==signature&&!locked){signature=next;tracks=source;rows=tracks.map(()=>({done:false,candidates:[],selected:''}));completed=false;$y('create').textContent='Create playlist';$y('reviewed').checked=false;$y('name').value=(document.getElementById('name').value.trim()||'My playlist').slice(0,150);$y('privacy').value='private';renderRows();}
  $y('source').textContent=tracks.length?tracks.length+' songs from your current playlist. Matching sends song titles and artists to YouTube.':'Make a mix or import a shared playlist first.';
  $y('matches').hidden=!tracks.length;if(!dialog.open)dialog.showModal();try{await account();}catch(error){message.textContent=error.message;sync();}
 }
 button.addEventListener('click',open);nav.addEventListener('click',open);$y('close').addEventListener('click',()=>dialog.close());
 $y('config').addEventListener('change',async()=>{const file=$y('config').files?.[0];$y('config').value='';if(!file)return;busy=true;sync();try{if(file.size>100000)throw Error('Choose a Google OAuth client JSON smaller than 100 KB.');const value=JSON.parse(await file.text());await call('configure',value);await account();message.textContent='Google setup saved. Connect YouTube to continue.';}catch(error){message.textContent=error.message;}finally{busy=false;sync();}});
 $y('connect').addEventListener('click',async()=>{busy=true;sync();try{message.textContent='Complete Google sign-in in your browser, then return here.';await call('connect');completed=false;if(!locked)$y('reviewed').checked=false;await account();message.textContent='YouTube connected. Find matches, then review your selections.';}catch(error){message.textContent=error.message;}finally{busy=false;sync();}});
 $y('disconnect').addEventListener('click',async()=>{busy=true;sync();try{await call('disconnect');locked=false;completed=false;await account();message.textContent='Disconnected. No YouTube access token is kept by this app.';}catch(error){message.textContent=error.message;}finally{busy=false;sync();}});
 $y('match').addEventListener('click',async()=>{
  busy=true;$y('reviewed').checked=false;sync();let searched=0;
  try{for(let i=0;i<rows.length&&searched<50;i++){if(rows[i].done)continue;message.textContent='Finding YouTube matches: song '+(i+1)+' of '+rows.length+'.';const candidates=await call('search',tracks[i]);rows[i].candidates=candidates;rows[i].selected=candidates[0]?.score>=.85?candidates[0].id:'';rows[i].done=true;searched++;}message.textContent=rows.every(r=>r.done)?'Matching complete. Review the selected recordings before creating your playlist.':'Matched the next '+searched+' songs. Click Find YouTube matches to continue, or save the songs already selected.';}catch(error){message.textContent=error.message;}finally{busy=false;renderRows();}
 });
 $y('reviewed').addEventListener('change',sync);
 $y('create').addEventListener('click',async()=>{
  const name=$y('name').value.trim();if(!name){message.textContent='Enter a playlist name.';return;}
  busy=true;locked=true;sync();message.textContent='Creating your YouTube playlist. Keep this window open.';
  try{const result=await call('create',{name,privacy:$y('privacy').value,ids:selected()});completed=true;message.replaceChildren(document.createTextNode('Saved '+result.count+' songs. '));const link=document.createElement('a');link.textContent='Open your YouTube playlist';link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';message.append(link);$y('create').textContent='Playlist created';locked=false;}
  catch(error){message.textContent=error.message+' Your selections are locked so Retry can continue the same playlist.';$y('create').textContent='Retry saving playlist';}
  finally{busy=false;sync();}
 });
})();

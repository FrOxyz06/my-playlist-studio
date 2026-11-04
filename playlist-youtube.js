'use strict';
(()=>{
 const button=document.createElement('button');button.type='button';button.className='secondary youtube-launch';button.textContent='Convert to YouTube';document.getElementById('save-spotify').after(button);
 const nav=document.createElement('button');nav.type='button';nav.className='nav-item youtube-nav';nav.textContent='YouTube transfer';document.querySelector('.rail nav').append(nav);
 const dialog=document.createElement('dialog');dialog.className='youtube-dialog';dialog.setAttribute('aria-labelledby','youtube-title');
 dialog.innerHTML=`<div class="youtube-heading"><div><h2 id="youtube-title">Take your playlist to YouTube</h2><p>Match songs, review the versions, then save to your channel.</p></div><button type="button" class="secondary" id="youtube-close">Close</button></div>
 <p id="youtube-account" class="field-help">Checking YouTube connection.</p>
 <details class="youtube-setup"><summary>One-time Google setup</summary><ol><li>In <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>, create a project and enable YouTube Data API v3.</li><li>Configure Google Auth Platform for your app. While it is in testing, add your Google account and your friend's account as test users.</li><li>Create an OAuth client of type <strong>Desktop app</strong>, download its JSON, and load it below.</li></ol><p class="field-help">The client configuration is encrypted on this computer. Your Google sign-in opens in your browser; access tokens stay in app memory until you disconnect or close the app.</p><label class="secondary import-labels youtube-config-label">Load Google OAuth JSON<input id="youtube-config" type="file" accept=".json,application/json"></label></details>
 <div class="connect-row youtube-actions"><button id="youtube-connect" class="secondary" type="button">Connect YouTube</button><button id="youtube-disconnect" class="text-button" type="button" hidden>Disconnect</button><button id="youtube-match" class="secondary" type="button">Find YouTube matches</button></div>
 <p id="youtube-source" class="field-help"></p><p id="youtube-status" role="status" aria-live="polite"></p><ol id="youtube-matches" class="youtube-matches"></ol>
 <div class="youtube-save-fields"><div><label for="youtube-name">Playlist name</label><input id="youtube-name" maxlength="150"></div><div><label for="youtube-privacy">Visibility</label><select id="youtube-privacy"><option value="private">Private</option><option value="unlisted">Unlisted — share by link</option><option value="public">Public</option></select></div></div>
 <label class="youtube-confirm"><input id="youtube-reviewed" type="checkbox">I reviewed the selected matches and want to create this YouTube playlist.</label><p id="youtube-summary" class="field-help"></p><button id="youtube-create" class="primary" type="button" disabled>Create YouTube playlist</button>`;
 document.body.append(dialog);
 const $y=id=>document.getElementById('youtube-'+id),message=$y('status');let tracks=[],rows=[],signature='',busy=false,connected=false,locked=false,completed=false;
 async function call(action,value){if(!globalThis.studioYouTube)throw Error('YouTube conversion is available in the desktop app. Open the updated Playlist Studio build.');const result=await studioYouTube.call(action,value);if(!result.ok)throw Error(result.error);return result.value;}
 function selected(){return rows.map(row=>row.selected).filter(Boolean);}
 function sync(){
  const count=selected().length;$y('summary').textContent=count+' of '+tracks.length+' songs selected. Songs without a selected match will be skipped. Original order is preserved.';
  $y('create').disabled=busy||!connected||!count||!$y('reviewed').checked||completed;
  $y('match').disabled=busy||!connected||!tracks.length||locked||rows.every(row=>row.done);
  $y('connect').disabled=busy;$y('disconnect').disabled=busy;$y('config').disabled=busy||locked;
  $y('name').disabled=busy||locked;$y('privacy').disabled=busy||locked;$y('reviewed').disabled=busy||locked;
  for(const row of rows)if(row.select)row.select.disabled=busy||locked;
 }
 async function account(){const status=await call('status');connected=status.connected;$y('account').textContent=connected?'Connected to YouTube: '+status.channel:status.configured?'Google setup is loaded. Connect your YouTube account.':'Load your Google Desktop OAuth JSON under One-time Google setup.';$y('disconnect').hidden=!connected;$y('connect').textContent=connected?'Switch YouTube account':'Connect YouTube';sync();return status;}
 function renderRows(){
  const list=$y('matches');list.replaceChildren();
  rows.forEach((row,index)=>{
   const item=document.createElement('li'),identity=document.createElement('strong');identity.textContent=tracks[index].title+' — '+tracks[index].artist;item.append(identity);
   const select=document.createElement('select');select.setAttribute('aria-label','YouTube match for '+tracks[index].title);
   const skip=document.createElement('option');skip.value='';skip.textContent=row.done?(row.candidates.length?'Skip this song':'No matches — skipped'):'Not searched — skipped';select.append(skip);
   for(const candidate of row.candidates){const option=document.createElement('option');option.value=candidate.id;option.textContent=candidate.title+' · '+candidate.channel+(candidate.score<.85?' (review carefully)':'');select.append(option);}
   select.value=row.selected;row.select=select;
   const link=document.createElement('a');link.textContent='Open on YouTube';link.target='_blank';link.rel='noopener noreferrer';
   const updateLink=()=>{link.hidden=!row.selected;if(row.selected)link.href='https://www.youtube.com/watch?v='+encodeURIComponent(row.selected);};updateLink();
   select.addEventListener('change',()=>{row.selected=select.value;updateLink();$y('reviewed').checked=false;sync();});item.append(select,link);list.append(item);
  });sync();
 }
 async function open(){
  const source=demo?[]:playlist.map(t=>({title:t.title,artist:t.artist,...(t.durationMs?{durationMs:t.durationMs}:{})})),next=JSON.stringify(source);
  if(next!==signature&&!locked){signature=next;tracks=source;rows=tracks.map(()=>({done:false,candidates:[],selected:''}));completed=false;$y('reviewed').checked=false;$y('name').value=(document.getElementById('name').value.trim()||'My playlist').slice(0,150);$y('privacy').value='private';renderRows();}
  $y('source').textContent=tracks.length?tracks.length+' songs from your current playlist. Matching sends song titles and artists to YouTube.':'Make a mix or import a shared playlist first.';
  if(!dialog.open)dialog.showModal();try{await account();}catch(error){message.textContent=error.message;sync();}
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

'use strict';
(()=>{
 const api=globalThis.studioUpdateDialog;if(!api)return;
 const panel=document.createElement('dialog');panel.className='studio-update-dialog';panel.setAttribute('aria-labelledby','update-dialog-title');panel.setAttribute('aria-describedby','update-dialog-copy');
 panel.innerHTML=`<div class="update-dialog-art" aria-hidden="true"><div class="update-mini-record"><span></span></div><span class="update-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 18V6m-5 5 5-5 5 5"/></svg></span></div><div class="update-dialog-meta"><span>Playlist Studio</span><span id="update-dialog-version" class="update-version"></span></div><h2 id="update-dialog-title"></h2><p id="update-dialog-copy"></p><p id="update-dialog-detail" class="field-help"></p><div id="update-dialog-progress" hidden><div class="update-progress-track"><div id="update-progress-fill"></div></div><div class="update-progress-caption"><span>Downloading update</span><span id="update-progress-percent"></span></div></div><p id="update-dialog-busy" class="field-help" hidden>Finish your current action before restarting.</p><div class="update-dialog-actions"><button id="update-dialog-later" class="secondary" type="button">Later</button><button id="update-dialog-action" class="primary" type="button"></button></div><span class="update-dialog-footnote" id="update-dialog-footnote"></span>`;
 document.body.append(panel);
 const get=id=>document.getElementById(id);let prompt=null,mode='prompt',timer=null,lastFocus=null,replying=false;
 const working=()=>!!(window.studioSaving||window.studioAccountBusy||window.studioYouTubeBusy||document.getElementById('files')?.disabled);
 function close(){clearInterval(timer);timer=null;if(panel.open)panel.close();lastFocus?.focus?.({preventScroll:true});}
 async function refresh(){
  try{const state=await globalThis.studioDesktop?.getUpdateStatus();if(!panel.open)return;
   get('update-dialog-version').textContent=state?.version?'Version '+state.version:'';
   if(mode==='download'&&state){const percent=state.progress;get('update-progress-percent').textContent=Number.isFinite(percent)?Math.floor(percent)+'%':'';get('update-progress-fill').style.width=Number.isFinite(percent)?Math.min(100,Math.max(0,percent))+'%':'0%';}
  }catch{}
  const blocked=prompt?.title==='Update ready'&&working();get('update-dialog-action').disabled=replying||!!blocked;get('update-dialog-busy').hidden=!blocked;
 }
 function open(){if(!panel.open){lastFocus=document.activeElement;panel.showModal();}clearInterval(timer);timer=setInterval(refresh,500);refresh();}
 api.onPrompt(data=>{
  if(data.dismiss){if(prompt?.id===data.id){prompt=null;close();}return;}
  prompt=data;mode='prompt';replying=false;
  const ready=data.title==='Update ready',available=data.title==='Update available',confirm=ready||available;
  panel.classList.toggle('is-ready',ready);panel.classList.remove('is-downloading');
  get('update-dialog-title').textContent=ready?'Your update is ready':available?'A new version is available':data.title;
  get('update-dialog-copy').textContent=ready?'Restart Playlist Studio to install the downloaded update.':data.message;
  get('update-dialog-detail').textContent=ready?'Your collection and settings stay on this device.':data.detail;
  get('update-dialog-progress').hidden=true;get('update-dialog-later').hidden=!confirm;get('update-dialog-later').textContent='Later';
  get('update-dialog-action').hidden=false;get('update-dialog-action').textContent=ready?'Restart & update':available?'Download update':'Got it';
  get('update-dialog-footnote').textContent=ready?'The app will close and reopen.':available?'Keep listening while the update downloads.':'';
  open();if(confirm)get('update-dialog-later').focus();else get('update-dialog-action').focus();
 });
 async function reply(response){
  if(replying)return;if(response===0&&prompt?.title==='Update ready'&&working()){refresh();return;}
  const current=prompt;if(!current){close();return;}replying=true;get('update-dialog-action').disabled=true;
  try{
   const accepted=await api.respond(current.id,response);if(prompt?.id!==current.id)return;
   if(accepted&&response===0&&current.title==='Update available'){
    prompt=null;mode='download';panel.classList.add('is-downloading');get('update-dialog-title').textContent='Getting your update ready';get('update-dialog-copy').textContent='You can keep using Playlist Studio while this downloads.';get('update-dialog-detail').textContent='';get('update-dialog-progress').hidden=false;get('update-dialog-action').hidden=true;get('update-dialog-later').hidden=false;get('update-dialog-later').textContent='Keep using Studio';get('update-dialog-footnote').textContent='You choose when to restart.';refresh();
   }else{prompt=null;close();}
  }catch{if(prompt?.id===current.id){get('update-dialog-copy').textContent='Could not complete the update action. Close this dialog and try the update icon again.';}}
  finally{replying=false;refresh();}
 }
 get('update-dialog-action').addEventListener('click',()=>reply(0));get('update-dialog-later').addEventListener('click',()=>reply(1));
 panel.addEventListener('cancel',event=>{event.preventDefault();reply(1);});
 window.addEventListener('pagehide',()=>{clearInterval(timer);if(prompt)api.respond(prompt.id,1).catch(()=>{});});
})();

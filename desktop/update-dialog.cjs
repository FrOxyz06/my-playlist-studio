'use strict';
const {randomUUID}=require('node:crypto');
function createUpdateDialog({timeoutMs=180000}={}){
 let pending=null;
 function showMessageBox(owner,options){
  if(!owner||owner.isDestroyed()||pending)return Promise.resolve({response:1});
  return new Promise(resolve=>{
   const id=randomUUID(),contents=owner.webContents;
   const finish=response=>{if(pending?.id!==id)return;clearTimeout(pending.timer);owner.removeListener('closed',cancel);contents.removeListener('did-start-navigation',navigation);pending=null;resolve({response});};
   const cancel=()=>finish(1),navigation=(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)cancel();};
   pending={id,finish,timer:setTimeout(()=>{try{if(!owner.isDestroyed())contents.send('updates:prompt',{id,dismiss:true});}finally{cancel();}},timeoutMs)};
   pending.timer.unref?.();owner.once('closed',cancel);contents.on('did-start-navigation',navigation);
   try{contents.send('updates:prompt',{id,title:options.title,message:options.message,detail:options.detail||'',buttons:options.buttons,type:options.type||'info'});}catch{cancel();}
  });
 }
 function respond(id,response){if(!pending||pending.id!==id||![0,1].includes(response))return false;pending.finish(response);return true;}
 return {showMessageBox,respond};
}
module.exports={createUpdateDialog};

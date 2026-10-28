
'use strict';
function setupUpdates({updater,dialog,getWindow,log,enabled,silentStartup=false}){
 let available=null;
 let checking=false,downloading=false,ready=false,prompting=false,manual=false;
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;updater.logger=log;
 const show=options=>{const owner=getWindow();return owner&&!owner.isDestroyed()?dialog.showMessageBox(owner,options):Promise.resolve({response:1});};
 async function failure(error){log.warn('Update request failed',error?.code||'unavailable');if(manual||downloading)await show({type:'info',title:'Updates unavailable',message:'Could not check or download an update. Try again later.',buttons:['OK']});}
 async function restart(){if(prompting)return;prompting=true;try{const {response}=await show({type:'info',title:'Update ready',message:'Restart Playlist Studio to install the update?',detail:'Your imported collection and settings stay on this device.',buttons:['Restart and install','Later'],defaultId:0,cancelId:1});if(response===0)updater.quitAndInstall(false,true);}finally{prompting=false;}}
 updater.on('update-available',async info=>{
  available={version:info.version};if(silentStartup&&!manual)return;
  if(prompting||downloading||ready)return;prompting=true;
  try{const {response}=await show({type:'info',title:'Update available',message:'Playlist Studio '+info.version+' is available.',buttons:['Download update','Later'],defaultId:0,cancelId:1});if(response===0){downloading=true;await updater.downloadUpdate();}}
  catch(error){await failure(error);}finally{downloading=false;prompting=false;manual=false;if(ready)await restart();}
 });
 updater.on('update-downloaded',()=>{ready=true;if(!prompting)void restart();});
 updater.on('error',error=>{log.warn('Updater error',error?.code||'unavailable');});
 async function check(userRequested=false){
  if(!enabled){if(userRequested)await show({type:'info',title:'App updates',message:'Install the desktop release to receive updates.',buttons:['OK']});return;}
  if(ready)return restart();if(userRequested&&available&&!prompting&&!downloading){manual=true;updater.emit('update-available',available);return;}if(checking||downloading||prompting)return;
  checking=true;manual=userRequested;
  try{const result=await updater.checkForUpdates();if(userRequested&&result?.updateInfo?.version===updater.currentVersion.version)await show({type:'info',title:'Up to date',message:'You have the latest version of Playlist Studio.',buttons:['OK']});}
  catch(error){await failure(error);}finally{checking=false;manual=false;}
 }
 return {check,status:()=>({available:!!available,version:available?.version||null,ready,downloading})};
}
module.exports={setupUpdates};

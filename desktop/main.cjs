'use strict';
const {app,BrowserWindow,ipcMain,safeStorage,shell,dialog,Menu}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const log=require('electron-log/main');
const origin='http://127.0.0.1:8791',month=30*86400000;
let window,server,vaultQueue=Promise.resolve();
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(window){window.restore();window.focus();}});
app.whenReady().then(start).catch(error=>{dialog.showErrorBox('Playlist Studio could not start',error.code==='EADDRINUSE'?'Close the browser version’s local server, then open Playlist Studio again.':error.message);app.quit();});
}
function trusted(event){if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Untrusted application request.');}
function queue(task){const result=vaultQueue.then(task);vaultQueue=result.catch(()=>{});return result;}
async function start(){
log.info('Starting Playlist Studio');
app.setAppUserModelId('com.froxyz.playliststudio');
const data=app.getPath('userData'),vault=path.join(data,'spotify-session.bin');await fs.mkdir(data,{recursive:true});
process.env.PLAYLIST_STUDIO_CONFIG=path.join(data,'lastfm.local.json');
if(!app.isPackaged)try{await fs.copyFile(path.join(__dirname,'../lastfm.local.json'),process.env.PLAYLIST_STUDIO_CONFIG,require('node:fs').constants.COPYFILE_EXCL);}catch{}
ipcMain.handle('chrome:appearance',(event,appearance)=>{trusted(event);if(appearance!=='dark'&&appearance!=='light')throw Error('Invalid appearance.');window.setTitleBarOverlay({color:appearance==='dark'?'#172124':'#f3f5f5',symbolColor:appearance==='dark'?'#d4e1dc':'#263d37',height:56});});
ipcMain.handle('session:load',event=>{trusted(event);return queue(async()=>{try{const saved=JSON.parse(safeStorage.decryptString(await fs.readFile(vault)));if(!Number.isFinite(saved.authorizedAt)||Date.now()-saved.authorizedAt>=month||saved.authorizedAt>Date.now()){await fs.rm(vault,{force:true});return null;}return saved;}catch{return null;}});});
ipcMain.handle('session:save',(event,saved)=>{trusted(event);return queue(async()=>{if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure storage is unavailable.');if(!saved||typeof saved.access_token!=='string'||typeof saved.refresh_token!=='string'||!Number.isFinite(saved.authorizedAt)||Date.now()-saved.authorizedAt>=month||saved.authorizedAt>Date.now())throw Error('Reconnect Spotify to save this session.');const temporary=vault+'.tmp';await fs.writeFile(temporary,safeStorage.encryptString(JSON.stringify(saved)));await fs.rename(temporary,vault);});});
const accountsVault=path.join(data,'spotify-accounts.bin');
ipcMain.handle('accounts:load',event=>{trusted(event);return queue(async()=>{try{return JSON.parse(safeStorage.decryptString(await fs.readFile(accountsVault)));}catch(error){if(error.code==='ENOENT')return [];throw Error('Could not read saved accounts.');}});});
ipcMain.handle('accounts:save',(event,list)=>{trusted(event);return queue(async()=>{
 if(!safeStorage.isEncryptionAvailable())throw Error('Windows secure storage is unavailable.');
 if(!Array.isArray(list)||list.length>10||JSON.stringify(list).length>200000||list.some(a=>typeof a?.profile?.id!=='string'||!a.profile.id||typeof a.clientId!=='string'||!a.session||typeof a.session.access_token!=='string'||typeof a.session.refresh_token!=='string'||!Number.isFinite(a.session.authorizedAt)))throw Error('Invalid saved accounts.');
 const temporary=accountsVault+'.tmp';await fs.writeFile(temporary,safeStorage.encryptString(JSON.stringify(list)));await fs.rename(temporary,accountsVault);
});});
ipcMain.handle('session:clear',event=>{trusted(event);return queue(()=>fs.rm(vault,{force:true}));});
server=require('../studio-server.cjs').server;server.desktopMode=true;
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8791,'127.0.0.1',resolve);});
window=new BrowserWindow({width:1280,height:900,minWidth:760,minHeight:620,title:'Playlist Studio',backgroundColor:'#1b272a',show:false,titleBarStyle:'hidden',titleBarOverlay:{color:'#1b272a',symbolColor:'#cbdad4',height:56},webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
window.once('ready-to-show',()=>window.show());
const external=url=>{try{const u=new URL(url);if(u.protocol==='https:'&&['accounts.spotify.com','open.spotify.com','www.last.fm','developer.spotify.com'].includes(u.hostname))shell.openExternal(url);}catch{}};
window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();external(url);}});
window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
server.on('desktop-callback',url=>{if(window&&!window.isDestroyed()){window.loadURL(origin+'/'+new URL(url,origin).search);window.show();window.focus();}});
Menu.setApplicationMenu(null);
const updates=require('./updates.cjs').setupUpdates({updater:require('electron-updater').autoUpdater,dialog,getWindow:()=>window,log,enabled:app.isPackaged,silentStartup:true});
ipcMain.handle('updates:status',event=>{trusted(event);return updates.status();});
ipcMain.handle('updates:check',event=>{trusted(event);return updates.check(true);});
await window.loadURL(origin+'/');window.show();window.focus();log.info('Workspace loaded');
const updateTimer=setTimeout(()=>updates.check(false),8000);updateTimer.unref();const updateInterval=setInterval(()=>updates.check(false),6*60*60*1000);updateInterval.unref();
}
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{if(server?.listening)server.close();});

'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studioDesktop',Object.freeze({loadAccounts:()=>ipcRenderer.invoke('accounts:load'),saveAccounts:list=>ipcRenderer.invoke('accounts:save',list),checkForUpdates:()=>ipcRenderer.invoke('updates:check'),setAppearance:appearance=>ipcRenderer.invoke('chrome:appearance',appearance),loadSession:()=>ipcRenderer.invoke('session:load'),saveSession:data=>ipcRenderer.invoke('session:save',data),clearSession:()=>ipcRenderer.invoke('session:clear')}));

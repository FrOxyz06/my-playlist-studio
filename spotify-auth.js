'use strict';
// PKCE uses a public client ID. Desktop sessions are encrypted and expire after 30 days.
const SpotifyConnection = (() => {
  const redirect = 'http://127.0.0.1:8791/callback';
  const scopes = 'playlist-modify-private';
  const key = 'playlist-studio-spotify';
  const defaultClient = '174eb68079f34f59b1b4ab135823aa20';
  let tokens = null, refreshing = null;
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
  async function restore() { try { tokens = globalThis.studioDesktop ? await globalThis.studioDesktop.loadSession() : JSON.parse(sessionStorage.getItem(key)); } catch { tokens = null; } if(globalThis.studioDesktop&&tokens&&(!tokens.authorizedAt||Date.now()-tokens.authorizedAt>=30*86400000)){disconnect();} }
  async function remember(data) {
    if (!data.access_token || !data.expires_in) throw new Error('Spotify did not return a usable token.');
    tokens = {access_token:data.access_token, refresh_token:data.refresh_token || tokens?.refresh_token, expires:Date.now()+data.expires_in*1000, scope:data.scope || tokens?.scope || '', authorizedAt:tokens?.authorizedAt || Date.now(),accountId:tokens?.accountId};
    if(globalThis.studioDesktop)await globalThis.studioDesktop.saveSession(tokens);else sessionStorage.setItem(key, JSON.stringify(tokens));
    if(tokens.accountId){const snapshot={...tokens};await accountTask(async()=>{const list=await readAccounts();const entry=list.find(a=>a.profile?.id===snapshot.accountId);if(entry){entry.session=snapshot;await writeAccounts(list);}});}
  }
  async function token(body) {
    const r = await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});
    if (!r.ok) throw new Error('Spotify sign-in expired or the app settings do not match. Connect again.');
    return r.json();
  }
  async function connect(clientId=localStorage.getItem(key+'-client')||defaultClient,addAccount=false) {
    if (!/^[a-f0-9]{32}$/i.test(clientId)) throw new Error('Enter the Client ID from your Spotify developer app. Do not enter a Client Secret.');
    if (location.origin !== 'http://127.0.0.1:8791') throw new Error('Open this app at http://127.0.0.1:8791 before connecting.');
    const verifier = random(), state = random();
    localStorage.setItem(key+'-client',clientId);
    sessionStorage.setItem(key+'-pending',JSON.stringify({verifier,state,time:Date.now()}));
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    const params = new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirect,scope:scopes,state,code_challenge_method:'S256',code_challenge:challenge});
    if(addAccount)params.set('show_dialog','true');
    location.assign('https://accounts.spotify.com/authorize?'+params);
  }
  async function finish() {
    await restore();
    const query = new URLSearchParams(location.search);
    if (location.pathname !== '/callback' && !(globalThis.studioDesktop && (query.has('code')||query.has('error')))) return;
    history.replaceState(null,'','/');
    let pending; try { pending = JSON.parse(sessionStorage.getItem(key+'-pending')); } catch {}
    sessionStorage.removeItem(key+'-pending');
    if (!pending || pending.state !== query.get('state') || !Number.isFinite(pending.time) || Date.now()-pending.time > 600000 || pending.time > Date.now()) throw new Error('Sign-in could not be verified. Please connect again.');
    if (query.has('error')) throw new Error('Spotify authorization was declined. You can connect again when ready.');
    if (!query.get('code')) throw new Error('Spotify did not return an authorization code.');
    tokens=null;
    await remember(await token({grant_type:'authorization_code',code:query.get('code'),redirect_uri:redirect,client_id:localStorage.getItem(key+'-client'),code_verifier:pending.verifier}));
  }
  async function refresh() {
    if (!tokens?.refresh_token) throw new Error('Connect Spotify to continue.');
    const active=tokens;
    if (!refreshing) refreshing = token({grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:localStorage.getItem(key+'-client')}).then(data=>{if(tokens!==active)throw Error('The Spotify account changed. Try again.');return remember(data);}).finally(()=>{refreshing=null;});
    return refreshing;
  }
  async function api(path, options={}, retry=true) {
    if (!/^\/(?!\/)/.test(path)) throw new Error('Invalid Spotify API path.');
    if(globalThis.studioDesktop && tokens && Date.now()-tokens.authorizedAt>=30*86400000){disconnect();throw new Error('Your 30-day session ended. Reconnect Spotify.');}
    if (!tokens) throw new Error('Connect Spotify first.');
    if (Date.now() >= tokens.expires-60000) await refresh();
    const requestSession=tokens;
    const response = await fetch('https://api.spotify.com/v1'+path,{...options,headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
    if(tokens!==requestSession)throw Error('The Spotify account changed. Try again.');
    if (response.status===401 && retry) { await refresh(); return api(path,options,false); }
    if (response.status===403) throw new Error('Spotify denied access. Check that this account is allowed in your developer app and reconnect with the requested permissions.');
    if (response.status===429) throw new Error('Spotify is limiting requests. Wait '+(response.headers.get('Retry-After') || 'a few')+' seconds before retrying.');
    if (!response.ok) throw new Error('Spotify request failed (HTTP '+response.status+').');
    return response.status===204 ? null : response.json();
  }
  function disconnect() { if(globalThis.studioDesktop)globalThis.studioDesktop.clearSession().catch(()=>{});tokens=null;sessionStorage.removeItem(key);sessionStorage.removeItem(key+'-pending'); }
  let accountQueue=Promise.resolve();
  async function readAccounts(){
    let list;try{list=globalThis.studioDesktop?.loadAccounts?await globalThis.studioDesktop.loadAccounts():JSON.parse(sessionStorage.getItem(key+'-accounts')||'[]');}catch{throw Error('Could not read saved accounts. Try again.');}
    return Array.isArray(list)?list:[];
  }
  async function writeAccounts(list){if(globalThis.studioDesktop){if(!globalThis.studioDesktop.saveAccounts)throw Error('Update the desktop app to save multiple accounts.');await globalThis.studioDesktop.saveAccounts(list);}else sessionStorage.setItem(key+'-accounts',JSON.stringify(list));}
  function accountTask(task){const result=accountQueue.then(task);accountQueue=result.catch(()=>{});return result;}
  function usable(session){return session&&Number.isFinite(session.authorizedAt)&&session.authorizedAt<=Date.now()&&Date.now()-session.authorizedAt<30*86400000;}
  const profileData=p=>({id:p.id,display_name:p.display_name||p.id,images:(p.images||[]).filter(i=>{try{const u=new URL(i.url);return u.protocol==='https:'&&['i.scdn.co','profile-images.scdn.co'].includes(u.hostname);}catch{return false;}}).slice(0,3)});
  async function rememberAccount(profile){return accountTask(async()=>{
    if(!profile?.id||!tokens)return;
    const entry={profile:profileData(profile),session:{...tokens,accountId:profile.id,authorizedAt:tokens.authorizedAt||Date.now()},clientId:client()};
    const list=await readAccounts(),index=list.findIndex(a=>a.profile?.id===profile.id);
    if(index>=0)list[index]=entry;else{if(list.length>=10)throw Error('Remove a saved account before adding another (maximum 10).');list.push(entry);}
    await writeAccounts(list);tokens.accountId=profile.id;
  });}
  async function accounts(){return (await readAccounts()).map(a=>({...a.profile,needsReconnect:!usable(a.session)}));}
  async function switchAccount(id){return accountTask(async()=>{
    const saved=(await readAccounts()).find(a=>a.profile?.id===id);
    if(!saved||!usable(saved.session))throw Error('Sign in to this account again. Its saved session has expired.');
    let next={...saved.session};
    if(Date.now()>=next.expires-60000){const data=await token({grant_type:'refresh_token',refresh_token:next.refresh_token,client_id:saved.clientId});next={...next,access_token:data.access_token,refresh_token:data.refresh_token||next.refresh_token,expires:Date.now()+data.expires_in*1000,scope:data.scope||next.scope};}
    const response=await fetch('https://api.spotify.com/v1/me',{headers:{Authorization:'Bearer '+next.access_token},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Could not verify this account. Sign in again.');const profile=await response.json();if(profile.id!==id)throw Error('Saved account identity could not be verified.');
    if(globalThis.studioDesktop)await globalThis.studioDesktop.saveSession(next);else sessionStorage.setItem(key,JSON.stringify(next));
    tokens=next;localStorage.setItem(key+'-client',saved.clientId);
    const list=await readAccounts();const i=list.findIndex(a=>a.profile?.id===id);list[i]={...saved,session:next,profile:profileData(profile)};await writeAccounts(list);return profile;
  });}
  async function removeAccount(id){return accountTask(async()=>{await writeAccounts((await readAccounts()).filter(a=>a.profile?.id!==id));});}
  function client(){return localStorage.getItem(key+'-client')||defaultClient;}
  return {connect,finish,api,disconnect,accounts,rememberAccount,switchAccount,removeAccount,client:()=>localStorage.getItem(key+'-client')||defaultClient,connected:()=>!!tokens,canSave:()=>tokens?.scope.split(' ').includes('playlist-modify-private')};
})();


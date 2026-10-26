'use strict';
// PKCE uses a public client ID, never a client secret. Tokens last only in this tab.
const SpotifyConnection = (() => {
  const redirect = 'http://127.0.0.1:8791/callback';
  const scopes = 'playlist-modify-private';
  const key = 'playlist-studio-spotify';
  let tokens = null, refreshing = null;
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
  function restore() { try { tokens = JSON.parse(sessionStorage.getItem(key)); } catch { tokens = null; } }
  function remember(data) {
    if (!data.access_token || !data.expires_in) throw new Error('Spotify did not return a usable token.');
    tokens = {access_token:data.access_token, refresh_token:data.refresh_token || tokens?.refresh_token, expires:Date.now()+data.expires_in*1000, scope:data.scope || tokens?.scope || ''};
    sessionStorage.setItem(key, JSON.stringify(tokens));
  }
  async function token(body) {
    const r = await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});
    if (!r.ok) throw new Error('Spotify sign-in expired or the app settings do not match. Connect again.');
    return r.json();
  }
  async function connect(clientId) {
    if (!/^[a-f0-9]{32}$/i.test(clientId)) throw new Error('Enter the Client ID from your Spotify developer app. Do not enter a Client Secret.');
    if (location.origin !== 'http://127.0.0.1:8791') throw new Error('Open this app at http://127.0.0.1:8791 before connecting.');
    const verifier = random(), state = random();
    localStorage.setItem(key+'-client',clientId);
    sessionStorage.setItem(key+'-pending',JSON.stringify({verifier,state,time:Date.now()}));
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    const params = new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirect,scope:scopes,state,code_challenge_method:'S256',code_challenge:challenge});
    location.assign('https://accounts.spotify.com/authorize?'+params);
  }
  async function finish() {
    restore();
    if (location.pathname !== '/callback') return;
    const query = new URLSearchParams(location.search);
    history.replaceState(null,'','/');
    let pending; try { pending = JSON.parse(sessionStorage.getItem(key+'-pending')); } catch {}
    sessionStorage.removeItem(key+'-pending');
    if (!pending || pending.state !== query.get('state') || !Number.isFinite(pending.time) || Date.now()-pending.time > 600000 || pending.time > Date.now()) throw new Error('Sign-in could not be verified. Please connect again.');
    if (query.has('error')) throw new Error('Spotify authorization was declined. You can connect again when ready.');
    if (!query.get('code')) throw new Error('Spotify did not return an authorization code.');
    remember(await token({grant_type:'authorization_code',code:query.get('code'),redirect_uri:redirect,client_id:localStorage.getItem(key+'-client'),code_verifier:pending.verifier}));
  }
  async function refresh() {
    if (!tokens?.refresh_token) throw new Error('Connect Spotify to continue.');
    if (!refreshing) refreshing = token({grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:localStorage.getItem(key+'-client')}).then(remember).finally(()=>{refreshing=null;});
    return refreshing;
  }
  async function api(path, options={}, retry=true) {
    if (!/^\/(?!\/)/.test(path)) throw new Error('Invalid Spotify API path.');
    if (!tokens) throw new Error('Connect Spotify first.');
    if (Date.now() >= tokens.expires-60000) await refresh();
    const response = await fetch('https://api.spotify.com/v1'+path,{...options,headers:{Authorization:'Bearer '+tokens.access_token,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
    if (response.status===401 && retry) { await refresh(); return api(path,options,false); }
    if (response.status===403) throw new Error('Spotify denied access. Check that this account is allowed in your developer app and reconnect with the requested permissions.');
    if (response.status===429) throw new Error('Spotify is limiting requests. Wait '+(response.headers.get('Retry-After') || 'a few')+' seconds before retrying.');
    if (!response.ok) throw new Error('Spotify request failed (HTTP '+response.status+').');
    return response.status===204 ? null : response.json();
  }
  function disconnect() { tokens=null;sessionStorage.removeItem(key);sessionStorage.removeItem(key+'-pending'); }
  return {connect,finish,api,disconnect,client:()=>localStorage.getItem(key+'-client')||'',connected:()=>!!tokens,canSave:()=>tokens?.scope.split(' ').includes('playlist-modify-private')};
})();


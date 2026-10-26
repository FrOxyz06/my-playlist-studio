'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
function setup(){
  const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
  const requests=[];
  const context={crypto:webcrypto,TextEncoder,URLSearchParams,AbortSignal,btoa:s=>Buffer.from(s,'binary').toString('base64'),localStorage:storage(),sessionStorage:storage(),location:{origin:'http://127.0.0.1:8791',pathname:'/',assign(url){this.assigned=url;}},history:{replaceState(){}},fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,status:200,json:async()=>({access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,scope:'playlist-modify-private'})};}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(__dirname+'/../spotify-auth.js','utf8').split('\n(() => {')[0]+'\nglobalThis.connection=SpotifyConnection;',context);
  return {context,requests,api:context.connection};
}
test('PKCE authorizes only required scopes and exchanges a state-checked code',async()=>{
  const {context:c,requests,api}=setup();await api.connect('a'.repeat(32));
  const auth=new URL(c.location.assigned),pending=JSON.parse(c.sessionStorage.getItem('playlist-studio-spotify-pending'));
  assert.equal(auth.origin,'https://accounts.spotify.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('scope'),'playlist-modify-private');
  assert.equal(auth.searchParams.get('redirect_uri'),'http://127.0.0.1:8791/callback');
  c.location.pathname='/callback';c.location.search='?code=test-code&state='+pending.state;await api.finish();
  assert.equal(api.connected(),true);assert.equal(api.canSave(),true);
  assert.equal(requests[0].opts.body.get('code_verifier'),pending.verifier);assert.equal(requests[0].opts.body.has('client_secret'),false);
  api.disconnect();assert.equal(api.connected(),false);assert.equal(c.sessionStorage.getItem('playlist-studio-spotify'),null);
});
test('mismatched OAuth state never exchanges a code',async()=>{
  const {context:c,requests,api}=setup();await api.connect('a'.repeat(32));c.location.pathname='/callback';c.location.search='?code=test-code&state=wrong';await assert.rejects(api.finish(),/verified/);assert.equal(requests.length,0);
});
test('expired tokens refresh before API use without leaking into the URL',async()=>{
  const {context:c,requests,api}=setup();c.localStorage.setItem('playlist-studio-spotify-client','a'.repeat(32));c.sessionStorage.setItem('playlist-studio-spotify',JSON.stringify({access_token:'expired',refresh_token:'refresh',expires:0,scope:'playlist-modify-private'}));await api.finish();await api.api('/me');
  assert.equal(requests[0].opts.body.get('grant_type'),'refresh_token');assert.equal(requests[1].url,'https://api.spotify.com/v1/me');assert.equal(requests[1].opts.headers.Authorization,'Bearer test-token');
});

test('invalid pending timestamp never exchanges an OAuth code',async()=>{
 const {context:c,requests,api}=setup(); await api.connect('a'.repeat(32));
 const key='playlist-studio-spotify-pending',pending=JSON.parse(c.sessionStorage.getItem(key));
 delete pending.time;c.sessionStorage.setItem(key,JSON.stringify(pending));
 c.location.pathname='/callback';c.location.search='?code=test&state='+pending.state;
 await assert.rejects(api.finish(),/verified/);assert.equal(requests.length,0);
});

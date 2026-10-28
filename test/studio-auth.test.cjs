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

test('desktop restores a session without putting tokens in browser storage',async()=>{const {context:c,api}=setup();c.studioDesktop={loadSession:async()=>({access_token:'saved',refresh_token:'refresh',expires:Date.now()+3600000,authorizedAt:Date.now(),scope:'playlist-modify-private'}),clearSession:async()=>{}};await api.finish();assert.equal(api.connected(),true);assert.equal(c.sessionStorage.getItem('playlist-studio-spotify'),null);});
test('desktop expires the sign-in after thirty days',async()=>{const {context:c,api}=setup();let cleared=false;c.studioDesktop={loadSession:async()=>({access_token:'old',refresh_token:'refresh',authorizedAt:Date.now()-31*86400000}),clearSession:async()=>{cleared=true;}};await api.finish();assert.equal(api.connected(),false);assert.equal(cleared,true);});
test('desktop refresh preserves original authorization timestamp',async()=>{const {context:c,api}=setup();const authorizedAt=Date.now()-86400000;let saved;c.studioDesktop={loadSession:async()=>({access_token:'old',refresh_token:'refresh',expires:0,authorizedAt,scope:'playlist-modify-private'}),saveSession:async data=>{saved=data;},clearSession:async()=>{}};await api.finish();await api.api('/me');assert.equal(saved.authorizedAt,authorizedAt);});

test('default sign-in opens Spotify without manual developer setup',async()=>{const {context:c,api}=setup();await api.connect();const url=new URL(c.location.assigned);assert.equal(url.origin,'https://accounts.spotify.com');assert.match(url.searchParams.get('client_id'),/^[a-f0-9]{32}$/);assert.equal(url.searchParams.get('response_type'),'code');});

function accountFixture(id,age=0){return {profile:{id,display_name:'User '+id,images:[]},clientId:'a'.repeat(32),session:{access_token:'token-'+id,refresh_token:'refresh-'+id,expires:Date.now()+3600000,authorizedAt:Date.now()-age,scope:'playlist-modify-private',accountId:id}};}
test('saved account listing never returns tokens',async()=>{const {context:c,api}=setup();c.sessionStorage.setItem('playlist-studio-spotify-accounts',JSON.stringify([accountFixture('one')]));const accounts=await api.accounts();assert.equal(accounts[0].id,'one');assert.equal(accounts[0].access_token,undefined);assert.equal(accounts[0].session,undefined);});
test('account switch verifies identity and uses only chosen credentials',async()=>{const {context:c,api}=setup();c.sessionStorage.setItem('playlist-studio-spotify-accounts',JSON.stringify([accountFixture('one'),accountFixture('two')]));const auth=[];c.fetch=async(url,options)=>{auth.push(options.headers.Authorization);return {ok:true,status:200,json:async()=>({id:'two',display_name:'User two',images:[]})};};const profile=await api.switchAccount('two');assert.equal(profile.id,'two');await api.api('/me');assert.deepEqual(auth,['Bearer token-two','Bearer token-two']);assert.equal(api.connected(),true);});
test('expired saved account cannot become active',async()=>{const {context:c,api,requests}=setup();c.sessionStorage.setItem('playlist-studio-spotify-accounts',JSON.stringify([accountFixture('old',31*86400000)]));await assert.rejects(api.switchAccount('old'),/expired/);assert.equal(requests.length,0);assert.equal(api.connected(),false);});
test('wrong identity never activates saved credentials',async()=>{const {context:c,api}=setup();c.sessionStorage.setItem('playlist-studio-spotify-accounts',JSON.stringify([accountFixture('one')]));c.fetch=async()=>({ok:true,json:async()=>({id:'different'})});await assert.rejects(api.switchAccount('one'),/identity/);assert.equal(api.connected(),false);});
test('saving same account replaces it without duplicating or extending authorization',async()=>{const {context:c,api}=setup();const record=accountFixture('one');c.sessionStorage.setItem('playlist-studio-spotify',JSON.stringify(record.session));await api.finish();await api.rememberAccount(record.profile);await api.rememberAccount(record.profile);const saved=JSON.parse(c.sessionStorage.getItem('playlist-studio-spotify-accounts'));assert.equal(saved.length,1);assert.equal(saved[0].session.authorizedAt,record.session.authorizedAt);await api.removeAccount('one');assert.equal((await api.accounts()).length,0);});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createYouTube,parseConfig,rank}=require('../desktop/youtube.cjs');
const config={installed:{client_id:'123-example.apps.googleusercontent.com',client_secret:'test-only'}};
const ok=data=>({ok:true,status:200,json:async()=>data});
function harness({wrongState=false,wrongScope=false,deny=false,failInsert=false,quota=false,creationUnknown=false}={}){
 let handler,authURL,tokenBody,creates=0,lost=failInsert;const stored=[],calls=[];
 const server={once(){return this;},listen(_port,_host,cb){cb();return this;},address(){return {port:41234};},close(){}};
 const service=createYouTube({makeServer:fn=>{handler=fn;return server;},openExternal:async url=>{
  authURL=new URL(url);
  const respond=state=>{const res={setHeader(){},writeHead(status){this.status=status;},end(){}};handler({method:'GET',headers:{host:'127.0.0.1:41234'},url:'/callback?'+new URLSearchParams({state,...(deny?{error:'access_denied'}:{code:'test-code'})})},res);return res;};
  if(wrongState)assert.equal(respond('incorrect').status,400);
  respond(authURL.searchParams.get('state'));
 },fetch:async(url,options)=>{
  calls.push({url,options});
  if(url==='https://oauth2.googleapis.com/token'){tokenBody=new URLSearchParams(options.body);return ok({access_token:'never-return-this-token',expires_in:3600,scope:wrongScope?'profile':'https://www.googleapis.com/auth/youtube'});}
  const u=new URL(url),endpoint=u.pathname.split('/').pop();
  if(endpoint==='channels')return ok({items:[{id:'channel',snippet:{title:'Test channel'}}]});
  if(endpoint==='search')return quota?{ok:false,status:403,json:async()=>({error:{errors:[{reason:'quotaExceeded'}]}})}:ok({items:[{id:{videoId:'abcdefghijk'}},{id:{videoId:'zyxwvutsrqp'}}]});
  if(endpoint==='videos')return ok({items:[{id:'abcdefghijk',snippet:{title:'Artist - Song (Official Audio)',channelTitle:'Artist - Topic'},contentDetails:{duration:'PT3M'},status:{privacyStatus:'public',uploadStatus:'processed'}},{id:'zyxwvutsrqp',snippet:{title:'Artist - Song live cover',channelTitle:'Other'},status:{privacyStatus:'public',uploadStatus:'processed'}}]});
  if(endpoint==='playlists'){creates++;if(creationUnknown)throw Error('network');return ok({id:'created-id'});}
  if(endpoint==='playlistItems'&&options.method==='GET')return ok({items:stored.map(id=>({contentDetails:{videoId:id}}))});
  if(endpoint==='playlistItems'){const id=JSON.parse(options.body).snippet.resourceId.videoId;stored.push(id);if(lost){lost=false;throw Error('Acknowledgement lost');}return ok({id:'item'});}
  throw Error('Unexpected API request');
 }});
 return {service,stored,calls,get authURL(){return authURL;},get tokenBody(){return tokenBody;},get creates(){return creates;}};
}
test('only a Desktop app config is accepted; supplied endpoints are ignored',()=>{
 assert.throws(()=>parseConfig({web:config.installed}));assert.throws(()=>parseConfig({installed:{client_id:'bad',client_secret:'x'}}));
 assert.deepEqual(parseConfig({installed:{...config.installed,token_uri:'https://attacker.example'}}),config.installed);
});
test('Google authorization validates state, uses PKCE and loopback, and never exposes tokens',async()=>{
 const h=harness({wrongState:true});await h.service.configure(config);const result=await h.service.connect();
 assert.equal(result.channel,'Test channel');assert.equal(result.connected,true);assert.ok(!JSON.stringify(result).includes('never-return'));
 assert.equal(h.authURL.origin,'https://accounts.google.com');assert.equal(h.authURL.searchParams.get('code_challenge_method'),'S256');
 assert.equal(crypto.createHash('sha256').update(h.tokenBody.get('code_verifier')).digest('base64url'),h.authURL.searchParams.get('code_challenge'));
 assert.equal(h.tokenBody.get('redirect_uri'),'http://127.0.0.1:41234/callback');
 assert.ok(h.calls.filter(c=>c.url.includes('/youtube/v3/')).every(c=>c.options.headers.Authorization==='Bearer never-return-this-token'));
 await h.service.disconnect();assert.equal((await h.service.status()).connected,false);
});
for(const kind of ['deny','wrongScope'])test('authorization failure: '+kind,async()=>{
 const h=harness({[kind]:true});await h.service.configure(config);await assert.rejects(h.service.connect());assert.equal((await h.service.status()).connected,false);
});
test('matching ranks recording metadata above covers and accounts for duration',async()=>{
 const h=harness();await h.service.configure(config);await h.service.connect();const results=await h.service.search({title:'Song',artist:'Artist',durationMs:180000});
 assert.equal(results[0].id,'abcdefghijk');assert.equal(results[0].score,1);assert.ok(results[1].score<.85);
 assert.ok(rank({title:'Song',artist:'Artist',durationMs:180000},{snippet:{title:'Artist Song'},contentDetails:{duration:'PT10M'}})<.85);
});
test('quota errors explain that matches are preserved',async()=>{
 const h=harness({quota:true});await h.service.configure(config);await h.service.connect();await assert.rejects(h.service.search({title:'Song',artist:'Artist'}),/quota reached/);
});
test('interrupted playlist saves reconcile order and repeats without duplicate insertion',async()=>{
 const h=harness({failInsert:true});await h.service.configure(config);await h.service.connect();
 const plan={name:'For a friend',privacy:'unlisted',ids:['abcdefghijk','zyxwvutsrqp','abcdefghijk']};
 await assert.rejects(h.service.create(plan),/could not be reached/);
 await h.service.connect();
 await assert.rejects(h.service.create({...plan,name:'Changed'}),/Finish the previous/);
 const result=await h.service.create(plan);assert.deepEqual(h.stored,plan.ids);assert.equal(h.creates,1);assert.equal(result.count,3);
 await h.service.create(plan);assert.equal(h.creates,1);assert.deepEqual(h.stored,plan.ids);
 const created=h.calls.find(c=>c.url.includes('/playlists?'));assert.equal(JSON.parse(created.options.body).status.privacyStatus,'unlisted');
});
test('uncertain creation is blocked from automatically creating a second playlist',async()=>{
 const h=harness({creationUnknown:true});await h.service.configure(config);await h.service.connect();const plan={name:'X',ids:['abcdefghijk']};
 await assert.rejects(h.service.create(plan),/could not be confirmed/);await assert.rejects(h.service.create(plan),/uncertain/);assert.equal(h.creates,1);
});
test('invalid video identifiers and visibility never make playlist API requests',async()=>{
 const h=harness();await h.service.configure(config);await h.service.connect();await assert.rejects(h.service.create({name:'X',ids:['javascript:bad']}));await assert.rejects(h.service.create({name:'X',privacy:'bad',ids:['abcdefghijk']}));assert.equal(h.creates,0);
});

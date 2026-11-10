'use strict';
const crypto=require('node:crypto'),http=require('node:http');
const scope='https://www.googleapis.com/auth/youtube';
function parseConfig(value){
 const c=value?.installed;
 if(!c||typeof c.client_id!=='string'||!/^[-\w.]+\.apps\.googleusercontent\.com$/.test(c.client_id)||typeof c.client_secret!=='string'||c.client_secret.length>300||!c.client_secret)throw Error('Choose the Google OAuth JSON for a Desktop app.');
 return {client_id:c.client_id,client_secret:c.client_secret};
}
function normalize(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
function rank(song,video){
 const title=normalize(video.snippet?.title),channel=normalize(video.snippet?.channelTitle),name=normalize(song.title),artist=normalize(song.artist);
 const tokens=name.split(' ').filter(Boolean),artists=artist.split(' ').filter(Boolean),words=title.split(' '),identity=(title+' '+channel).split(' ');
 let score=.65*(tokens.filter(t=>words.includes(t)).length/Math.max(1,tokens.length))+.35*(artists.filter(t=>identity.includes(t)).length/Math.max(1,artists.length));
 for(const version of ['live','cover','remix','sped up','slowed','karaoke','instrumental'])if((' '+title+' ').includes(' '+version+' ')&&!(' '+name+' ').includes(' '+version+' '))score-=.3;
 const d=String(video.contentDetails?.duration||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
 if(song.durationMs&&d&&Math.abs(Number(d[1]||0)*3600+Number(d[2]||0)*60+Number(d[3]||0)-song.durationMs/1000)>20)score-=.25;
 return Math.max(0,Math.min(1,score));
}
function createYouTube({fetch:request=globalThis.fetch,openExternal,loadConfig=async()=>null,saveConfig=async()=>{},makeServer=http.createServer,authTimeout=180000}={}){
 let config=null,token=null,expires=0,channel=null,auth=null,job=null,busy=false,generation=0;
 async function initialize(){if(!config){const saved=await loadConfig();if(saved)config=parseConfig({installed:saved});}}
 async function status(){await initialize();return {configured:!!config,connected:!!token&&Date.now()<expires,channel:channel?.title||null};}
 async function configure(value){if(busy||auth)throw Error('Finish the current YouTube action first.');const next=parseConfig(value);await saveConfig(next);config=next;token=null;channel=null;job=null;generation++;return status();}
 async function api(endpoint,params={},body){
  if(!token||Date.now()>=expires)throw Error('Connect YouTube again; your session has expired.');
  let response;try{response=await request('https://www.googleapis.com/youtube/v3/'+endpoint+'?'+new URLSearchParams(params),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{throw Error('YouTube could not be reached. Try again when your connection returns.');}
  const data=await response.json();if(!response.ok){const reason=data.error?.errors?.[0]?.reason,e=Error(reason==='quotaExceeded'||reason==='dailyLimitExceeded'?'YouTube API quota reached. Your matches are kept while this window stays open.':response.status===401?'Connect YouTube again; authorization has expired.':'YouTube request failed'+(reason?' ('+reason+')':'')+'.');e.status=response.status;throw e;}return data;
 }
 async function connect(){
  await initialize();if(!config)throw Error('Load a Google Desktop OAuth JSON in YouTube setup first.');if(auth||busy)throw Error('A YouTube action is already in progress.');
  const previousChannel=channel?.id;
  const ticket=++generation,state=crypto.randomBytes(24).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');token=null;
  auth=new Promise((resolve,reject)=>{
   let timer,finished=false,redirect,callbackHost;
   const finish=(error,code)=>{if(finished)return;finished=true;clearTimeout(timer);server.close();error?reject(error):resolve({code,redirect});};
   const server=makeServer((req,res)=>{
    if(finished){res.writeHead(410);return res.end('Google sign-in has finished. Return to Playlist Studio.');}
    const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/plain; charset=utf-8');
    if(req.method!=='GET'||req.headers.host!==callbackHost||url.pathname!=='/callback'||url.searchParams.get('state')!==state){res.writeHead(400);return res.end('Invalid authorization response.');}
    const code=url.searchParams.get('code');res.end('Return to Playlist Studio. You can close this tab.');
    if(url.searchParams.has('error')||!code||code.length>4096)return finish(Error('Google sign-in was cancelled or denied.'));
    finish(null,code);
   });
   server.once('error',()=>finish(Error('Could not start the local Google sign-in callback.')));
   server.listen(0,'127.0.0.1',()=>{
    const address=server.address();
    if(finished)return;
    if(!address||typeof address==='string')return finish(Error('Could not start the local Google sign-in callback.'));
    callbackHost='127.0.0.1:'+address.port;
    redirect='http://'+callbackHost+'/callback';
    const url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:config.client_id,redirect_uri:redirect,response_type:'code',scope,state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
    Promise.resolve().then(()=>openExternal(url)).catch(()=>finish(Error('Could not open the browser for Google sign-in.')));
   });timer=setTimeout(()=>finish(Error('Google sign-in timed out. Try connecting again.')),authTimeout);timer.unref?.();
  });
  try{
   const {code,redirect}=await auth;if(ticket!==generation)throw Error('Sign-in cancelled.');
   const response=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...config,code,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier}),signal:AbortSignal.timeout(20000)});
   const data=await response.json();if(!response.ok||typeof data.access_token!=='string'||!Number.isFinite(data.expires_in)||!(data.scope||'').split(' ').includes(scope))throw Error('Google did not grant YouTube access. Connect again and allow playlist access.');
   if(ticket!==generation)throw Error('Sign-in cancelled.');token=data.access_token;expires=Date.now()+data.expires_in*1000-30000;
   const profile=await api('channels',{part:'snippet',mine:'true'});if(!profile.items?.length)throw Error('Create a YouTube channel in your Google account before converting playlists.');
   channel={id:profile.items[0].id,title:profile.items[0].snippet.title};if(previousChannel&&previousChannel!==channel.id)job=null;return status();
  }catch(error){token=null;throw error;}finally{auth=null;}
 }
 async function search(song){
  if(!song||typeof song.title!=='string'||typeof song.artist!=='string'||song.title.length>500||song.artist.length>500)throw Error('Invalid song.');
  const data=await api('search',{part:'snippet',type:'video',maxResults:'5',q:song.title+' '+song.artist});
  const ids=(data.items||[]).map(t=>t.id?.videoId).filter(id=>/^[\w-]{11}$/.test(id));if(!ids.length)return [];
  const details=await api('videos',{part:'snippet,contentDetails,status',id:ids.join(',')});
  return (details.items||[]).filter(v=>v.status?.privacyStatus==='public'&&v.status?.uploadStatus==='processed').map(v=>({id:v.id,title:v.snippet.title,channel:v.snippet.channelTitle,score:rank(song,v)})).sort((a,b)=>b.score-a.score);
 }
 async function create({name,privacy='private',ids}={}){
  if(busy||auth)throw Error('A YouTube action is already in progress.');
  if(!token||Date.now()>=expires)throw Error('Connect YouTube again; your session has expired.');
  if(typeof name!=='string'||!name.trim()||name.length>150||!['private','unlisted','public'].includes(privacy)||!Array.isArray(ids)||!ids.length||ids.length>5000||ids.some(id=>typeof id!=='string'||!/^[\w-]{11}$/.test(id)))throw Error('Choose a playlist name and valid YouTube matches.');
  const fingerprint=JSON.stringify({name:name.trim(),privacy,ids});busy=true;
  try{
   if(job&&job.fingerprint!==fingerprint&&!job.complete)throw Error('Finish the previous YouTube save before changing its songs, name, or visibility.');
   if(!job||job.fingerprint!==fingerprint){
    job={fingerprint,uncertain:true};let created;
    try{created=await api('playlists',{part:'snippet,status'},{snippet:{title:name.trim(),description:'Created with Playlist Studio'},status:{privacyStatus:privacy}});}catch(error){if(error.status)job=null;else throw Error('Playlist creation could not be confirmed. Check your YouTube playlists before starting another session.');throw error;}
    if(!created.id)throw Error('Playlist creation could not be confirmed. Check YouTube before starting another session.');
    job={fingerprint,id:created.id,complete:false};
   }
   if(job.uncertain)throw Error('Playlist creation is uncertain. Check YouTube before starting another session.');
   if(!job.complete){
    const existing=[];let pageToken;
    do{const page=await api('playlistItems',{part:'contentDetails',playlistId:job.id,maxResults:'50',...(pageToken?{pageToken}:{})});existing.push(...(page.items||[]).map(t=>t.contentDetails.videoId));pageToken=page.nextPageToken;if(existing.length>5000)throw Error('The YouTube playlist changed. Check it before continuing.');}while(pageToken);
    if(existing.some((id,i)=>ids[i]!==id))throw Error('The YouTube playlist changed. Check it before continuing.');
    for(let i=existing.length;i<ids.length;i++)await api('playlistItems',{part:'snippet'},{snippet:{playlistId:job.id,position:i,resourceId:{kind:'youtube#video',videoId:ids[i]}}});
    job.complete=true;
   }
   return {url:'https://www.youtube.com/playlist?list='+encodeURIComponent(job.id),count:ids.length};
  }finally{busy=false;}
 }
 function disconnect(){if(busy||auth)throw Error('Finish the current YouTube action first.');generation++;token=null;channel=null;job=null;return status();}
 return {configure,status,connect,search,create,disconnect};
}
module.exports={createYouTube,parseConfig,rank};

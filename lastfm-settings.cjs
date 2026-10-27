'use strict';
const fs=require('node:fs/promises');
const valid=key=>typeof key==='string'&&/^[a-f0-9]{32}$/i.test(key);
async function handleSettings(req,res,headers,configPath,request=fetch){
 const reply=(code,data)=>{res.writeHead(code,{...headers,'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(req.method==='GET'){try{const data=JSON.parse(await fs.readFile(configPath,'utf8'));return reply(200,{configured:valid(data.apiKey)});}catch{return reply(200,{configured:false});}}
 if(req.method!=='POST')return reply(405,{error:'Method not allowed.'});
 if(req.headers.origin!=='http://127.0.0.1:8791'||req.headers['content-type']!=='application/json')return reply(403,{error:'Open settings from Playlist Studio.'});
 let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024)return reply(413,{error:'Request too large.'});}
 let apiKey;try{apiKey=JSON.parse(body).apiKey?.trim();}catch{return reply(400,{error:'Invalid settings.'});}
 if(!valid(apiKey))return reply(400,{error:'Enter a 32-character Last.fm API key.'});
 try{const response=await request('https://ws.audioscrobbler.com/2.0/?'+new URLSearchParams({method:'chart.getTopTracks',api_key:apiKey,format:'json',limit:'1'}),{signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok||data.error||!data.tracks)return reply(400,{error:'Last.fm could not verify this key. Check the key and try again.'});
 const temp=configPath+'.tmp';await fs.writeFile(temp,JSON.stringify({apiKey}),{mode:0o600});await fs.rename(temp,configPath);return reply(200,{configured:true});
 }catch{return reply(502,{error:'Could not verify or save the key. Check your connection and try again.'});}
}
module.exports={handleSettings};

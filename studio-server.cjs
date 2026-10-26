'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const host='127.0.0.1',port=8791;
const files={'/':'My Playlist Studio.html','/callback':'My Playlist Studio.html','/playlist-studio.css':'playlist-studio.css','/playlist-engine.js':'playlist-engine.js','/playlist-studio.js':'playlist-studio.js','/spotify-auth.js':'spotify-auth.js','/spotify-save.js':'spotify-save.js'};
const server=http.createServer(async(req,res)=>{
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://accounts.spotify.com https://api.spotify.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"};
 if(req.headers.host!==host+':'+port){res.writeHead(403,headers);return res.end('Use http://127.0.0.1:8791');}
 if(req.method!=='GET'){res.writeHead(405,headers);return res.end();}
 try{const file=files[new URL(req.url,'http://'+host+':'+port).pathname];if(!file){res.writeHead(404,headers);return res.end();}headers['Content-Type']=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';const body=await fs.readFile(path.join(__dirname,file));res.writeHead(200,headers);res.end(body);}catch{res.writeHead(500,headers);res.end('Could not load the app.');}
});
if(require.main===module){server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 8791 is in use. If Playlist Studio is already running, open http://127.0.0.1:8791. Otherwise close the process using this port.':'Could not start Playlist Studio.');process.exitCode=1;});server.listen(port,host,()=>console.log('Open http://127.0.0.1:8791 in your browser. Keep this window open.'));}
module.exports={server};

'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {server}=require('../studio-server.cjs');
// Exercise the actual HTTP request handler without requiring an open socket.
const request=(url,method='GET',host='127.0.0.1:8791')=>new Promise(resolve=>{
 const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){resolve({status:this.status,headers:this.headers,body:String(body||'')});}};
 server.emit('request',{url,method,headers:{host}},res);
});
test('local server restricts hosts, methods and files and sets security headers',async()=>{
 const page=await request('/');assert.equal(page.status,200);assert.match(page.body,/<title>My Playlist Studio/);assert.match(page.headers['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.equal((await request('/callback?code=fake')).status,200);
 assert.equal((await request('/README.md')).status,404);
 assert.equal((await request('/','POST')).status,405);
 assert.equal((await request('/','GET','evil.example')).status,403);
});


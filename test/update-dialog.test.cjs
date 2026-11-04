'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {createUpdateDialog}=require('../desktop/update-dialog.cjs');
function owner(){const owner=new EventEmitter();owner.isDestroyed=()=>false;owner.webContents=new EventEmitter();owner.messages=[];owner.webContents.send=(channel,value)=>owner.messages.push({channel,value});return owner;}
test('custom update prompt requires the current identifier and an explicit response',async()=>{
 const target=owner(),dialog=createUpdateDialog(),promise=dialog.showMessageBox(target,{title:'Update ready',message:'Restart?',buttons:['Restart','Later']});
 const prompt=target.messages[0].value;assert.equal(target.messages[0].channel,'updates:prompt');assert.equal(prompt.title,'Update ready');
 assert.equal(dialog.respond('wrong',0),false);assert.equal(dialog.respond(prompt.id,99),false);assert.equal(dialog.respond(prompt.id,0),true);assert.deepEqual(await promise,{response:0});assert.equal(dialog.respond(prompt.id,0),false);
 assert.equal(target.listenerCount('closed'),0);assert.equal(target.webContents.listenerCount('did-start-navigation'),0);
});
test('closing the window or navigating dismisses the prompt without approving installation',async()=>{
 for(const action of ['closed','navigation']){const target=owner(),dialog=createUpdateDialog(),promise=dialog.showMessageBox(target,{title:'Update ready',buttons:['Restart','Later']});if(action==='closed')target.emit('closed');else target.webContents.emit('did-start-navigation',{},'http://localhost',false,true);assert.deepEqual(await promise,{response:1});}
});
test('timed out dialogs are dismissed and stale replies cannot approve an update',async()=>{
 const target=owner(),dialog=createUpdateDialog({timeoutMs:5}),promise=dialog.showMessageBox(target,{title:'Update ready',buttons:['Restart','Later']}),id=target.messages[0].value.id;
 await new Promise(resolve=>setTimeout(resolve,15));assert.deepEqual(await promise,{response:1});assert.equal(target.messages[1].value.dismiss,true);assert.equal(dialog.respond(id,0),false);
});
function renderer({saving=false}={}){
 const fs=require('node:fs'),vm=require('node:vm'),nodes=new Map(),responses=[];let notify;
 function element(){return {open:false,disabled:false,hidden:false,style:{},handlers:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(name,fn){this.handlers[name]=fn;},showModal(){this.open=true;},close(){this.open=false;},focus(){},set innerHTML(value){for(const match of value.matchAll(/id="([^"]+)"/g))nodes.set(match[1],element());}};}
 const panel=element(),context={studioUpdateDialog:{onPrompt:fn=>{notify=fn;},respond:async(id,response)=>{responses.push({id,response});return true;}},studioDesktop:{getUpdateStatus:async()=>({version:'1.0.16',progress:37,downloading:true})},window:{studioSaving:saving,addEventListener(){}},document:{activeElement:{focus(){}},createElement:()=>panel,getElementById:id=>nodes.get(id)||null,body:{append(){}}},setInterval:()=>1,clearInterval(){}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../playlist-update-dialog.js'),'utf8'),context);
 return {panel,nodes,responses,context,notify:value=>notify(value)};
}
test('restart dialog defers on Escape and blocks restart while a save is in progress',async()=>{
 const r=renderer({saving:true});r.notify({id:'ready',title:'Update ready',message:'Restart?',buttons:['Restart','Later']});
 assert.equal(r.panel.open,true);assert.equal(r.nodes.get('update-dialog-action').textContent,'Restart & update');
 await r.nodes.get('update-dialog-action').handlers.click();assert.equal(r.responses.length,0);
 r.panel.handlers.cancel({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(r.responses,[{id:'ready',response:1}]);assert.equal(r.panel.open,false);
});
test('download confirmation shows real progress and a later ready prompt requires another click',async()=>{
 const r=renderer();r.notify({id:'download',title:'Update available',message:'Version available',buttons:['Download update','Later']});
 await r.nodes.get('update-dialog-action').handlers.click();assert.equal(r.nodes.get('update-dialog-progress').hidden,false);assert.equal(r.nodes.get('update-dialog-title').textContent,'Getting your update ready');
 r.notify({id:'ready',title:'Update ready',message:'Restart?',buttons:['Restart','Later']});assert.equal(r.responses.length,1);
 await r.nodes.get('update-dialog-action').handlers.click();assert.deepEqual(r.responses,[{id:'download',response:0},{id:'ready',response:0}]);
});

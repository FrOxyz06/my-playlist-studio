const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),zlib=require('node:zlib');
const source=fs.readFileSync(require('node:path').join(__dirname,'../playlist-studio.js'),'utf8');const context={Blob,DecompressionStream,TextDecoder,DataView,Uint8Array,Error};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function zipJSON'),source.indexOf('async function importFiles'))+';globalThis.readZip=zipJSON;',context);
function fixture(method){const name=Buffer.from('MyData/StreamingHistory_music_0.json'),plain=Buffer.from('[{"artistName":"Test","trackName":"Song"}]'),packed=method===8?zlib.deflateRawSync(plain):plain;const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(method,8);local.writeUInt16LE(name.length,26);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(method,10);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(plain.length,24);central.writeUInt16LE(name.length,28);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,10);end.writeUInt32LE(local.length+name.length+packed.length,16);return new Blob([local,name,packed,central,name,end]);}
for(const method of [0,8])test('ZIP JSON import with compression '+method,async()=>{const result=await context.readZip(fixture(method));assert.equal(result.length,1);assert.equal(JSON.parse(result[0].text)[0].trackName,'Song');});
test('invalid ZIP gives extraction guidance',async()=>{await assert.rejects(context.readZip(new Blob(['bad zip'])),/Extract/);});

test('stored ZIP entry cannot lie about its expanded size',async()=>{
 const bytes=Buffer.from(await fixture(0).arrayBuffer());
 const central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
 bytes.writeUInt32LE(1,central+24);
 await assert.rejects(context.readZip(new Blob([bytes])),/size mismatch/);
});

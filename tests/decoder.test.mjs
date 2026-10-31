import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeLevel} from '../tools/decode-rom-levels.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../research/levels/'+name+'.json',import.meta.url)));
for(const name of ['1-1','1-2','1-3'])test('decoded '+name+' preserves original tile RAM layout and fingerprint',()=>{
 const l=read(name);assert.equal(l.tiles.length,6480);assert.equal(l.width,240);assert.equal(l.height,27);
 const raw=Buffer.alloc(6480);for(let i=0;i<6480;i++){const row=Math.floor(i/240),col=i%240;raw[Math.floor(col/16)*432+row*16+col%16]=l.tiles[i];}
 assert.equal(createHash('sha256').update(raw).digest('hex'),l.provenance.tileRAMSHA256);
 assert.equal(l.objects.at(-1).id,0x41);assert.ok(l.playableWidth<=l.width*16);
});
test('hills decoder retains original floor and ceiling slope profiles',()=>{
 const s=read('1-2').slopes;assert.equal(s.profiles.length,21);assert.ok(s.profiles.every(p=>p.length===16));
 assert.deepEqual(s.profiles[1],Array.from({length:16},(_,i)=>15-i));assert.deepEqual(s.profiles[2],Array.from({length:16},(_,i)=>i));
 assert.equal(s.tileShape[0x99],1);assert.equal(s.tileShape[0x9b],2);assert.equal(s.tileShape[0xa2],17);assert.equal(s.playerVelocityEffect[1],-3);
});
test('World 1-2 preserves actual ROM C1 records rather than a mismatched disassembly enum',()=>{
 const l=read('1-2');assert.equal(l.objects.filter(o=>o.id===0xc1).length,3);assert.equal(l.objects.filter(o=>o.id===0xbc).length,0);
});
test('decoder refuses unsupported ROM revisions',()=>assert.throws(()=>decodeLevel(Buffer.alloc(16),'1-1'),/Unsupported ROM revision/));

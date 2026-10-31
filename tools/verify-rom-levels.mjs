import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeLevel,COURSES} from './decode-rom-levels.mjs';
const [romPath,outDir,statePath]=process.argv.slice(2);
if(!romPath||!outDir)throw Error('Usage: node tools/verify-rom-levels.mjs your-rom.nes decoded-output-dir [captured-1-1-emulator-state.json]');
const rom=fs.readFileSync(romPath),results=[];
for(const name of Object.keys(COURSES)){
 const first=decodeLevel(rom,name),second=decodeLevel(rom,name),saved=JSON.parse(fs.readFileSync(path.join(outDir,name+'.json')));
 assert.deepEqual(first,second,'Decoder is deterministic');assert.deepEqual(first,saved,'Saved research output reproduces from ROM');
 assert.equal(first.tiles.length,6480);assert.ok(first.tiles.every(t=>Number.isInteger(t)&&t>=0&&t<=255));
 assert.equal(first.objects.at(-1).id,0x41);assert.equal(first.objects.at(-1).x,2688-(name==='1-3'?256:0));
 results.push({course:name,reproduced:true,tiles:first.tiles.length,objects:first.objects.length,tileRAMSHA256:first.provenance.tileRAMSHA256});
}
const hills=JSON.parse(fs.readFileSync(path.join(outDir,'1-2.json')));
assert.deepEqual(hills.slopes.profiles[1],Array.from({length:16},(_,x)=>15-x));
assert.deepEqual(hills.slopes.profiles[2],Array.from({length:16},(_,x)=>x));
assert.equal(hills.slopes.tileShape[0x99],1);assert.equal(hills.slopes.tileShape[0x9b],2);
const report={courses:results,slopeProfiles:21,independentRuntimeComparison:null};
if(statePath){
 const stateBytes=fs.readFileSync(statePath),mem=JSON.parse(stateBytes).cpu.mem,l=JSON.parse(fs.readFileSync(path.join(outDir,'1-1.json')));
 let exact=0,randomCloudDifferences=0;const unexpected=[];
 for(let i=0;i<l.tiles.length;i++){
  const row=Math.floor(i/240),col=i%240,a=l.tiles[i],b=mem[0x6000+Math.floor(col/16)*432+row*16+col%16];
  if(a===b)exact++;else if([0x10,0x11,0x12,0x80].includes(a)&&[0x10,0x11,0x12,0x80].includes(b))randomCloudDifferences++;else unexpected.push({col,row,decoded:a,runtime:b});
 }
 assert.deepEqual(unexpected,[],'Non-random terrain must match the full original ROM runtime');
 report.independentRuntimeComparison={course:'1-1',stateSHA256:createHash('sha256').update(stateBytes).digest('hex'),exact,randomCloudDifferences,unexpectedDifferences:unexpected.length,note:'Only decorative random-cloud tiles 10/11/12 versus sky80 are excluded; actual played run uses a different RNG state.'};
}
fs.writeFileSync(path.join(outDir,'verification-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));

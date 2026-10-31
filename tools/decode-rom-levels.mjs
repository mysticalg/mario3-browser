// Execute the supplied ROM's original level generator offline (JSNES 2.1).
// No ROM or emulator is loaded by the browser game.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {NES} from 'jsnes';
export const ROM_SHA256='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579';
export const COURSES={
 '1-1':{bank:15,tileset:1,header:0xbb82,objects:0xc537,chr:[8,96]},
 '1-2':{bank:16,tileset:3,header:0xaf2a,objects:0xc6ba,chr:[108,96]},
 '1-3':{bank:15,tileset:1,header:0xae09,objects:0xc2fe,chr:[8,96]}
};
export function decodeLevel(rom,name){
 if(createHash('sha256').update(rom).digest('hex')!==ROM_SHA256)throw Error('Unsupported ROM revision; expected supplied USA ROM SHA-256 '+ROM_SHA256);
 const spec=COURSES[name];if(!spec)throw Error('Unknown course '+name);
 const n=new NES({emulateSound:false});n.loadROM(rom.toString('binary'));
 n.cpu.mem.fill(0,0,0x800);n.cpu.mem.fill(0,0x6000,0x8000);
 n.mmap.load8kRomBank(30,0x8000);n.mmap.load8kRomBank(spec.bank,0xa000);n.mmap.load8kRomBank(14,0xc000);
 n.cpu.irqRequested=false;n.cpu.F_INTERRUPT=1;n.cpu.REG_SP=0x1ff;
 n.cpu.write(0x2000,0);n.cpu.write(0x4017,0xff);n.mmap.write(0xe000,0);
 n.cpu.mem.set([0x4c,0,6],0x600); // Safe loop if an unexpected jump escapes.
 n.cpu.mem[0x70a]=spec.tileset;n.cpu.mem[0x61]=spec.header&255;n.cpu.mem[0x62]=spec.header>>8;
 n.cpu.push(5);n.cpu.push(255);n.cpu.REG_PC=0xa407; // RTS returns at 0600.
 let instructions=0;for(;instructions<2000000;instructions++){n.cpu.emulate();if(n.cpu.REG_PC===0x5ff)break;}
 if(n.cpu.REG_PC!==0x5ff)throw Error('Original decoder did not return within instruction limit');
 const raw=Buffer.from(n.cpu.mem.slice(0x6000,0x7950)),width=240,height=27;
 const tiles=Array.from({length:width*height},(_,i)=>{const row=Math.floor(i/width),col=i%width;return raw[Math.floor(col/16)*432+row*16+col%16];});
 const headerOffset=16+spec.bank*8192+spec.header-0xa000,header=Array.from(rom.subarray(headerOffset,headerOffset+9));
 const objects=[];let off=spec.objects+1;for(;rom[off]!==255;off+=3){if(off>=spec.objects+256)throw Error('Object stream missing terminator');const [id,column,row]=rom.subarray(off,off+3);objects.push({id,column,row,x:column*16,y:row*16});}
 const slopeBases=[0x25,0x5f,0x99,0xe2],slopePointers=[0,1,2,3].map(q=>16+rom.readUInt16LE(16+q*2)-0xc000);
 const slopeShapes=Array.from({length:256},(_,t)=>t<slopeBases[t>>6]?0:rom[slopePointers[t>>6]+t-slopeBases[t>>6]]);
 const slopes=spec.tileset===3?{tileShape:slopeShapes,profiles:Array.from({length:21},(_,i)=>Array.from(rom.subarray(0x97+i*16,0x97+(i+1)*16))),playerVelocityEffect:Array.from(rom.subarray(0x1e7,0x1e7+21),v=>v>127?v-256:v),encoding:'Each of 16 pixel samples: low nibble is floor height, high nibble is ceiling height. Shape IDs retain original special cases; do not treat all zero profiles as empty.',profileROMOffset:0x97,reference:'Southbird PRG000 Level_SlopeSetByQuad/Slope_LUT'}:null;
 return {course:name,status:'decoded research data; slope collision and course gameplay not yet integrated',width,height,playableWidth:((header[4]&31)+1)*256,coordinateSystem:'Original level tile coordinates; x right and y down. Current browser 1-1 viewport subtracts 208 pixels from original y.',header,tiles,objects,slopes,render:{layoutBank:spec.bank,chrPages:spec.chr,paletteSet:spec.tileset===3?'hills':'plains',paletteIndex:header[5]&7},provenance:{romSHA256:ROM_SHA256,headerOffset,headerCPUAddress:spec.header,tileset:spec.tileset,bank:spec.bank,decoderEntry:0xa408,instructions:instructions+1,tileRAMStart:0x6000,tileRAMBytes:raw.length,tileRAMSHA256:createHash('sha256').update(raw).digest('hex'),objectStreamOffset:spec.objects,objectStreamBytes:off-spec.objects+1,randomState:'zero-initialized RAM; random cloud placement may differ from a played run',reference:'Southbird SMB3 disassembly PRG014-016 and original ROM 6502 level generator'}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [romPath,outDir,...names]=process.argv.slice(2);if(!romPath||!outDir)throw Error('Usage: node tools/decode-rom-levels.mjs your-rom.nes output-dir [1-1 1-2 1-3]');
 const rom=fs.readFileSync(romPath);fs.mkdirSync(outDir,{recursive:true});
 for(const name of names.length?names:Object.keys(COURSES)){const level=decodeLevel(rom,name);fs.writeFileSync(path.join(outDir,name+'.json'),JSON.stringify(level));console.log(JSON.stringify({course:name,instructions:level.provenance.instructions,tileHash:level.provenance.tileRAMSHA256,objects:level.objects.length}));}
}

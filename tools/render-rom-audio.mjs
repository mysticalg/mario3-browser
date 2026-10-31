import fs from 'node:fs';
import crypto from 'node:crypto';
import {NES} from 'jsnes';
if(!process.argv[2])throw Error('Usage: node tools/render-rom-audio.mjs path/to/your-rom.nes');
const rom=fs.readFileSync(process.argv[2]);
const rate=44100;
function create(){
  const samples=[];
  const nes=new NES({sampleRate:rate,onAudioSample:(l,r)=>samples.push((l+r)/2)});
  nes.loadROM(rom.toString('binary'));
  nes.cpu.mem.fill(0,0,0x800);
  // MMC3 layout used by the ROM's NMI sound call: banks 28 / 29 / 31.
  nes.mmap.load8kRomBank(28,0xa000);nes.mmap.load8kRomBank(29,0xc000);
  nes.cpu.mem.set([0x4c,0x00,0x06],0x600); // idle JMP $0600
  nes.cpu.irqRequested=false;nes.cpu.REG_SP=0x1ff;
  nes.cpu.write(0x4015,0x0f);nes.cpu.write(0x4017,0xff);
  function tick(){
    nes.cpu.irqRequested=false;nes.cpu.REG_SP=0x1ff;
    nes.cpu.push(0x05);nes.cpu.push(0xff); // RTS returns to $0600
    nes.cpu.REG_PC=0xa000-1;nes.frame();
  }
  for(let n=0;n<4;n++)tick();samples.length=0;
  return {nes,samples,tick};
}
function wav(samples,path){
  const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
  fs.writeFileSync(path,b);
}
const requests={boomerang:[0x4f3,4,.8],athletic:[0x4f5,0x90,65],'athletic-hurry':[0x4f5,0x90,55],'suit-loss':[0x4f2,0x80,1],fire:[0x4f1,0x20,.6],underground:[0x4f5,0x20,40],'underground-hurry':[0x4f5,0x20,35],tail:[0x4f2,0xb0,.6],jump:[0x4f1,1,1],'jump-big':[0x4f1,1,1],coin:[0x4f2,1,1],bump:[0x4f1,2,.6],break:[0x4f3,1,1],stomp:[0x4f1,4,.7],kick:[0x4f1,8,.7],appear:[0x4f2,2,1.5],powerup:[0x4f2,0x20,2],oneup:[0x4f2,0x40,2],shrink:[0x4f1,0x10,1],death:[0x4f4,1,4],clear:[0x4f4,0x20,6],gameover:[0x4f4,2,6],warning:[0x4f4,0x40,2],overworld:[0x4f5,0x10,65],'overworld-hurry':[0x4f5,0x10,55]};
const out=new URL('../assets/audio/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const previous=process.argv.length>3?JSON.parse(fs.readFileSync(new URL('provenance.json',out))):null;
const report={romSHA256:crypto.createHash('sha256').update(rom).digest('hex'),emulator:'JSNES 2.1.0',sampleRate:rate,engineEntry:'$A000, MMC3 banks 28/29/31',files:{}};
if(previous)Object.assign(report.files,previous.files);
for(const [name,[queue,value,seconds]] of Object.entries(requests)){
 if(process.argv.length>3&&!process.argv.slice(3).includes(name))continue;
  const {nes,samples,tick}=create();nes.cpu.mem[queue]=value;
  const transitions=[],phases=new Map();let previous=-1,phaseLoop=null;
  for(let n=0;n<Math.ceil(seconds*60.0988);n++){
    const start=samples.length;tick();
    if(name.endsWith('-hurry'))nes.cpu.write(0x7af7,0x10);
    if((name.startsWith('underground')||name.startsWith('athletic'))&&!phaseLoop){
      const mem=nes.cpu.mem,key=[...mem.slice(0x4d0,0x4e0),...mem.slice(0x4f9,0x500),mem[0x6b],mem[0x6c]].join(',');
      if(phases.has(key)&&n-phases.get(key).frame>100)phaseLoop={start:phases.get(key).sample/rate,end:start/rate};
      else if(!phases.has(key))phases.set(key,{frame:n,sample:start});
    }
    if((name.startsWith('overworld')||name.startsWith('underground')||name.startsWith('athletic'))&&nes.cpu.mem[0x4df]!==previous){
      previous=nes.cpu.mem[0x4df];transitions.push({index:previous,sample:start,loop:nes.cpu.load(0x7ae2)});
    }
  }
  let loop=phaseLoop;
  if(transitions.length){
    const seen=new Map();for(const t of transitions){if(seen.has(t.index)){loop={start:seen.get(t.index)/rate,end:t.sample/rate};break;}seen.set(t.index,t.sample);}
  }
  if(loop)samples.length=Math.round(loop.end*rate);
  const mean=samples.reduce((a,b)=>a+b,0)/samples.length;
  const centered=samples.map(v=>v-mean);let peak=0;for(const sample of centered)peak=Math.max(peak,Math.abs(sample));
  wav(centered,new URL(name+'.wav',out));
  report.files[name]={queue:'0x'+queue.toString(16),value,seconds:samples.length/rate,peak,sha256:crypto.createHash('sha256').update(fs.readFileSync(new URL(name+'.wav',out))).digest('hex')};
  if(loop)report.files[name].loop=loop;
  console.log(name,report.files[name].seconds.toFixed(2),peak.toFixed(3));
}
fs.writeFileSync(new URL('provenance.json',out),JSON.stringify(report,null,2));

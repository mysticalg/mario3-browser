import fs from 'node:fs';import {NES} from 'jsnes';import {createHash} from 'node:crypto';
if(!process.argv[2])throw Error('Usage: node tools/trace-rom-goomba-pipes.mjs your-rom.nes [output.json]');
const rom=fs.readFileSync(process.argv[2]);
const hash=createHash('sha256').update(rom).digest('hex');
if(hash!=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579')throw Error('Unsupported ROM revision');
// Original RAM symbols: Southbird smb3.asm.
const sy={CannonFire_ID:0x7a15,CannonFire_Timer:0x6e3,CannonFire_Var:0x6db,CannonFire_X:0x7a35,CannonFire_XHi:0x7a2d,CannonFire_Y:0x7a25,CannonFire_YHi:0x7a1d,Objects_State:0x661,Objects_X:0x91,Objects_XHi:0x76,Objects_Y:0xa3,Objects_YHi:0x88,Objects_Var1:0x689,Objects_FlipBits:0x679,Level_ObjectID:0x671,SlotIndexBackup:0xcd,Player_X:0x90,Player_XHi:0x75,Objects_SprHVis:0x651};
const results=[];
for(const playerX of [350,500])for(const count of [0,1,2,3]){
 const n=new NES({emulateSound:false});n.loadROM(rom.toString('binary'));const c=n.cpu;c.mem.fill(0,0,0x800);c.mem.fill(0,0x6000,0x8000);n.mmap.load8kRomBank(30,0x8000);n.mmap.load8kRomBank(7,0xa000);n.mmap.load8kRomBank(0,0xc000);n.mmap.write(0xe000,0);c.irqRequested=false;c.F_INTERRUPT=1;c.REG_SP=0x1ff;c.REG_X=0;
 const put=(name,v)=>c.mem[sy[name]]=v;
 put('SlotIndexBackup',0);put('CannonFire_ID',6);put('CannonFire_Var',count);put('CannonFire_X',400&255);put('CannonFire_XHi',1);put('CannonFire_Y',304&255);put('CannonFire_YHi',1);put('Player_X',playerX&255);put('Player_XHi',playerX>>8);
 c.push(5);c.push(255);c.REG_PC=0xbd14;let instructions=0;while(instructions++<10000){c.emulate();if(c.REG_PC===0x5ff)break;}
 const objects=[];for(let i=0;i<5;i++)if(c.mem[sy.Objects_State+i])objects.push({slot:i,id:c.mem[sy.Level_ObjectID+i],x:c.mem[sy.Objects_X+i]+256*c.mem[sy.Objects_XHi+i],y:c.mem[sy.Objects_Y+i]+256*c.mem[sy.Objects_YHi+i],emerging:c.mem[sy.Objects_Var1+i],flip:c.mem[sy.Objects_FlipBits+i]});
 results.push({playerX,count,returned:c.REG_PC===0x5ff,timer:c.mem[sy.CannonFire_Timer],nextCount:c.mem[sy.CannonFire_Var],objects});
}
const report={romSHA256:hash,entry:0xbd15,bank:7,coordinateSystem:'Original ROM world pixels, before the browser Y offset of208',reference:'Southbird PRG007 CFire_GoombaPipe / PrepareNewObjectOrAbort',cases:results};
fs.writeFileSync(process.argv[3]||'research/goomba-pipe-trace.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));

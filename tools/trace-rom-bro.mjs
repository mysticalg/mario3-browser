// Isolated original-ROM traces. Reference: Southbird PRG004/007.
import fs from 'node:fs';import {createHash} from 'node:crypto';import {NES} from 'jsnes';
if(!process.argv[2])throw Error('Usage: node tools/trace-rom-bro.mjs your-rom.nes [output.json]');
const rom=fs.readFileSync(process.argv[2]),hash=createHash('sha256').update(rom).digest('hex');
if(hash!=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579')throw Error('Unsupported ROM revision');
const sy={"Counter_1":21,"Horz_Scroll":253,"Horz_Scroll_Hi":18,"Level_ObjectID":1649,"Level_Tileset":1802,"Level_VertScroll":1347,"Level_VertScrollH":1346,"ObjGroupRel_Idx":994,"Objects_FlipBits":1657,"Objects_SprAttr":32743,"Objects_State":1633,"Objects_Timer3":1702,"Objects_Var5":154,"Objects_Var6":1904,"Objects_X":145,"Objects_XHi":118,"Objects_XVel":190,"Objects_Y":163,"Objects_YHi":136,"Objects_YVel":208,"Player_X":144,"Player_XHi":117,"Player_Y":162,"Player_YHi":135,"SlotIndexBackup":205,"SpecialObj_Data":1735,"SpecialObj_ID":32710,"SpecialObj_Timer":1745,"SpecialObj_Var2":1431,"SpecialObj_Var3":1461,"SpecialObj_XLo":1481,"SpecialObj_XVel":1501,"SpecialObj_XVelFrac":1451,"SpecialObj_YHi":32725,"SpecialObj_YLo":1471,"SpecialObj_YVel":1491,"SpecialObj_YVelFrac":1441,"Tile_AttrTable":32404};
function traceWalk(){
const l=JSON.parse(fs.readFileSync(new URL('../research/levels/1-3.json',import.meta.url)));
const n=new NES({emulateSound:false});n.loadROM(rom.toString('binary'));const c=n.cpu;c.mem.fill(0,0,0x800);c.mem.fill(0,0x6000,0x8000);n.mmap.load8kRomBank(30,0x8000);n.mmap.load8kRomBank(4,0xa000);n.mmap.load8kRomBank(0,0xc000);n.mmap.write(0xe000,0);c.irqRequested=false;c.F_INTERRUPT=1;
for(let i=0;i<6480;i++){const row=Math.floor(i/240),col=i%240;c.mem[0x6000+Math.floor(col/16)*432+row*16+col%16]=l.tiles[i];}
function put(k,v){if(sy[k]===undefined)throw Error(k);c.mem[sy[k]]=v;}
put('Level_Tileset',1);put('ObjGroupRel_Idx',22);put('Horz_Scroll_Hi',1);put('Horz_Scroll',0);put('Level_VertScroll',208);put('Level_VertScrollH',0);c.mem.set(rom.subarray(16+15*8192+0x400,16+15*8192+0x408),sy.Tile_AttrTable);
put('Objects_State',2);put('Level_ObjectID',0x82);put('Objects_X',80);put('Objects_XHi',1);put('Objects_Y',128);put('Objects_YHi',1);put('Objects_SprAttr',2);put('Player_X',24);put('Player_XHi',1);put('Player_Y',144);put('Player_YHi',1);
function call(addr){c.irqRequested=false;c.REG_X=0;c.REG_SP=0x1ff;put('SlotIndexBackup',0);c.push(5);c.push(255);c.REG_PC=addr-1;let i=0;while(i++<20000){c.emulate();if(c.REG_PC===0x5ff)return i;}throw Error('no return '+addr.toString(16)+' pc'+c.REG_PC.toString(16));}
const pointer=c.load(0xa048+22*2)+256*c.load(0xa048+22*2+1),rows=[];for(let t=0;t<180;t++){put('Counter_1',t&255);for(const k of ['Objects_Timer','Objects_Timer2','Objects_Timer3'])if(c.mem[sy[k]]>0)c.mem[sy[k]]--;call(pointer);if(t%10===0)rows.push({t,x:c.mem[sy.Objects_X]+256*c.mem[sy.Objects_XHi],y:c.mem[sy.Objects_Y]+256*c.mem[sy.Objects_YHi],vx:c.mem[sy.Objects_XVel],vy:c.mem[sy.Objects_YVel],phase:c.mem[sy.Objects_Var5],timer:c.mem[sy.Objects_Timer3],throwCounter:c.mem[sy.Objects_Var6],state:c.mem[sy.Objects_State]});}
return rows;
}
function traceFlight(){
const n=new NES({emulateSound:false});n.loadROM(rom.toString('binary'));const c=n.cpu;c.mem.fill(0,0,0x800);c.mem.fill(0,0x6000,0x8000);n.mmap.load8kRomBank(30,0x8000);n.mmap.load8kRomBank(7,0xa000);n.mmap.load8kRomBank(0,0xc000);n.mmap.write(0xe000,0);c.F_INTERRUPT=1;c.irqRequested=false;
function put(k,v){if(sy[k]===undefined)throw Error(k);c.mem[sy[k]]=v;}function get(k){return c.mem[sy[k]];}const signed=v=>v>127?v-256:v;
put('Objects_State',2);put('Level_ObjectID',0x82);put('Objects_X',100);put('Objects_Y',100);put('Objects_FlipBits',64);put('Player_X',0);put('Player_XHi',10);put('Player_Y',0);put('Player_YHi',10);put('SpecialObj_ID',2);put('SpecialObj_XLo',100);put('SpecialObj_YLo',100);put('SpecialObj_XVel',32);put('SpecialObj_YVel',234);put('SpecialObj_Timer',64);put('SpecialObj_Var2',1);put('SpecialObj_Data',15);
const rows=[];for(let t=0;t<220;t++){
 put('Counter_1',t&255);if(get('SpecialObj_Timer')>0)put('SpecialObj_Timer',get('SpecialObj_Timer')-1);
 c.REG_X=0;c.REG_SP=0x1ff;c.irqRequested=false;put('SlotIndexBackup',0);c.push(5);c.push(255);c.REG_PC=0xb8aa;let i=0;while(i++<10000){c.emulate();if(c.REG_PC===0x5ff)break;}if(c.REG_PC!==0x5ff)throw Error('no return');
 rows.push({t,id:get('SpecialObj_ID'),x:get('SpecialObj_XLo'),y:get('SpecialObj_YLo')+256*get('SpecialObj_YHi'),vx:signed(get('SpecialObj_XVel')),vy:signed(get('SpecialObj_YVel')),phase:signed(get('SpecialObj_Var2')),verticalPhase:get('SpecialObj_Var3'),timer:get('SpecialObj_Timer'),hold:get('SpecialObj_Data')&15,fx:get('SpecialObj_XVelFrac'),fy:get('SpecialObj_YVelFrac')});
 if(!get('SpecialObj_ID'))break;
}
return rows;
}
const report={romSHA256:hash,flightEntry:0xb8ab,broEntry:0xa499,flightOwner:{x:100,y:100,facing:'right'},flight:traceFlight(),walk:traceWalk()};fs.writeFileSync(process.argv[3]||'research/boomerang-traces.json',JSON.stringify(report));console.log(JSON.stringify({flightFrames:report.flight.length,walkSamples:report.walk.length}));

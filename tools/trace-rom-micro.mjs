// Original ROM isolated traces. Southbird PRG004/007.
import fs from 'node:fs';import {createHash} from 'node:crypto';import {NES} from 'jsnes';
if(!process.argv[2])throw Error('Usage: node tools/trace-rom-micro.mjs your-rom.nes [output.json]');
const rom=fs.readFileSync(process.argv[2]),hash=createHash('sha256').update(rom).digest('hex');
if(hash!=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579')throw Error('Unsupported ROM revision');
const sy={"Counter_1":21,"Horz_Scroll":253,"Horz_Scroll_Hi":18,"Level_NoStopCnt":1381,"Level_ObjectID":1649,"Level_Tileset":1802,"Level_VertScroll":1347,"Level_VertScrollH":1346,"ObjGroupRel_Idx":994,"Objects_SprAttr":32743,"Objects_State":1633,"Objects_Timer":1304,"Objects_Var2":1681,"Objects_Var3":32720,"Objects_Var4":127,"Objects_Var5":154,"Objects_X":145,"Objects_XHi":118,"Objects_XVel":190,"Objects_XVelFrac":1870,"Objects_Y":163,"Objects_YHi":136,"Objects_YVel":208,"Objects_YVelFrac":1888,"Pad_Input":24,"Player_Microgoomba":1718,"Player_X":144,"Player_XHi":117,"Player_Y":162,"Player_YHi":135,"SlotIndexBackup":205,"SpecialObj_Data":1735,"SpecialObj_ID":32710,"SpecialObj_Var1":1725,"SpecialObj_XLo":1481,"SpecialObj_XVel":1501,"SpecialObj_XVelFrac":1451,"SpecialObj_YHi":32725,"SpecialObj_YLo":1471,"SpecialObj_YVel":1491,"SpecialObj_YVelFrac":1441,"Tile_AttrTable":32404};
function traceBomber(){
const l=JSON.parse(fs.readFileSync(new URL('../research/levels/1-3.json',import.meta.url)));
const n=new NES({emulateSound:false});n.loadROM(rom.toString('binary'));const c=n.cpu;c.mem.fill(0,0,0x800);c.mem.fill(0,0x6000,0x8000);n.mmap.load8kRomBank(30,0x8000);n.mmap.load8kRomBank(4,0xa000);n.mmap.load8kRomBank(0,0xc000);n.mmap.write(0xe000,0);c.irqRequested=false;c.F_INTERRUPT=1;
for(let i=0;i<6480;i++){const row=Math.floor(i/240),col=i%240;c.mem[0x6000+Math.floor(col/16)*432+row*16+col%16]=l.tiles[i];}
function put(k,v){if(sy[k]===undefined)throw Error(k);c.mem[sy[k]]=v;}
put('Level_Tileset',1);put('ObjGroupRel_Idx',8);put('Horz_Scroll_Hi',7);put('Horz_Scroll',0);put('Level_VertScroll',208);put('Level_VertScrollH',0);c.mem.set(rom.subarray(16+15*8192+0x400,16+15*8192+0x408),sy.Tile_AttrTable);
put('Objects_State',2);put('Level_ObjectID',0x74);put('Objects_X',144);put('Objects_XHi',7);put('Objects_Y',144);put('Objects_YHi',1);put('Objects_SprAttr',3);put('Player_X',108);put('Player_XHi',7);put('Player_Y',144);put('Player_YHi',1);
function call(addr){c.irqRequested=false;c.REG_X=0;c.REG_SP=0x1ff;put('SlotIndexBackup',0);c.push(5);c.push(255);c.REG_PC=addr-1;let i=0;while(i++<20000){c.emulate();if(c.REG_PC===0x5ff)return i;}throw Error('no return '+addr.toString(16)+' pc'+c.REG_PC.toString(16));}
const pointer=c.load(0xa048+8*2)+256*c.load(0xa048+8*2+1),rows=[];for(let t=0;t<260;t++){put('Counter_1',t&255);for(const k of ['Objects_Timer','Objects_Timer2','Objects_Timer3'])if(c.mem[sy[k]]>0)c.mem[sy[k]]--;call(pointer);rows.push({t,x:c.mem[sy.Objects_X]+256*c.mem[sy.Objects_XHi],y:c.mem[sy.Objects_Y]+256*c.mem[sy.Objects_YHi],vx:c.mem[sy.Objects_XVel],vy:c.mem[sy.Objects_YVel],phase:c.mem[sy.Objects_Var4],timer:c.mem[sy.Objects_Timer],anim:c.mem[sy.Objects_Var5],wing:c.mem[sy.Objects_Var3],turn:c.mem[sy.Objects_Var2],fx:c.mem[sy.Objects_XVelFrac],fy:c.mem[sy.Objects_YVelFrac],state:c.mem[sy.Objects_State]});}
return rows;
}
function traceMicro(){
const n=new NES({emulateSound:false});n.loadROM(rom.toString('binary'));const c=n.cpu;c.mem.fill(0,0,0x800);c.mem.fill(0,0x6000,0x8000);n.mmap.load8kRomBank(30,0x8000);n.mmap.load8kRomBank(7,0xa000);n.mmap.load8kRomBank(0,0xc000);n.mmap.write(0xe000,0);c.F_INTERRUPT=1;c.irqRequested=false;
const put=(k,v)=>c.mem[sy[k]]=v,get=k=>c.mem[sy[k]],signed=v=>v>127?v-256:v;
put('Player_X',100);put('Player_Y',100);put('SpecialObj_ID',6);put('SpecialObj_XLo',88);put('SpecialObj_YLo',80);
const rows=[];for(let t=0;t<180;t++){
 put('Counter_1',t);put('Level_NoStopCnt',t);put('Player_Microgoomba',0);const press=[100,102,104,106,108].includes(t)?128:0;put('Pad_Input',press);
 c.REG_X=0;c.REG_SP=0x1ff;c.irqRequested=false;put('SlotIndexBackup',0);c.push(5);c.push(255);c.REG_PC=0xb5bf;let i=0;while(i++<10000){c.emulate();if(c.REG_PC===0x5ff)break;}if(c.REG_PC!==0x5ff)throw Error('no return '+c.REG_PC.toString(16));
 rows.push({t,press,id:get('SpecialObj_ID'),x:get('SpecialObj_XLo'),y:get('SpecialObj_YLo')+256*get('SpecialObj_YHi'),vx:signed(get('SpecialObj_XVel')),vy:signed(get('SpecialObj_YVel')),data:signed(get('SpecialObj_Data')),anim:get('SpecialObj_Var1'),attached:get('Player_Microgoomba'),fx:get('SpecialObj_XVelFrac'),fy:get('SpecialObj_YVelFrac')});
}
return rows;
}
const report={romSHA256:hash,microEntry:0xb5c0,bomberEntry:0xaf73,micro:traceMicro(),bomber:traceBomber()};fs.writeFileSync(process.argv[3]||'research/microgoomba-traces.json',JSON.stringify(report));console.log(JSON.stringify({microFrames:report.micro.length,bomberFrames:report.bomber.length}));

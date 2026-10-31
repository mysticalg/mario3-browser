import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game,STEP_MS} from '../engine.js';
import {readGamepad,ControllerInput} from '../input.js';
const level=JSON.parse(fs.readFileSync(new URL('../assets/level.json',import.meta.url)));
function fixture(){const g=new Game(level);g.enemies.forEach(e=>e.state=0);return g;}
function steps(g,n,input={}){for(let i=0;i<n;i++)g.update(input);}
test('lands on original ROM ground and stays grounded',()=>{const g=fixture();steps(g,30);assert.equal(g.player.y,192);assert.equal(g.player.grounded,true);steps(g,15);assert.equal(g.player.y,192);assert.equal(g.player.grounded,true);});
test('holding jump increases jump height and lands again',()=>{
  const a=fixture(),b=fixture();steps(a,30);steps(b,30);
  let ay=192,by=192;
  for(let i=0;i<55;i++){a.update({jump:i<18});b.update({jump:i<3});ay=Math.min(ay,a.player.y);by=Math.min(by,b.player.y);}
  assert.ok(ay<by-8);assert.equal(a.player.y,192);assert.equal(a.player.grounded,true);
});
test('movement selects corrected left and right sprite facing',()=>{const g=fixture();steps(g,6,{right:true});assert.ok(g.player.x>24);assert.equal(g.player.facing,'right');steps(g,12,{left:true});assert.ok(g.player.vx<0);assert.equal(g.player.facing,'left');});
test('running is faster than walking',()=>{const walk=fixture(),run=fixture();steps(walk,30,{right:true});steps(run,30,{right:true,run:true});assert.ok(run.player.x>walk.player.x+10);});
test('pipe sides block movement',()=>{const g=fixture();Object.assign(g.player,{x:338,y:176,vx:2.4});steps(g,8,{right:true});assert.ok(g.player.x<352);});
test('head collision releases a single question-block coin',()=>{const g=fixture();g.patch(10,10,0x63,3);Object.assign(g.player,{x:160,y:176,vy:-4});g.update({jump:true});assert.equal(g.coins,1);assert.equal(g.tiles[2570],0x5f);g.head(10,10);assert.equal(g.coins,1);});
test('small Mario cannot break a brick; Super Mario can',()=>{const g=fixture();g.patch(10,10,0x67,2);g.head(10,10);assert.equal(g.map[2570],2);g.player.big=true;g.head(10,10);assert.equal(g.map[2570],0);assert.equal(g.tiles[2570],0x80);});
test('power block releases and consumes a real mushroom',()=>{const g=fixture();g.patch(10,10,0x61,4);g.head(10,10);assert.equal(g.power.emerging,16);assert.equal(g.tiles[2570],0x5f);Object.assign(g.power,{x:g.player.x,y:g.player.y,emerging:0});g.updatePower();assert.equal(g.player.big,true);assert.equal(g.player.h,32);assert.equal(g.power,null);assert.equal(g.score,1000);});
test('damage shrinks, then immunity prevents a second hit',()=>{const g=fixture();Object.assign(g.player,{big:true,h:32,y:160});g.hurt();assert.equal(g.player.h,16);assert.equal(g.player.big,false);assert.equal(g.state,'playing');g.hurt();assert.equal(g.state,'playing');assert.ok(g.player.invul>0);});
test('one-way platforms allow ascent and catch a descent',()=>{const g=fixture();g.patch(10,10,0x51,5);Object.assign(g.player,{x:160,y:176,vy:-4});g.update({jump:true});assert.ok(g.player.y<176);Object.assign(g.player,{y:130,vy:3,grounded:false});steps(g,12,{jump:true});assert.equal(g.player.y,144);assert.equal(g.player.grounded,true);});
test('stomping Goomba defeats it and bounces Mario',()=>{const g=fixture();const e=g.enemies[0];Object.assign(e,{kind:1,state:1,x:100,y:192,h:16,vx:0,vy:0});Object.assign(g.player,{x:100,y:179,vy:3});g.updateEnemies(191);assert.ok(e.state<0);assert.ok(g.player.vy<0);assert.equal(g.score,100);});
test('Koopa stomp creates a shell that can be kicked',()=>{const g=fixture();const e=g.enemies[0];Object.assign(e,{kind:2,state:1,x:100,y:176,h:32,vx:0,vy:0});Object.assign(g.player,{x:100,y:164,vy:3});g.updateEnemies(175);assert.equal(e.state,2);assert.equal(e.h,16);Object.assign(g.player,{x:90,y:192,vy:0});e.cooldown=0;g.updateEnemies(208);assert.equal(e.state,3);assert.ok(e.vx>0);});
test('collecting a coin updates score and cannot repeat',()=>{const g=fixture();g.collectibles=[{x:24,y:g.player.y,got:false}];g.update();assert.equal(g.coins,1);assert.equal(g.score,50);steps(g,5);assert.equal(g.coins,1);});
test('death consumes a life and respawns; final death becomes game over',()=>{const g=fixture();g.hurt();assert.equal(g.state,'dying');steps(g,56);assert.equal(g.lives,2);assert.equal(g.state,'playing');g.lives=1;g.hurt();steps(g,56);assert.equal(g.lives,0);assert.equal(g.state,'gameover');});
test('pits are lethal, including in protected demo',()=>{const g=fixture();g.player.y=270;g.update();assert.equal(g.state,'dying');});
test('pause freezes physics and restart clears the current run',()=>{const g=fixture();g.paused=true;const before=JSON.stringify(g.snapshot());steps(g,10,{right:true});assert.equal(JSON.stringify(g.snapshot()),before);g.score=400;g.lives=1;g.restart(false);assert.equal(g.score,0);assert.equal(g.lives,3);assert.equal(g.paused,false);});
test('complete protected preview reaches the card using original geometry',()=>{const g=new Game(level);g.auto=true;let won=false;for(let i=0;i<4000;i++){g.update();if(g.state==='complete'){won=true;break;}}assert.equal(won,true);assert.equal(g.lives,3);assert.ok(g.score>0);});
test('world boundaries and missing enemies do not produce NaN',()=>{const g=fixture();g.player.x=0;steps(g,30,{left:true});assert.equal(g.player.x,0);assert.ok(Number.isFinite(g.player.y));});
function pad(overrides={}){return {index:0,id:'Test standard controller',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),...overrides};}
test('gamepad maps D-pad, analogue stick, jump and run with deadzone',()=>{const p=pad();p.axes[0]=.15;assert.equal(readGamepad(p).right,false);p.axes[0]=.7;assert.equal(readGamepad(p).right,true);p.buttons[0].pressed=true;p.buttons[2].value=1;assert.equal(readGamepad(p).jump,true);assert.equal(readGamepad(p).run,true);p.axes[0]=0;p.buttons[14].pressed=true;assert.equal(readGamepad(p).left,true);});
test('controller Start and Select are edge-triggered and disconnect releases inputs',()=>{let pads=[pad()];const input=new ControllerInput(()=>pads);input.poll();pads[0].buttons[9].pressed=true;assert.equal(input.poll().edges.start,true);assert.equal(input.poll().edges.start,false);pads[0].buttons[9].pressed=false;input.poll();pads[0].buttons[9].pressed=true;assert.equal(input.poll().edges.start,true);pads[0].buttons[8].pressed=true;assert.equal(input.poll().edges.restart,true);pads=[];assert.equal(input.poll().state,null);});
test('simulation runs at 60 Hz and game clock follows real seconds',()=>{assert.equal(STEP_MS,1000/60);const g=fixture();steps(g,59);assert.equal(g.clock,300);g.update();assert.equal(g.clock,299);});
test('camera tracks fractional movement instead of four-pixel jumps',()=>{const g=fixture();g.player.x=200.25;assert.equal(g.camera,96.25);g.player.x+=.5;assert.equal(g.camera,96.75);});
test('ledge grace permits a late jump but expires',()=>{
  const g=fixture();g.map.fill(0);g.player.grounded=true;g.update({right:true});assert.equal(g.player.grounded,false);
  g.update({right:true,jump:true});assert.ok(g.player.vy<0);assert.equal(g.player.jumpBuffer,0);
  const expired=fixture();expired.map.fill(0);expired.player.grounded=true;steps(expired,8);expired.update({jump:true});assert.ok(expired.player.vy>0);
});
test('jump pressed just before landing is buffered; holding does not auto-jump again',()=>{
  const g=fixture();Object.assign(g.player,{y:188,vy:3,grounded:false});g.update({jump:true});assert.ok(g.player.jumpBuffer>0);g.update({jump:true});g.update({jump:true});assert.ok(g.player.vy<0);
  steps(g,65,{jump:true});assert.equal(g.player.grounded,true);assert.equal(g.player.y,192);
});
test('collisions align Mario flush with either side of a pipe',()=>{
  const g=fixture();Object.assign(g.player,{x:335,y:176,vx:3.6});steps(g,5,{right:true,run:true});assert.equal(g.player.x,338);assert.equal(g.wall(g.player.x,g.player.y,16),false);
  Object.assign(g.player,{x:386,y:176,vx:-3.6});steps(g,5,{left:true,run:true});assert.equal(g.player.x,382);assert.equal(g.wall(g.player.x,g.player.y,16),false);
});
test('Super Mario can duck, cannot stand into a ceiling, and stands when clear',()=>{
  const g=fixture();Object.assign(g.player,{big:true,h:32,y:176});g.update({down:true});assert.equal(g.player.h,16);assert.equal(g.player.y,192);assert.equal(g.player.crouched,true);
  g.patch(1,11,0x79,1);g.update();assert.equal(g.player.h,16);assert.equal(g.player.y,192);
  g.patch(1,11,0x80,0);g.update();assert.equal(g.player.h,32);assert.equal(g.player.y,176);
});
test('mushroom growth under low ceilings does not embed Mario; damage keeps his feet',()=>{
  const g=fixture();g.patch(1,11,0x79,1);g.power={x:24,y:192,vy:0,dir:0,emerging:0};g.updatePower();assert.equal(g.player.big,true);assert.equal(g.player.crouched,true);assert.equal(g.player.h,16);assert.equal(g.wall(g.player.x,g.player.y,16),false);
  const feet=g.player.y+g.player.h;g.player.invul=0;g.hurt();assert.equal(g.player.y+g.player.h,feet);
});
test('block bumps, coin pops and brick debris are transient feedback',()=>{
  const g=fixture();g.patch(10,10,0x63,3);g.head(10,10);assert.equal(g.bumps.has(2570),true);assert.ok(g.effects.some(e=>e.kind==='coin'));
  steps(g,40);assert.equal(g.bumps.size,0);assert.equal(g.effects.length,0);
  g.patch(10,10,0x67,2);g.player.big=true;g.head(10,10);assert.equal(g.effects.filter(e=>e.kind==='brick').length,4);steps(g,40);assert.equal(g.effects.length,0);
});
test('opposing movement buttons are neutral and braking uses a skid pose',()=>{
  const g=fixture();g.update({left:true,right:true});assert.equal(g.player.vx,0);steps(g,15,{right:true});g.update({left:true});assert.equal(g.player.skidding,true);assert.ok(g.player.vx>0);
});
test('D-pad overrides stick drift and contradictory D-pad directions are neutral',()=>{
  const p=pad();p.axes[0]=.8;p.buttons[14].pressed=true;assert.equal(readGamepad(p).left,true);assert.equal(readGamepad(p).right,false);p.buttons[15].pressed=true;assert.equal(readGamepad(p).left,false);assert.equal(readGamepad(p).right,false);p.buttons[13].pressed=true;assert.equal(readGamepad(p).down,true);
});
test('a second controller cannot steal an actively used pad',()=>{
  const a=pad({index:0}),b=pad({index:1});const input=new ControllerInput(()=>[a,b]);b.buttons[0].pressed=true;assert.equal(input.poll().state.index,1);a.buttons[0].pressed=true;assert.equal(input.poll().state.index,1);b.buttons[0].pressed=false;assert.equal(input.poll().state.index,0);
});

test('airborne momentum persists without steering and running raises jump height',()=>{
 const g=fixture();Object.assign(g.player,{grounded:false,y:120,vy:-2,vx:3});g.update();assert.equal(g.player.vx,3);
 const a=fixture(),b=fixture();b.player.vx=3.6;a.update({jump:true});b.update({jump:true,right:true,run:true});assert.ok(b.player.vy<a.player.vy);
});
test('ducking brakes into a slide instead of accelerating from rest',()=>{
 const g=fixture();Object.assign(g.player,{big:true,h:32,y:176,vx:3});g.update({down:true,right:true,run:true});assert.ok(g.player.vx>2&&g.player.vx<3);steps(g,30,{down:true,right:true,run:true});assert.equal(g.player.vx,0);
});
test('holding Run picks up a shell and releasing throws it safely',()=>{
 const g=fixture(),e=g.enemies[0];Object.assign(e,{kind:2,state:2,x:100,y:192,h:16,vx:0,vy:0,cooldown:0});Object.assign(g.player,{x:90,y:192,vy:0,runHeld:true});g.updateEnemies(208);assert.equal(g.player.carrying,0);
 g.player.x=92;g.updateEnemies(208);assert.equal(e.x,104);assert.equal(g.state,'playing');g.update({});assert.equal(g.player.carrying,-1);assert.equal(e.state,3);assert.equal(e.vx,5);assert.ok(e.cooldown>0);assert.equal(g.state,'playing');
});
test('100 coins award one life and a dedicated sound',()=>{
 const sounds=[],g=new Game(level,name=>sounds.push(name));g.coins=99;g.coin();assert.equal(g.coins,0);assert.equal(g.lives,4);assert.equal(sounds.at(-1),'oneup');
});
test('held jump changes stomp bounce and consecutive stomps multiply points',()=>{
 const g=fixture(),e=g.enemies[0];
 const hit=hold=>{Object.assign(e,{kind:1,state:1,x:100,y:192,h:16,vx:0,vy:0});Object.assign(g.player,{x:100,y:179,vy:3,oldJump:hold});g.updateEnemies(191);return g.player.vy;};
 const low=hit(false),high=hit(true);assert.ok(high<low);assert.equal(g.score,300);
});

function runway(){const g=fixture();g.map.fill(0);for(let x=0;x<176;x++)g.patch(x,13,0x53,1);return g;}
test('power blocks give small Mario a mushroom and Super Mario a leaf',()=>{
 const g=fixture();Object.assign(g.player,{big:true,h:32,y:176});g.patch(10,10,0x61,4);g.head(10,10);assert.equal(g.power.kind,'leaf');
 Object.assign(g.power,{x:g.player.x,y:g.player.y,emerging:0});g.updatePower();assert.equal(g.player.raccoon,true);assert.equal(g.player.big,true);
});
test('leaf falls with a sideways oscillation and grants raccoon power',()=>{
 const g=runway();g.power={kind:'leaf',x:100,y:40,age:0,emerging:0};for(let i=0;i<30;i++)g.updatePower();assert.ok(g.power.x>100);assert.ok(g.power.y>40);
});
test('running charges P-meter and raccoon can launch into limited flight',()=>{
 const g=runway();Object.assign(g.player,{big:true,raccoon:true,h:32,y:176});steps(g,80,{right:true,run:true});assert.equal(g.player.powerMeter,60);
 g.update({right:true,run:true,jump:true});assert.equal(g.player.flight,256);assert.ok(g.player.vy<0);
 const initialY=g.player.y;for(let i=0;i<70;i++)g.update({right:true,run:true,jump:i%8<4});assert.ok(g.player.flight>0);assert.ok(g.player.y<initialY);
 steps(g,260);assert.equal(g.player.flight,0);assert.ok(g.player.powerMeter<60);
});
test('unfilled P-meter cannot initiate flight, but jump taps flutter down',()=>{
 const g=runway();Object.assign(g.player,{big:true,raccoon:true,h:32,y:100,vy:5,grounded:false});g.update({jump:true});assert.equal(g.player.flight,0);assert.ok(g.player.vy<=1.31);assert.ok(g.player.wag>0);
});
test('raccoon tail defeats an enemy and strikes adjacent bricks',()=>{
 const g=runway();Object.assign(g.player,{big:true,raccoon:true,h:32,y:176});const e=g.enemies[0];Object.assign(e,{kind:1,state:1,x:45,y:192,h:16,vx:0,vy:0});g.update({run:true});assert.ok(e.state<0);assert.ok(g.events.some(e=>e.type==='tail-hit'));
 g.patch(3,12,0x67,2);steps(g,8,{run:true});assert.equal(g.map[12*256+3],0);
});
test('damage removes raccoon power before shrinking Mario and cancels flight',()=>{
 const g=fixture();Object.assign(g.player,{big:true,raccoon:true,h:32,y:176,flight:100});g.hurt();assert.equal(g.player.raccoon,false);assert.equal(g.player.big,true);assert.equal(g.player.h,32);assert.equal(g.player.flight,0);g.player.invul=0;g.hurt();assert.equal(g.player.big,false);
});
test('sky flight has a camera, altitude limit and pause freezes flight timer',()=>{
 const g=runway();Object.assign(g.player,{big:true,raccoon:true,h:32,y:-319,vy:-3,grounded:false,flight:100,wag:16});g.update({jump:true});assert.equal(g.player.y,-320);assert.ok(g.cameraY<0);g.paused=true;const time=g.player.flight;steps(g,50);assert.equal(g.player.flight,time);
});

test('stationary shells use the ROM wake timer cadence and restore Koopa height',()=>{
 const g=runway(),e=g.enemies[0];Object.assign(e,{kind:2,state:2,x:120,y:192,h:16,vx:0,vy:0,wake:255});
 for(let i=1;i<=414;i++){g.frame=i;g.updateEnemies(208);}assert.equal(e.state,2);assert.equal(e.wake,1);
 g.frame=415;g.updateEnemies(208);assert.equal(e.state,1);assert.equal(e.h,32);assert.equal(e.y,176);assert.ok(e.vx<0);
});
test('held shells count more slowly but wake in Mario hands',()=>{
 const g=runway(),e=g.enemies[0];Object.assign(e,{kind:2,state:2,x:36,y:192,h:16,vx:0,vy:0,wake:255});g.player.carrying=0;
 for(let i=1;i<=734;i++){g.frame=i;g.updateEnemies(208);}assert.equal(g.player.carrying,0);assert.equal(e.wake,1);
 g.frame=735;g.updateEnemies(208);assert.equal(g.player.carrying,-1);assert.equal(e.state,1);
});
test('moving shells break bricks even while Mario is small and trigger question blocks',()=>{
 const g=runway(),e=g.enemies[0];Object.assign(e,{kind:2,state:3,x:143,y:192,h:16,vx:5,vy:0});g.patch(10,12,0x67,2);
 g.updateEnemies(208);assert.equal(g.map[12*256+10],0);assert.ok(e.vx<0);
 Object.assign(e,{state:3,x:143,y:192,vx:5});g.patch(10,12,0x63,3);g.updateEnemies(208);assert.equal(g.coins,1);assert.equal(g.map[12*256+10],1);
});
test('hitting a block from below defeats an enemy standing on it',()=>{
 const g=runway(),e=g.enemies[0];g.patch(10,10,0x67,2);Object.assign(e,{kind:1,state:1,x:160,y:144,h:16,vx:0,vy:0});g.head(10,10);assert.ok(e.state<0);assert.equal(g.score,100);assert.equal(g.map[10*256+10],2);assert.ok(g.events.some(e=>e.type==='block-bumped-enemy'));
});

function enterBonus(g){Object.assign(g.player,{x:2264,y:-112,h:16,big:false,grounded:true,vx:0,vy:0});g.update({down:true});assert.equal(g.state,'pipe');steps(g,48);assert.equal(g.area,'bonus');assert.equal(g.state,'playing');}
test('ROM sky pipe is solid above the old viewport and enters original bonus room',()=>{
 const g=fixture();assert.equal(g.cell(2264,-96),1);const time=g.clock;enterBonus(g);assert.equal(g.collectibles.length,12);assert.equal(g.player.x,136);assert.equal(g.player.y,64);assert.equal(g.clock,time);assert.equal(g.areaWidth,512);assert.equal(g.cameraY,0);
});
test('bonus exit follows ROM junction back to the main-level pipe',()=>{
 const g=fixture();enterBonus(g);Object.assign(g.player,{x:360,y:64,vy:-2,vx:0,grounded:false,oldJump:false});g.update({jump:true});assert.equal(g.state,'pipe');steps(g,48);assert.equal(g.area,'main');assert.equal(g.player.x,2328);assert.equal(g.player.y+g.player.h,176);
});
test('area transitions preserve suit, score, coins and changed main terrain',()=>{
 const g=fixture();g.patch(10,10,0x5f,1);g.score=500;g.coins=5;Object.assign(g.player,{raccoon:true,big:true,h:32,x:2264,y:-128,grounded:true});g.update({down:true});steps(g,48);assert.equal(g.player.raccoon,true);assert.equal(g.score,500);assert.equal(g.coins,5);
 g.switchArea('main');assert.equal(g.tiles[10*256+10],0x5f);assert.equal(g.player.raccoon,true);
});
test('bonus coins stay collected on revisits and its short camera cannot reach the goal',()=>{
 const g=fixture();enterBonus(g);const c=g.collectibles[0];Object.assign(g.player,{x:c.x,y:c.y,vy:0});g.update();assert.equal(c.got,true);const coins=g.coins;g.switchArea('main');g.switchArea('bonus');assert.equal(g.collectibles[0].got,true);assert.equal(g.coins,coins);g.player.x=480;assert.equal(g.camera,192);assert.equal(g.snapshot().goal,null);
});
test('pipe animation freezes when paused and death resets to the main level',()=>{
 const g=fixture();Object.assign(g.player,{x:2264,y:-112,grounded:true});g.update({down:true});g.paused=true;steps(g,30);assert.equal(g.transition.ticks,0);g.paused=false;steps(g,48);g.die();steps(g,56);assert.equal(g.area,'main');assert.equal(g.player.x,24);
});

test('raccoon can fly to the real high pipe and descend into the bonus room',()=>{
 const g=fixture();let support=0;while(support<224&&!g.cell(1712,support))support+=16;
 Object.assign(g.player,{x:1704,y:support-32,h:32,big:true,raccoon:true,powerMeter:60,vx:3.6,grounded:true});
 let phase='fly';for(let i=0;i<420&&g.area==='main';i++){
  if(phase==='fly'&&g.player.x>2230)phase='brake';if(phase==='brake'&&g.player.vx<=.1)phase='land';
  g.update(phase==='fly'?{right:true,run:true,jump:i%10<5}:phase==='brake'?{left:true,run:true}:{down:true});
 }
 assert.equal(g.area,'bonus');assert.equal(g.player.raccoon,true);
});

function fireFixture(){const g=runway();Object.assign(g.player,{big:true,fire:true,h:32,y:176});return g;}
test('flower blocks follow original mushroom-to-flower progression',()=>{
 const g=fixture();g.patch(10,10,0x61,8);g.head(10,10);assert.equal(g.power.kind,'mushroom');g.player.big=true;g.patch(10,10,0x61,8);g.head(10,10);assert.equal(g.power.kind,'flower');Object.assign(g.power,{x:g.player.x,y:g.player.y,emerging:0});g.updatePower();assert.equal(g.player.fire,true);assert.equal(g.player.raccoon,false);
});
test('loose ordinary flower only grows small Mario; Super Mario receives fire',()=>{
 const g=fixture();g.power={kind:'flower',x:24,y:192,emerging:0,vy:0};g.updatePower();assert.equal(g.player.big,true);assert.equal(g.player.fire,false);g.power={kind:'flower',x:24,y:g.player.y,emerging:0,vy:0};g.updatePower();assert.equal(g.player.fire,true);
});
test('Fire Mario fires on Run press edges and supports only two slots',()=>{
 const g=fireFixture();g.update({run:true});steps(g,5,{run:true});assert.equal(g.fireballs.length,1);g.update();g.update({run:true});assert.equal(g.fireballs.length,2);g.update();g.update({run:true});assert.equal(g.fireballs.length,2);assert.equal(g.player.firing,9);
});
test('fireball uses ROM integer speed, downward launch and four-tick gravity',()=>{
 const g=fireFixture();g.throwFireball();const b=g.fireballs[0],x=b.x,y=b.y;g.updateFireballs();assert.equal(b.x,x+3);assert.equal(b.y,y+3);assert.equal(b.vy,3);g.updateFireballs();g.updateFireballs();g.updateFireballs();assert.equal(b.vy,4);
});
test('fireballs bounce at -3 on ground and poof against walls without breaking them',()=>{
 const g=fireFixture();g.fireballs=[{x:50,y:198,vx:3,vy:3,age:0,poof:0}];g.updateFireballs();assert.equal(g.fireballs[0].vy,-3);assert.equal(g.fireballs[0].y,200);
 g.patch(4,12,0x67,2);Object.assign(g.fireballs[0],{x:55,y:192,vx:3,vy:0,poof:0});g.updateFireballs();assert.equal(g.fireballs[0].poof,13);assert.equal(g.map[12*256+4],2);for(let i=0;i<13;i++)g.updateFireballs();assert.equal(g.fireballs.length,0);
});
test('fireballs defeat vulnerable enemies and respect fire immunity',()=>{
 const g=fireFixture(),e=g.enemies[0];Object.assign(e,{kind:1,state:1,x:60,y:192,h:16,vx:0,vy:0});g.fireballs=[{x:52,y:188,vx:3,vy:3,age:0,poof:0}];g.updateFireballs();assert.ok(e.state<0);assert.equal(e.deathStyle,'tumble');assert.equal(g.score,100);assert.equal(g.fireballs[0].poof,13);
 Object.assign(e,{state:1,fireImmune:true});g.fireballs=[{x:52,y:188,vx:3,vy:3,age:0,poof:0}];g.updateFireballs();assert.equal(e.state,1);assert.equal(g.score,100);
});
test('ducking and carrying prevent firing; projectiles freeze on pause',()=>{
 const g=fireFixture();g.update({down:true,run:true});assert.equal(g.fireballs.length,0);g.player.crouched=false;g.player.carrying=0;assert.equal(g.throwFireball(),false);g.player.carrying=-1;g.throwFireball();const b=JSON.stringify(g.fireballs);g.paused=true;steps(g,20);assert.equal(JSON.stringify(g.fireballs),b);
});
test('USA fire damage returns to Super Mario, and leaf replaces fire power',()=>{
 const g=fireFixture();g.hurt();assert.equal(g.player.fire,false);assert.equal(g.player.big,true);assert.equal(g.player.invul,113);g.player.fire=true;g.power={kind:'leaf',x:g.player.x,y:g.player.y,emerging:0,age:0,vy:0};g.updatePower();assert.equal(g.player.raccoon,true);assert.equal(g.player.fire,false);
});
test('a launched fireball reaches and defeats a walking Goomba through normal updates',()=>{
 const g=fireFixture(),e=g.enemies[0];Object.assign(e,{kind:1,state:1,x:120,y:192,h:16,vx:-.65,vy:0});g.update({run:true});steps(g,80);assert.equal(g.score,100);assert.ok(g.events.some(e=>e.type==='fireball-hit'));assert.equal(g.lives,3);
});
test('area changes preserve Fire Mario but clear projectiles; death clears both',()=>{
 const g=fireFixture();g.throwFireball();g.switchArea('bonus');assert.equal(g.player.fire,true);assert.equal(g.fireballs.length,0);g.throwFireball();g.die();assert.equal(g.fireballs.length,0);assert.equal(g.player.fire,false);
});
test('holding Run during a power-up freeze does not queue a delayed shot',()=>{
 const g=fireFixture();g.player.growing=18;steps(g,20,{run:true});assert.equal(g.fireballs.length,0);g.update();g.update({run:true});assert.equal(g.fireballs.length,1);
});

test('ROM object stream distinguishes both red Koopas and preserves their positions',()=>{
 const g=new Game(level),red=g.enemies.filter(e=>e.red);
 assert.deepEqual(red.map(e=>[e.romId,e.x]),[[0x6d,0x24*16],[0x6d,0x83*16]]);
 assert.equal(level.objectProvenance.streamOffset,0xc537);
 assert.ok(red.every(e=>e.vx===-.5));
 g.switchArea('bonus');g.switchArea('main');assert.equal(g.enemies.filter(e=>e.red).length,2);
});
test('red Koopa turns at a ledge while green Koopa walks off',()=>{
 function ledge(red,state=1){const g=fixture();g.map.fill(0);g.patch(8,13,1,1);const e={kind:2,red,x:140,y:176,h:32,vx:.5,vy:0,state,cooldown:0};g.enemies=[e];g.player.x=220;g.player.y=20;return [g,e];}
 const [r,re]=ledge(true),[g,ge]=ledge(false);
 for(let i=0;i<45;i++){r.updateEnemies(0);g.updateEnemies(0);}
 assert.ok(re.vx<0);assert.ok(re.x<142);assert.equal(re.y,176);assert.ok(ge.y>176);
 const [s,se]=ledge(true,3);for(let i=0;i<45;i++)s.updateEnemies(0);assert.ok(se.x>150);assert.ok(se.y>176);
});
test('red shell retains its colour through stomp and wake',()=>{
 const g=fixture(),e=g.enemies.find(e=>e.red);Object.assign(e,{state:1,x:100,y:176,h:32,vx:0,vy:0});
 Object.assign(g.player,{x:100,y:164,vy:3});g.updateEnemies(175);assert.equal(e.state,2);assert.equal(e.red,true);
 e.wake=1;e.cooldown=0;g.player.x=200;g.updateEnemies(0);assert.equal(e.state,1);assert.equal(e.red,true);assert.equal(Math.abs(e.vx),.5);
});

test('ROM plant variants are centered in pipes with distinct height and firing flags',()=>{
 const g=new Game(level),plants=g.enemies.filter(e=>e.kind===3);
 assert.deepEqual(plants.map(e=>[e.romId,e.x,e.maxRise,e.spits,e.h]),[[0xa6,360,33,true,0],[0xa0,1800,25,false,0],[0xa4,1864,25,true,0]]);
});
test('Piranha hides near Mario then rises one pixel per tick and follows its ROM phase timers',()=>{
 const g=fixture(),e=g.enemies.find(e=>e.romId===0xa6);e.state=1;g.player.x=e.x;
 for(let i=0;i<120;i++)g.updatePlant(e);assert.equal(e.plantPhase,0);assert.equal(e.rise,0);
 g.player.x=e.x-100;g.updatePlant(e);assert.equal(e.plantPhase,1);
 for(let i=0;i<33;i++)g.updatePlant(e);assert.equal(e.rise,33);assert.equal(e.plantPhase,2);assert.equal(e.plantTimer,96);
 for(let i=0;i<55;i++)g.updatePlant(e);assert.equal(g.enemyFireballs.length,0);
 g.updatePlant(e);assert.equal(g.enemyFireballs.length,1);assert.equal(e.plantTimer,40);
 for(let i=0;i<40;i++)g.updatePlant(e);assert.equal(e.plantPhase,3);
 for(let i=0;i<33;i++)g.updatePlant(e);assert.equal(e.plantPhase,0);assert.equal(e.h,0);assert.equal(e.plantTimer,96);
});
test('plain green Piranha uses 48 ticks and does not spit',()=>{
 const g=fixture(),e=g.enemies.find(e=>e.romId===0xa0);g.player.x=e.x-100;
 g.updatePlant(e);for(let i=0;i<25;i++)g.updatePlant(e);assert.equal(e.plantTimer,48);assert.equal(e.rise,25);
 for(let i=0;i<48;i++)g.updatePlant(e);assert.equal(e.plantPhase,3);assert.equal(g.enemyFireballs.length,0);
});
test('plant shots use discrete ROM aiming and four hostile slots independent of Mario shots',()=>{
 const g=fixture(),e=g.enemies.find(e=>e.kind===3);e.y=120;
 Object.assign(g.player,{x:e.x-30,y:80});g.spitPlant(e);assert.deepEqual(g.enemyFireballs[0],{x:e.x+3,y:120,vx:-11/16,vy:-11/16});
 Object.assign(g.player,{x:e.x+100,y:180});g.spitPlant(e);assert.equal(g.enemyFireballs[1].vx,14/16);assert.equal(g.enemyFireballs[1].vy,5/16);
 g.spitPlant(e);g.spitPlant(e);g.spitPlant(e);assert.equal(g.enemyFireballs.length,4);g.player.fire=true;assert.equal(g.throwFireball(),true);
});
test('hostile shots move straight, hurt Mario and respect immunity, pause and area reset',()=>{
 const g=fixture();g.player.big=true;g.player.h=32;g.player.y=176;g.enemyFireballs=[{x:30,y:184,vx:0,vy:0}];g.updateEnemyFireballs();assert.equal(g.player.big,false);assert.ok(g.player.invul>0);g.updateEnemyFireballs();assert.equal(g.state,'playing');
 g.enemyFireballs=[{x:100,y:100,vx:11/16,vy:-11/16}];g.updateEnemyFireballs();assert.equal(g.enemyFireballs[0].y,100-11/16);assert.equal(g.enemyFireballs[0].vy,-11/16);
 g.paused=true;const before=JSON.stringify(g.enemyFireballs);steps(g,30);assert.equal(JSON.stringify(g.enemyFireballs),before);g.switchArea('bonus');assert.equal(g.enemyFireballs.length,0);
});
test('Fire Mario can kill an exposed Venus plant while its existing shot stays active',()=>{
 const g=fixture(),e=g.enemies.find(e=>e.romId===0xa6);Object.assign(e,{state:1,rise:33,h:32,y:e.baseY-33});g.spitPlant(e);g.fireballs=[{x:e.x+3,y:e.y+8,vx:0,vy:0,age:0,poof:0}];g.updateFireballs();assert.ok(e.state<0);assert.equal(g.enemyFireballs.length,1);
});

const hills=JSON.parse(fs.readFileSync(new URL('../assets/courses/1-2.json',import.meta.url)));
const plains3=JSON.parse(fs.readFileSync(new URL('../assets/courses/1-3.json',import.meta.url)));
test('new original courses have distinct geometry, correct spawn floors and goals',()=>{
 const a=new Game(hills),b=new Game(plains3);steps(a,30);steps(b,30);
 assert.equal(a.player.y,176);assert.equal(b.player.y,192);assert.equal(a.course,'1-2');assert.equal(b.goal.x,2424);assert.equal(a.goal.x,2680);assert.equal(a.level.music,'athletic');
});
test('Mario walks up and back down the real World 1-2 hills without wall steps',()=>{
 const g=new Game(hills);g.enemies=[];steps(g,120,{right:true});assert.ok(g.player.x>295);assert.ok(g.player.y<120);assert.equal(g.player.grounded,true);
 steps(g,155,{left:true});assert.ok(g.player.x<35);assert.equal(g.player.y,176);assert.equal(g.state,'playing');
});
test('jumping off a hill preserves airborne motion and lands on the original slope',()=>{
 const g=new Game(hills);g.enemies=[];steps(g,85,{right:true});const start=g.player.y;steps(g,8,{jump:true});assert.ok(g.player.y<start-30);assert.equal(g.player.grounded,false);steps(g,65);assert.equal(g.player.grounded,true);assert.ok(Math.abs(g.player.y+g.player.h-g.groundSurface(g.player.x,g.player.y+g.player.h-1,g.player.y+g.player.h+1))<1);
});
test('switching courses preserves campaign score, lives and suit and clears room/projectile state',()=>{
 const g=fixture();Object.assign(g.player,{big:true,raccoon:true,h:32});g.score=1300;g.coins=5;g.lives=2;g.area='bonus';g.fireballs=[{}];g.enemyFireballs=[{}];g.setCourse(hills);
 assert.equal(g.course,'1-2');assert.equal(g.area,'main');assert.equal(g.score,1300);assert.equal(g.coins,5);assert.equal(g.lives,2);assert.equal(g.player.raccoon,true);assert.equal(g.player.y,160);assert.equal(g.fireballs.length+g.enemyFireballs.length,0);
 g.setCourse(plains3,false);assert.equal(g.player.big,false);assert.equal(g.score,0);assert.equal(g.lives,3);
});
test('deaths respawn in the selected course and use its own starting height',()=>{
 const g=new Game(hills);g.die();steps(g,56);assert.equal(g.course,'1-2');assert.equal(g.lives,2);assert.equal(g.player.y,176);
});
test('World 1-3 card clears at its original position instead of the 1-1 goal',()=>{
 const g=new Game(plains3);g.enemies=[];Object.assign(g.player,{x:g.goal.x-5,y:g.goal.y,vy:0,grounded:false});g.update();assert.equal(g.state,'complete');
});
test('new course note blocks bounce Mario and held jump gives a higher bounce',()=>{
 const a=new Game(plains3),b=new Game(plains3);for(const g of [a,b]){g.enemies=[];Object.assign(g.player,{x:480,y:140,vy:4,grounded:false,oldJump:true});}
 a.update({jump:true});b.update();assert.equal(a.player.vy,-9);assert.equal(b.player.vy,-6);assert.ok(a.events.some(e=>e.type==='note-bounce'));
});
test('protected demo traverses the original hills and reaches the 1-2 card',()=>{
 const g=new Game(hills);g.auto=true;for(let i=0;i<3000&&g.state!=='complete';i++)g.update();assert.equal(g.state,'complete');assert.equal(g.lives,3);
});

test('original World 1-2 has three right-output pipe spawners, no unhandled C1 records',()=>{
 const g=new Game(hills);assert.deepEqual(g.spawners.map(s=>[s.romId,s.x,s.y,s.direction]),[[0xc1,400,96,1],[0xc1,688,96,1],[0xc1,2224,112,1]]);assert.equal(hills.unsupportedObjects.length,0);
});
function pipeFixture(){const g=new Game(hills);g.enemies=[];g.spawners=[{x:400,y:96,direction:1,romId:0xc1,timer:96,cycle:0,active:false}];g.player.x=450;g.player.y=20;return g;}
test('pipe activates on screen, waits96 ticks then uses112 ticks and skips every fourth attempt',()=>{
 const g=pipeFixture();for(let i=0;i<95;i++)g.updateSpawners();assert.equal(g.enemies.length,0);g.updateSpawners();assert.equal(g.enemies.length,1);assert.equal(g.spawners[0].timer,112);
 for(let cycle=2;cycle<=5;cycle++){g.enemies=[];for(let i=0;i<112;i++)g.updateSpawners();assert.equal(g.enemies.length,cycle===4?0:1);}
 const off=pipeFixture();off.player.x=24;off.updateSpawners();assert.equal(off.spawners[0].active,false);assert.equal(off.spawners[0].timer,96);
});
test('Goomba pipes only output toward the player and obey five occupied object slots',()=>{
 const g=pipeFixture();g.player.x=350;g.spawners[0].timer=1;g.updateSpawners();assert.equal(g.enemies.length,0);assert.equal(g.spawners[0].cycle,1);
 g.player.x=450;g.spawners[0].timer=1;g.enemies=Array.from({length:5},()=>({kind:1,state:1,x:460}));g.updateSpawners();assert.equal(g.enemies.length,5);assert.equal(g.spawners[0].cycle,2);
 g.enemies[2].state=0;g.spawners[0].timer=1;g.updateSpawners();assert.equal(g.enemies.length,5);assert.equal(g.enemies[2].pipeTicks,40);
});
test('new pipe Goomba matches original position, half-pixel movement and40 collision-free ticks',()=>{
 const g=pipeFixture();g.spawners[0].timer=1;g.updateSpawners();const e=g.enemies[0];assert.deepEqual([e.x,e.y,e.vx,e.vy,e.pipeTicks],[400,93,.5,0,40]);
 for(let i=0;i<40;i++)g.updateEnemies(0);assert.equal(e.x,420);assert.equal(e.y,93);assert.equal(e.pipeTicks,0);
 g.updateEnemies(0);assert.equal(e.x,420.5);assert.ok(e.y>93);assert.ok(e.vy>0);
});
test('spawned Goombas are vulnerable, culled offscreen and do not allocate without limit',()=>{
 const g=pipeFixture();g.spawners[0].timer=1;g.updateSpawners();const e=g.enemies[0];for(let i=0;i<40;i++)g.updateEnemies(0);g.fireballs=[{x:e.x+3,y:e.y+3,vx:0,vy:0,age:0,poof:0}];g.updateFireballs();assert.ok(e.state<0);
 e.state=1;g.player.x=1000;g.updateEnemies(0);assert.equal(e.state,0);
});
test('pause freezes spawners and course restart resets their cadence and spawned enemies',()=>{
 const g=pipeFixture();g.paused=true;const before=JSON.stringify(g.spawners);steps(g,120);assert.equal(JSON.stringify(g.spawners),before);
 g.spawners[0].timer=1;g.updateSpawners();g.restart();assert.equal(g.spawners[0].timer,96);assert.equal(g.enemies.some(e=>e.spawned),false);
});

test('browser pipe spawning matches all8 isolated original-ROM routine traces',()=>{
 const trace=JSON.parse(fs.readFileSync(new URL('../research/goomba-pipe-trace.json',import.meta.url)));
 for(const sample of trace.cases){
  assert.equal(sample.returned,true);const g=pipeFixture();g.player.x=sample.playerX;Object.assign(g.spawners[0],{active:true,timer:0,cycle:sample.count});g.updateSpawners();
  assert.equal(g.spawners[0].timer,sample.timer);assert.equal(g.spawners[0].cycle,sample.nextCount);assert.equal(g.enemies.length,sample.objects.length);
  if(sample.objects.length){const actual=g.enemies[0],original=sample.objects[0];assert.deepEqual([actual.romId,actual.x,actual.y+208,actual.pipeTicks],[original.id,original.x,original.y,original.emerging]);}
 }
});

import {createBoomerang,stepBoomerang} from '../boomerang.js';
test('boomerang fixed-point flight matches all167 original-ROM frames through catch',()=>{
 const trace=JSON.parse(fs.readFileSync(new URL('../research/boomerang-traces.json',import.meta.url))),b=createBoomerang({x:100,y:100,state:1,kind:6,facing:'right'});
 for(const r of trace.flight){stepBoomerang(b,r.t);for(const key of ['x','y','vx','vy','phase','verticalPhase','timer','hold'])assert.equal(b[key],r[key],`frame${r.t} ${key}`);assert.equal((b.fx&15)*16,r.fx);assert.equal((b.fy&15)*16,r.fy);assert.equal(b.dead,!r.id);}
 assert.equal(b.caught,true);
});
test('both original Boomerang Brothers load with native patrol positions and timing',()=>{
 const g=new Game(plains3);g.enemies=g.enemies.filter(e=>e.kind===6).slice(0,1);g.player.x=280;const trace=JSON.parse(fs.readFileSync(new URL('../research/boomerang-traces.json',import.meta.url)));
 assert.equal(plains3.objects.filter(o=>o[0]===6).length,2);
 for(let t=0;t<180;t++){g.frame=t;g.updateEnemies(0);const r=trace.walk.find(r=>r.t===t),e=g.enemies[0];if(r){assert.equal(Math.floor(e.x),r.x);assert.equal(Math.floor(e.y)+208,r.y);assert.equal((e.vx*16+256)%256,r.vx);assert.equal(e.broPhase,r.phase);assert.equal(e.broTimer,r.timer);assert.equal(e.broCounter,r.throwCounter);}}
});
test('brother faces Mario on16-tick cadence and holds a throw for15 ticks',()=>{
 const g=new Game(plains3),e=g.enemies.find(e=>e.kind===6);g.player.x=e.x+80;g.frame=16;g.updateBro(e);assert.equal(e.facing,'right');Object.assign(e,{broPhase:1,broTimer:50,broCounter:31});g.updateBro(e);assert.equal(e.throwPose,15);assert.equal(g.boomerangs.length,1);
 const b=g.boomerangs[0];for(let f=0;f<15;f++)stepBoomerang(b,f);assert.equal(b.hold,0);assert.equal(b.age,0);stepBoomerang(b,15);assert.equal(b.age,1);
});
test('held boomerang disappears when its owner dies; released boomerang continues',()=>{
 const owner={x:100,y:100,kind:6,state:1,facing:'left'},a=createBoomerang(owner),b=createBoomerang(owner);for(let f=0;f<16;f++)stepBoomerang(b,f);owner.state=-14;stepBoomerang(a,16);stepBoomerang(b,16);assert.equal(a.dead,true);assert.equal(b.dead,false);
});
test('boomerangs share a bounded eight-projectile pool and pause and course changes clear correctly',()=>{
 const g=new Game(plains3),e=g.enemies.find(e=>e.kind===6);g.enemyFireballs=Array.from({length:8},()=>({x:0,y:0}));Object.assign(e,{broPhase:1,broCounter:31,broTimer:20});g.updateBro(e);assert.equal(g.boomerangs.length,0);
 g.enemyFireballs=[];e.broCounter=31;g.updateBro(e);assert.equal(g.boomerangs.length,1);g.paused=true;const before=JSON.stringify(g.boomerangs.map(({owner,...b})=>b));steps(g,30);assert.equal(JSON.stringify(g.boomerangs.map(({owner,...b})=>b)),before);g.setCourse(hills);assert.equal(g.boomerangs.length,0);
});
test('a released boomerang damages Mario while invulnerability prevents repeated hits',()=>{
 const g=new Game(plains3),e=g.enemies.find(e=>e.kind===6);Object.assign(g.player,{x:100,y:100,big:true,h:32});const b=createBoomerang(e);Object.assign(b,{hold:0,timer:50,fx:104*16,fy:104*16,vx:0,vy:0});g.boomerangs=[b];g.frame=1;g.updateBoomerangs();assert.equal(g.player.big,false);assert.ok(g.player.invul>0);g.frame=3;g.updateBoomerangs();assert.equal(g.state,'playing');
});
test('Fire Mario can defeat an original brother and cancel its held throw',()=>{
 const g=new Game(plains3),e=g.enemies.find(e=>e.kind===6);g.boomerangs=[createBoomerang(e)];g.fireballs=[{x:e.x+3,y:e.y+8,vx:0,vy:0,age:0,poof:0}];g.updateFireballs();assert.ok(e.state<0);g.updateBoomerangs();assert.equal(g.boomerangs.length,0);
});

test('original nine-byte random-pool rotation drives the brother hop gate',()=>{
 const g=new Game(plains3);g.randomize();assert.deepEqual([...g.randomPool],[0,128,0,0,0,0,0,0,0]);g.randomPool.fill(0);g.randomPool[0]=2;g.randomize();assert.equal(g.randomPool[0],129);
 const e=g.enemies.find(e=>e.kind===6);Object.assign(e,{broPhase:1,broTimer:30,vy:0});g.randomPool[e.broSlot+1]=128;g.frame=256;g.updateBro(e);assert.equal(e.vy,-3);e.vy=0;g.frame=257;g.updateBro(e);assert.equal(e.vy,0);
});

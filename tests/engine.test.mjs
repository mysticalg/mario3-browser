import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game} from '../engine.js';
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
test('running is faster than walking',()=>{const walk=fixture(),run=fixture();steps(walk,20,{right:true});steps(run,20,{right:true,run:true});assert.ok(run.player.x>walk.player.x+10);});
test('pipe sides block movement',()=>{const g=fixture();Object.assign(g.player,{x:338,y:176,vx:2.4});steps(g,8,{right:true});assert.ok(g.player.x<352);});
test('head collision releases a single question-block coin',()=>{const g=fixture();g.patch(10,10,0x63,3);Object.assign(g.player,{x:160,y:176,vy:-4});g.update({jump:true});assert.equal(g.coins,1);assert.equal(g.tiles[2570],0x5f);g.head(10,10);assert.equal(g.coins,1);});
test('small Mario cannot break a brick; Super Mario can',()=>{const g=fixture();g.patch(10,10,0x67,2);g.head(10,10);assert.equal(g.map[2570],2);g.player.big=true;g.head(10,10);assert.equal(g.map[2570],0);assert.equal(g.tiles[2570],0x80);});
test('power block releases and consumes a real mushroom',()=>{const g=fixture();g.patch(10,10,0x61,4);g.head(10,10);assert.equal(g.power.emerging,16);assert.equal(g.tiles[2570],0x5f);Object.assign(g.power,{x:g.player.x,y:g.player.y,emerging:0});g.updatePower();assert.equal(g.player.big,true);assert.equal(g.player.h,32);assert.equal(g.power,null);assert.equal(g.score,1000);});
test('damage shrinks, then immunity prevents a second hit',()=>{const g=fixture();Object.assign(g.player,{big:true,h:32,y:160});g.hurt();assert.equal(g.player.h,16);assert.equal(g.player.big,false);assert.equal(g.state,'playing');g.hurt();assert.equal(g.state,'playing');assert.ok(g.player.invul>0);});
test('one-way platforms allow ascent and catch a descent',()=>{const g=fixture();g.patch(10,10,0x51,5);Object.assign(g.player,{x:160,y:176,vy:-4});g.update({jump:true});assert.ok(g.player.y<176);Object.assign(g.player,{y:130,vy:3,grounded:false});steps(g,12,{jump:true});assert.equal(g.player.y,144);assert.equal(g.player.grounded,true);});
test('stomping Goomba defeats it and bounces Mario',()=>{const g=fixture();const e=g.enemies[0];Object.assign(e,{kind:1,state:1,x:100,y:192,h:16,vx:0,vy:0});Object.assign(g.player,{x:100,y:179,vy:3});g.updateEnemies(191);assert.ok(e.state<0);assert.ok(g.player.vy<0);assert.equal(g.score,100);});
test('Koopa stomp creates a shell that can be kicked',()=>{const g=fixture();const e=g.enemies[0];Object.assign(e,{kind:2,state:1,x:100,y:176,h:32,vx:0,vy:0});Object.assign(g.player,{x:100,y:164,vy:3});g.updateEnemies(175);assert.equal(e.state,2);assert.equal(e.h,16);Object.assign(g.player,{x:90,y:192,vy:0});e.cooldown=0;g.updateEnemies(208);assert.equal(e.state,3);assert.ok(e.vx>0);});
test('collecting a coin updates score and cannot repeat',()=>{const g=fixture();g.collectibles=[{x:24,y:176,got:false}];g.update();assert.equal(g.coins,1);assert.equal(g.score,50);steps(g,5);assert.equal(g.coins,1);});
test('death consumes a life and respawns; final death becomes game over',()=>{const g=fixture();g.hurt();assert.equal(g.state,'dying');steps(g,56);assert.equal(g.lives,2);assert.equal(g.state,'playing');g.lives=1;g.hurt();steps(g,56);assert.equal(g.lives,0);assert.equal(g.state,'gameover');});
test('pits are lethal, including in protected demo',()=>{const g=fixture();g.player.y=270;g.update();assert.equal(g.state,'dying');});
test('pause freezes physics and restart clears the current run',()=>{const g=fixture();g.paused=true;const before=JSON.stringify(g.snapshot());steps(g,10,{right:true});assert.equal(JSON.stringify(g.snapshot()),before);g.score=400;g.lives=1;g.restart(false);assert.equal(g.score,0);assert.equal(g.lives,3);assert.equal(g.paused,false);});
test('complete protected preview reaches the card using original geometry',()=>{const g=new Game(level);g.auto=true;let won=false;for(let i=0;i<4000;i++){g.update();if(g.state==='complete'){won=true;break;}}assert.equal(won,true);assert.equal(g.lives,3);assert.ok(g.score>0);});
test('world boundaries and missing enemies do not produce NaN',()=>{const g=fixture();g.player.x=0;steps(g,30,{left:true});assert.equal(g.player.x,0);assert.ok(Number.isFinite(g.player.y));});
function pad(overrides={}){return {index:0,id:'Test standard controller',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),...overrides};}
test('gamepad maps D-pad, analogue stick, jump and run with deadzone',()=>{const p=pad();p.axes[0]=.15;assert.equal(readGamepad(p).right,false);p.axes[0]=.7;assert.equal(readGamepad(p).right,true);p.buttons[0].pressed=true;p.buttons[2].value=1;assert.equal(readGamepad(p).jump,true);assert.equal(readGamepad(p).run,true);p.axes[0]=0;p.buttons[14].pressed=true;assert.equal(readGamepad(p).left,true);});
test('controller Start and Select are edge-triggered and disconnect releases inputs',()=>{let pads=[pad()];const input=new ControllerInput(()=>pads);input.poll();pads[0].buttons[9].pressed=true;assert.equal(input.poll().edges.start,true);assert.equal(input.poll().edges.start,false);pads[0].buttons[9].pressed=false;input.poll();pads[0].buttons[9].pressed=true;assert.equal(input.poll().edges.start,true);pads[0].buttons[8].pressed=true;assert.equal(input.poll().edges.restart,true);pads=[];assert.equal(input.poll().state,null);});

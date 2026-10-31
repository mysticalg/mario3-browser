// A fixed 60 Hz simulation, with presentation interpolation between ticks.
export const STEP_MS = 1000 / 60;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export class Game {
  constructor(level, onSound = () => {}) {
    this.level = level;
    this.onSound = onSound;
    this.auto = false;
    this.paused = false;
    this.score = 0;
    this.coins = 0;
    this.lives = 3;
    this.frame = 0;
    this.events = [];
    this.reset();
  }
  createEnemies(level) {
    return level.objects.map(([kind,x,y],i)=>{const meta=level.objectMetadata?.[i]||{};return {kind,x,y,baseY:y,vx:kind===2?-.5:-.65,vy:0,state:1,h:[2,5].includes(kind)?32:16,cooldown:0,...meta,...(kind===3&&meta.romId?{x:x+8,h:0,plantPhase:0,plantTimer:0,plantAnim:0,rise:0,maxRise:(meta.romId&2)?33:25,plantRed:!!(meta.romId&2),spits:meta.romId>=0xa4}:{} )};});
  }
  setCourse(level,preserve=true){
    const suit={big:this.player.big,raccoon:this.player.raccoon,fire:this.player.fire};
    this.level=level;this.reset();this.paused=false;if(!preserve)this.auto=false;
    if(preserve){Object.assign(this.player,suit);if(suit.big){this.player.h=32;this.player.y-=16;}}
    else{this.score=0;this.coins=0;this.lives=3;this.frame=0;}
    this.event('course-started');
  }
  get course(){return this.level.id||'1-1';}
  get goal(){return this.level.goal||{x:2680,y:120};}
  reset() {
    this.area='main';this.areaStates=new Map();this.activeLevel=this.level;
    this.map = Uint8Array.from(this.level.solid);
    this.tiles = Uint8Array.from(this.level.tiles);
    this.patches = new Map();
    this.collectibles = this.level.coins.map(([x,y]) => ({x,y,got:false}));
    this.enemies = this.createEnemies(this.level);
    this.player = {x:24,y:192,vx:0,vy:0,h:16,big:false,crouched:false,facing:'right',grounded:true,oldJump:false,invul:0,growing:0,travel:0,coyote:0,jumpBuffer:0,skidding:false};
    Object.assign(this.player,this.level.spawn||{});
    this.state = 'playing';
    this.player.carrying=-1;this.player.runHeld=false;
    Object.assign(this.player,{raccoon:false,fire:false,firing:0,powerMeter:0,flight:0,wag:0,tail:0,oldRun:false});
    this.deathClock = 0;
    this.winClock = 0;
    this.clock = 300;
    this.timeFrames = 0;
    this.autoHold = 0;
    this.power = null;
    this.popup = null;
    this.card = 0;
    this.stompChain=0;
    this.effects = [];
    this.bumps = new Map();
    this.sky=new Map((this.level.sky||[]).map(t=>[`${t.tx},${t.ty}`,{...t}]));this.transition=null;
    this.fireballs=[];this.enemyFireballs=[];
  }
  get areaWidth(){return this.activeLevel.playableWidth||2816;}
  switchArea(name){
    const keys=['map','tiles','patches','collectibles','enemies','power','sky'];
    this.areaStates.set(this.area,Object.fromEntries(keys.map(k=>[k,this[k]])));
    this.area=name;this.activeLevel=name==='bonus'?this.level.bonus:this.level;
    const saved=this.areaStates.get(name);
    if(saved)Object.assign(this,saved);
    else{
      const l=this.activeLevel;this.map=Uint8Array.from(l.solid);this.tiles=Uint8Array.from(l.tiles);this.patches=new Map();
      this.collectibles=l.coins.map(([x,y])=>({x,y,got:false}));this.enemies=this.createEnemies(l);
      this.power=null;this.sky=new Map((l.sky||[]).map(t=>[`${t.tx},${t.ty}`,{...t}]));
    }
    this.effects=[];this.bumps=new Map();this.popup=null;this.fireballs=[];this.enemyFireballs=[];
  }
  tryPipe(input){
    const p=this.player;if(p.carrying>=0)return false;
    for(const pipe of this.activeLevel.pipes||[]){
      if(Math.abs(p.x+8-pipe.x-16)>7)continue;
      const enter=pipe.direction==='down'?input.down&&p.grounded&&Math.abs(p.y+p.h-pipe.y)<3:(input.up||input.jump)&&p.vy<=0&&Math.abs(p.y-pipe.y)<7;
      if(!enter)continue;
      this.state='pipe';this.transition={...pipe,phase:'enter',ticks:0,mouth:pipe.y,clip:pipe.direction==='down'?'above':'below'};
      p.x=pipe.x+8;p.vx=0;p.vy=0;p.flight=0;p.wag=0;p.tail=0;p.crouched=p.big&&p.h===16;
      this.sound('pipe');this.event('pipe-enter');return true;
    }
    return false;
  }
  updatePipe(){
    const t=this.transition,p=this.player;t.ticks++;
    if(t.phase==='enter'){
      p.y+=t.direction==='down'?1.5:-1.5;
      if(t.ticks>=24){
        this.switchArea(t.target);t.phase='exit';t.ticks=0;t.mouth=t.spawnY;t.clip=t.exit==='up'?'above':'below';
        p.x=t.spawnX;p.y=t.exit==='up'?t.spawnY:t.spawnY-p.h;p.vx=0;p.vy=0;p.grounded=false;
        this.event('area-changed');
      }
    }else{
      p.y+=t.exit==='up'?-1.5:1.5;
      if(t.ticks>=24){p.y=t.exit==='up'?t.spawnY-p.h:t.spawnY;p.oldJump=true;p.invul=Math.max(p.invul,30);this.state='playing';this.transition=null;this.event('pipe-exit');}
    }
  }
  restart(auto = this.auto) {
    this.score=0; this.coins=0; this.lives=3; this.frame=0;
    this.auto=auto; this.paused=false; this.reset();
  }
  event(type) { this.events.push({frame:this.frame,type}); if (this.events.length>24) this.events.shift(); }
  sound(name, duration=.09) { this.onSound(name,duration); }
  coin(points=100) {
    this.coins++;this.score+=points;
    if(this.coins>=100){this.coins-=100;this.lives++;this.sound('oneup');this.event('extra-life');}
    else this.sound('coin');
  }
  cell(x,y) {
    if (x<0 || x>=this.areaWidth) return 1;
    if(y<0)return this.sky.get(`${Math.floor(x/16)},${Math.floor(y/16)}`)?.solid||0;
    if (y>=256) return 0;
    return this.map[Math.floor(y/16)*256+Math.floor(x/16)];
  }
  hard(x,y) { const t=this.cell(x,y); return t!==0 && t!==5 && t!==9; }
  slopeSurface(x,y){
    const tx=Math.floor(x/16),ty=Math.floor(y/16),tile=ty<0?this.sky.get(`${tx},${ty}`)?.id:this.tiles[ty*256+tx];
    const shape=this.activeLevel.slopes?.tileShape[tile];
    return shape?ty*16+(this.activeLevel.slopes.profiles[shape][Math.floor(x)&15]&15):null;
  }
  groundSurface(x,previous,current,step=0){
    let result=null;
    for(let ty=Math.floor((previous-step-1)/16);ty<=Math.floor((current+step)/16);ty++){
      for(const sample of [x+3,x+12]){
        const kind=this.cell(sample,ty*16+8);if(!kind)continue;
        const top=kind===9?this.slopeSurface(sample,ty*16+8):ty*16;
        if(top!==null&&previous<=top+step+1&&current>=top&&!(kind===5&&previous>top+1))result=result===null?top:Math.min(result,top);
      }
    }
    return result;
  }
  wall(x,y,h) {
    for (let d=0;d<h;d+=8) if(this.hard(x+2,y+d)||this.hard(x+13,y+d)) return true;
    return this.hard(x+2,y+h-1)||this.hard(x+13,y+h-1);
  }
  moveX(body,amount,h=body.h||16) {
    const next=clamp(body.x+amount,0,this.areaWidth-14);
    if(this.activeLevel.slopes&&body.vy>=0){
      const feet=body.y+h,old=this.groundSurface(body.x,feet-1,feet+1),surface=this.groundSurface(next,feet-6,feet+6,6);
      if(old!==null&&surface!==null&&surface<feet&&!this.wall(next,surface-h,h-6))body.y=surface-h;
    }
    if(!this.wall(next,body.y,h)){body.x=next;return false;}
    let resolved=next;
    for(let ty=Math.floor(body.y/16);ty<=Math.floor((body.y+h-1)/16);ty++){
      for(let tx=Math.floor((next+2)/16);tx<=Math.floor((next+13)/16);tx++){
        if(!this.hard(tx*16+8,ty*16+8))continue;
        if(amount>0)resolved=Math.min(resolved,tx*16-14);
        if(amount<0)resolved=Math.max(resolved,(tx+1)*16-2);
      }
    }
    body.x=clamp(resolved,0,this.areaWidth-14);return true;
  }
  updateEffects(){
    for(const effect of this.effects){effect.x+=effect.vx;effect.y+=effect.vy;effect.vy+=effect.gravity;effect.life--;}
    this.effects=this.effects.filter(effect=>effect.life>0);
    for(const [off,bump] of this.bumps){if(++bump.age>=10)this.bumps.delete(off);}
  }
  floor(x,previous,current,step=0) {
    if(this.activeLevel.slopes){const top=this.groundSurface(x,previous,current,step);if(top===null)return false;this.floorY=top;return true;}
    let a=this.cell(x+2,current), b=this.cell(x+13,current);
    const top=Math.floor(current/16)*16;
    if(previous>top+1) { if(a===5)a=0; if(b===5)b=0; }
    this.floorY=top;return a!==0||b!==0;
  }
  patch(tx,ty,id,kind) {
    if(tx<0||tx>=256||ty<0||ty>=16)return;
    const off=ty*256+tx;
    this.map[off]=kind; this.tiles[off]=id;
    this.patches.set(off,{tx,ty,id});
  }
  pop(x,y,text) { this.popup={x,y,text,ticks:32}; }
  bumpEnemies(tx,ty){
    for(const e of this.enemies){
      if(e.state<=0||e.kind===3||e.x+14<=tx*16||e.x+2>=(tx+1)*16||Math.abs(e.y+e.h-ty*16)>4)continue;
      e.state=-14;e.vy=-3;this.score+=100;this.sound('kick');this.event('block-bumped-enemy');
    }
  }
  head(tx,ty,force=false) {
    if(tx<0||tx>=256||ty<0||ty>=16)return;
    const kind=this.map[ty*256+tx], p=this.player;
    if([2,3,4,6,7,8].includes(kind))this.bumpEnemies(tx,ty);
    if(kind===10){this.bumps.set(ty*256+tx,{age:0});this.sound('bump');return;}
    if(kind===2) {
      if(p.big||force) {
        this.patch(tx,ty,this.activeLevel.emptyTile??0x80,0);this.score+=10;this.pop(tx*16,ty*16,'+10');this.sound('break');this.event('brick-broken');
        for(let q=0;q<4;q++)this.effects.push({kind:'brick',x:tx*16+(q%2)*8,y:ty*16+Math.floor(q/2)*8,vx:q%2?1.5:-1.5,vy:q<2?-4:-2.8,gravity:.2,life:36,q});
      }
      else {this.sound('bump');this.bumps.set(ty*256+tx,{age:0});}
    }
    if([3,4,6,7,8].includes(kind)) {
      this.patch(tx,ty,0x5f,1);
      this.bumps.set(ty*256+tx,{age:0});
      if(kind===4||kind===8) { const item=p.big?(kind===8?'flower':'leaf'):'mushroom';this.sound('appear');this.power={kind:item,x:tx*16,y:ty*16,vy:0,dir:1.1,emerging:16,age:0};this.event(item+'-released'); }
      else if(kind===6) { this.lives++;this.sound('oneup');this.pop(tx*16,ty*16,'1UP'); }
      else {
        this.coin();this.pop(tx*16,ty*16-14,'100');
        this.effects.push({kind:'coin',x:tx*16,y:ty*16-12,vx:0,vy:-2.6,gravity:.12,life:26});
      }

    }
  }
  releaseShell() {
    const p=this.player,e=this.enemies[p.carrying];
    if(e){e.state=3;e.vx=p.facing==='right'?5:-5;e.cooldown=20;e.x=p.x+(p.facing==='right'?15:-15);e.y=p.y+p.h-16;this.sound('kick');this.event('shell-thrown');}
    p.carrying=-1;
  }
  hurt() {
    const p=this.player;
    if(p.invul>0||this.state!=='playing')return;
    if(p.carrying>=0)this.releaseShell();
    if(p.raccoon){p.raccoon=false;p.flight=0;p.wag=0;p.tail=0;p.powerMeter=0;p.invul=113;this.sound('suit-loss');this.event('raccoon-lost');return;}
    if(p.fire){p.fire=false;p.firing=0;p.invul=113;this.sound('suit-loss');this.event('fire-lost');return;}
    if(p.big) { p.big=false;if(p.h===32)p.y+=16;p.h=16;p.crouched=false;p.invul=113;this.sound('shrink');this.event('shrunk'); }
    else this.die();
  }
  die() {
    if(this.state!=='playing')return;
    const p=this.player;
    if(p.carrying>=0)this.releaseShell();
    if(p.big){if(p.h===32)p.y+=16;p.h=16;p.big=false;p.crouched=false;}
    p.raccoon=false;p.fire=false;p.firing=0;p.flight=0;p.tail=0;p.powerMeter=0;this.fireballs=[];this.enemyFireballs=[];
    this.state='dying';this.deathClock=0;p.vy=-5.5;p.vx=0;p.grounded=false;p.skidding=false;p.coyote=0;p.jumpBuffer=0;this.sound('death');this.event('life-lost');
  }
  updatePower() {
    const m=this.power,p=this.player;
    if(!m)return;
    if(m.emerging>0) {m.y--;m.emerging--;}
    else if(m.kind==='leaf'){
      m.age=(m.age||0)+1;m.x+=Math.sin(m.age/16)*1.35;m.y+=.7;
    }else if(m.kind==='flower'){
      const previous=m.y+16;m.vy=Math.min(m.vy+.25,6);let ny=m.y+m.vy;
      if(this.floor(m.x,previous,ny+16)){ny=this.floorY-16;m.vy=0;}m.y=ny;
    }else {
      if(this.moveX(m,m.dir,16))m.dir=-m.dir;
      const previous=m.y+16;
      m.vy=Math.min(m.vy+.25,6);let ny=m.y+m.vy;
      if(this.floor(m.x,previous,ny+16)){ny=this.floorY-16;m.vy=0;}
      m.y=ny;
    }
    if(m.y>264){this.power=null;return;}
    if(p.x+14>m.x+1&&p.x+2<m.x+15&&p.y+p.h>m.y+1&&p.y<m.y+16){
      const wasBig=p.big;
      this.power=null;this.score+=1000;
      if(!p.big){
        p.big=true;
        if(!this.wall(p.x,p.y-16,32)){p.y-=16;p.h=32;}
        else {p.h=16;p.crouched=true;}
        p.growing=18;p.invul=45;
      }
      if(m.kind==='leaf'){p.raccoon=true;p.fire=false;p.growing=18;p.invul=45;}
      if(m.kind==='flower'&&wasBig){p.fire=true;p.raccoon=false;p.flight=0;p.wag=0;p.tail=0;p.growing=18;p.invul=45;}
      this.pop(p.x,p.y,p.fire?'FIRE MARIO!':m.kind==='leaf'?'RACCOON!':'SUPER! +1000');this.sound('powerup');this.event(p.fire?'fire-power':m.kind==='leaf'?'raccoon':'grew');
    }
  }
  throwFireball(){
    const p=this.player;
    if(!p.fire||p.crouched||p.carrying>=0||this.fireballs.length>=2)return false;
    this.fireballs.push({x:p.x+4,y:p.y+4,vx:p.facing==='right'?3:-3,vy:3,age:0,poof:0});p.firing=11;this.sound('fire');this.event('fireball-fired');return true;
  }
  poofFireball(b){if(!b.poof){b.poof=13;b.vx=0;b.vy=0;this.event('fireball-poof');}}
  updateFireballs(){
    for(const b of this.fireballs){
      if(b.poof){b.poof--;if(!b.poof)b.dead=true;continue;}
      b.age++;const nextX=b.x+b.vx;
      if(this.hard(nextX+(b.vx>0?7:0),b.y+4)){this.poofFireball(b);continue;}
      b.x=nextX;const bottom=b.y+8;b.y+=b.vy;
      if(b.age%4===0)b.vy=Math.min(4,b.vy+1);
      if(b.vy>=0){
        const a=this.cell(b.x+1,b.y+8),c=this.cell(b.x+6,b.y+8),top=Math.floor((b.y+8)/16)*16;
        if((a&&a!==5||c&&c!==5||(a===5||c===5)&&bottom<=top+1)&&bottom<=top+5){b.y=top-8;b.vy=-3;this.event('fireball-bounced');}
      }
      if(this.hard(b.x+4,b.y+4)){this.poofFireball(b);continue;}
      for(const e of this.enemies){
        if(e.state<=0||e.h<=0||b.x+8<=e.x+2||b.x>=e.x+14||b.y+8<=e.y||b.y>=e.y+e.h)continue;
        if(e.fireImmune!==true){
          if(e===this.enemies[this.player.carrying])continue;
          e.state=-45;e.deathStyle='tumble';e.vy=-3.25;e.vx=b.vx>0?.75:-.75;this.score+=100;this.pop(e.x,e.y-8,'100');this.sound('kick');this.event('fireball-hit');
        }
        this.poofFireball(b);break;
      }
      if(b.x<this.camera-20||b.x>this.camera+340||b.y>this.cameraY+256||b.y<-400)b.dead=true;
    }
    this.fireballs=this.fireballs.filter(b=>!b.dead);
  }
  spitPlant(e) {
    if(this.enemyFireballs.length>=4)return;
    const p=this.player,close=Math.abs(p.x-e.x)<80;
    this.enemyFireballs.push({x:e.x+3,y:e.y,vx:(p.x<e.x?-1:1)*(close?11:14)/16,vy:(p.y<e.y?-1:1)*(close?11:5)/16});
    this.event('plant-fired');
  }
  updatePlant(e) {
    e.plantAnim++;if(e.plantTimer>0)e.plantTimer--;
    const wait=e.spits?96:48,near=Math.abs(this.player.x-e.x)<=27;
    switch(e.plantPhase){
      case 0:if(e.plantTimer===0&&!near){e.plantPhase=1;e.plantTimer=wait;}break;
      case 1:e.rise=Math.min(e.maxRise,e.rise+1);if(e.rise===e.maxRise){e.plantPhase=2;e.plantTimer=wait;}break;
      case 2:
        if(e.spits&&e.plantTimer===40){e.plantAnim=0;this.spitPlant(e);}
        if(e.plantTimer===0){e.plantPhase=3;e.plantTimer=wait;}break;
      case 3:e.rise=Math.max(0,e.rise-1);if(e.rise===0){e.plantPhase=0;e.plantTimer=wait;}break;
    }
    e.y=e.baseY-e.rise;e.h=Math.min(32,e.rise);
  }
  updateEnemyFireballs() {
    const p=this.player,cam=this.camera;
    for(const b of this.enemyFireballs){
      b.x+=b.vx;b.y+=b.vy;
      if(b.x<cam-32||b.x>cam+352||b.y<this.cameraY-32||b.y>this.cameraY+256)b.dead=true;
      if(!b.dead&&p.x+13>b.x+1&&p.x+3<b.x+7&&p.y+p.h>b.y+1&&p.y<b.y+7)this.hurt();
    }
    this.enemyFireballs=this.enemyFireballs.filter(b=>!b.dead);
  }
  updateEnemies(previousBottom) {
    const p=this.player;
    for(let i=0;i<this.enemies.length;i++){
      const e=this.enemies[i];
      const held=i===p.carrying;
      if(e.state===2&&(held||Math.abs(e.x-p.x)<360)){
        e.wake ??= 255;
        if(e.wake<96||this.frame%(held?4:2)===0)e.wake=Math.max(0,e.wake-1);
        if(e.wake===0){
          if(held)p.carrying=-1;
          if(this.wall(e.x,e.y-16,32)){e.state=-14;this.score+=100;}
          else{e.state=1;e.h=32;e.y-=16;e.vx=p.x<e.x?-.5:.5;e.cooldown=0;}
          this.event('shell-woke');
        }
      }
      if(held&&p.carrying===i){e.x=p.x+(p.facing==='right'?12:-12);e.y=p.y+p.h-18;continue;}
      if(e.state<0){e.state++;if(e.deathStyle==='tumble'){e.x+=e.vx;e.y+=e.vy;e.vy+=.25;}}
      if(e.state<=0||Math.abs(e.x-p.x)>=360)continue;
      if(e.cooldown>0)e.cooldown--;
      if(p.raccoon&&p.tail>4&&e.kind!==3&&e.state>0&&Math.abs(e.x-p.x)<30&&Math.abs(e.y+e.h/2-p.y-p.h/2)<23){e.state=-14;this.score+=100;this.sound('kick');this.event('tail-hit');continue;}
      if(e.kind===3&&e.plantPhase!==undefined){this.updatePlant(e);}
      else if(e.kind===3){
        const phase=(this.frame+i*19)%180;
        let rise=Math.floor(clamp(Math.min(phase-35,145-phase)*1.5,0,32));
        if(Math.abs(p.x-e.x)<25&&rise<3)rise=0;
        e.y=e.baseY-rise;e.h=rise;
      }else{
        const previous=e.y+e.h;
        // PRG004 red Troopa: turn once when floor contact is lost,
        // then apply the reversed velocity twice to undo the step.
        const oldX=e.x,wasSupported=this.floor(e.x,previous-.5,previous+.5);
        if(e.state!==2){
          const wallX=e.x+e.vx+(e.vx>0?13:2),wallY=e.y+e.h/2;
          const tx=Math.floor(wallX/16),ty=Math.floor(wallY/16);
          if(e.state===3&&this.hard(wallX,wallY)&&[2,3,4,6,7,8].includes(this.cell(wallX,wallY))){
            this.head(tx,ty,true);e.vx=-e.vx;this.sound('bump');this.event('shell-block');
          }else if(this.moveX(e,e.vx))e.vx=-e.vx;
        }
        if(e.red&&e.kind===2&&e.state===1&&wasSupported&&!this.floor(e.x,previous-.5,previous+.5)){e.vx=-e.vx;e.x=oldX+e.vx;}
        e.vy=Math.min(e.vy+.3,6);let ny=e.y+e.vy;
        if(e.vy>=0&&this.floor(e.x,previous,ny+e.h)){
          ny=this.floorY-e.h;e.vy=[4,5].includes(e.kind)?-4:0;
        }
        e.y=ny;if(e.y>264)e.state=0;
      }
      if(this.state==='playing'&&e.state>0&&e.h>0&&p.x+13>e.x+2&&p.x+3<e.x+14&&p.y+p.h>e.y+2&&p.y<e.y+e.h){
        if(e.kind===3)this.hurt();
        else if(previousBottom<=e.y+7&&p.vy>0){
          p.y=e.y-p.h;p.vy=p.oldJump?-6.8:-4.7;p.grounded=false;p.coyote=0;const points=[100,200,400,800,1000,2000,4000,8000][Math.min(this.stompChain++,7)];this.score+=points;this.pop(e.x,e.y-10,String(points));this.sound('stomp');
          if(e.kind===4)e.kind=1;
          else if(e.kind===5)e.kind=2;
          else if(e.kind===2){
            if(e.state===1){e.state=2;e.y+=16;e.h=16;e.cooldown=15;e.wake=255;}
            else if(e.state===3){e.state=2;e.cooldown=15;e.wake=255;}
            else{e.state=3;e.vx=5;e.cooldown=15;}
          }else e.state=-14;
          this.event('stomp');
        }else if(e.state===2&&e.cooldown===0&&p.runHeld&&!(p.carrying>=0)){p.carrying=i;e.vx=0;this.event('shell-picked-up');}
        else if(e.state===2&&e.cooldown===0){e.state=3;e.vx=p.x>e.x?-5:5;e.cooldown=15;this.score+=50;this.sound('kick');this.event('shell-kicked');}
        else if(e.cooldown===0&&p.invul===0)this.hurt();
      }
      if(e.state===3)for(const other of this.enemies){
        if(other!==e&&other.state===1&&other.kind!==3&&Math.abs(e.x-other.x)<15&&Math.abs(e.y+8-other.y-other.h/2)<20){other.state=-14;this.score+=100;this.sound('kick');this.event('shell-hit');}
      }
    }
  }
  automaticInput() {
    const p=this.player;
    const input={left:false,right:true,jump:false,run:true};
    if(this.state!=='playing'){input.right=false;return input;}
    p.invul=Math.max(p.invul,2); // Protected demonstration only; manual play has normal damage.
    if(p.growing>0){input.right=false;return input;}
    if(this.autoHold>0){this.autoHold--;input.jump=true;}
    if(p.grounded&&this.autoHold===0&&!p.oldJump){
      let need=this.hard(p.x+34,p.y+p.h-4)||this.hard(p.x+34,p.y+p.h-20);
      const gap=this.cell(p.x+32,p.y+p.h+4)===0&&this.cell(p.x+32,p.y+p.h+20)===0;
      for(let up=16;up<=64;up+=16)if([5,10].includes(this.cell(p.x+34,p.y+p.h-up)))need=true;
      for(const e of this.enemies)if(e.state>0&&e.kind!==3&&e.x>p.x&&e.x-p.x<60)need=true;
      if(this.cell(p.x+12,p.y-36)===4||p.x>this.goal.x-55)need=true;
      if(need||gap){this.autoHold=15;input.jump=true;}
    }
    const m=this.power;
    if(m&&!p.big&&Math.abs(m.x-p.x)<100){
      if(m.x<p.x-5){input.left=true;input.right=false;}
      if(Math.abs(m.x-p.x)<8){input.left=false;input.right=false;}
      if(m.y<p.y&&p.grounded){this.autoHold=12;input.jump=true;}
    }
    if(p.grounded&&this.enemies.some(e=>e.kind===3&&e.x>p.x+10&&e.x-p.x<75&&e.h>1)){
      input.right=false;input.left=false;input.jump=false;this.autoHold=0;
    }
    // Brake before landing in a pit after jumping from a high platform.
    if(!p.grounded&&p.vy>0&&p.y+p.h<208&&this.cell(p.x+8,212)!==0){
      const distance=208-p.y-p.h;
      const landingTicks=(Math.sqrt(p.vy*p.vy+.6*distance)-p.vy)/.3;
      const landingX=p.x+p.vx*landingTicks;
      if(this.cell(landingX+8,212)===0){input.right=false;input.left=p.vx>0;}
    }
    return input;
  }
  update(input={}) {
    if(this.paused)return;
    const controls=this.auto?this.automaticInput():input;
    const {left=false,right=false,jump=false,run=false,down=false}=controls;
    const p=this.player;this.frame++;
    if(this.state==='pipe'){this.updatePipe();return;}
    this.updateEffects();
    if(this.popup&&--this.popup.ticks<=0)this.popup=null;
    else if(this.popup)this.popup.y-=.35;
    if(p.invul>0)p.invul--;
    if(p.growing>0)p.growing--;
    if(this.state==='complete'){
      if(++this.winClock>130&&this.auto)this.restart(true);return;
    }
    if(this.state==='gameover'){
      if(++this.deathClock>130&&this.auto)this.restart(true);return;
    }
    if(this.state==='dying'){
      this.deathClock++;p.vy+=.32;p.y+=p.vy;
      if(this.deathClock>55){this.lives--;if(this.lives>0)this.reset();else{this.state='gameover';this.deathClock=0;this.sound('gameover');}}
      return;
    }
    if(++this.timeFrames>=60){this.timeFrames=0;this.clock--;}
    if(this.clock<=0){this.die();return;}
    if(p.growing>0){p.oldRun=run;p.oldJump=jump;return;}
    this.updateFireballs();if(p.firing>0)p.firing--;
    const jumpPressed=jump&&!p.oldJump;
    if(p.tail>0)p.tail--;
    if(p.wag>0)p.wag--;
    if(p.flight>0){p.flight--;if(p.flight===0){p.powerMeter=0;this.event('flight-ended');}}
    if(p.raccoon&&run&&!p.oldRun&&p.carrying<0&&!down){p.tail=18;this.sound('tail');this.event('tail-swipe');}
    if(p.fire&&run&&!p.oldRun&&!down)this.throwFireball();
    if(p.raccoon&&p.tail===10)this.head(Math.floor((p.x+8+(p.facing==='right'?24:-24))/16),Math.floor((p.y+p.h-8)/16));
    p.oldRun=run;
    p.runHeld=run;
    if(p.carrying>=0&&!run)this.releaseShell();
    if(p.big){
      if(down&&p.h===32){p.y+=16;p.h=16;p.crouched=true;}
      if(!down&&p.h===16&&!this.wall(p.x,p.y-16,32)){p.y-=16;p.h=32;p.crouched=false;}
    }
    const speed=p.crouched?0:run?3.6:2.4;
    const direction=Number(right)-Number(left);
    p.skidding=p.grounded&&direction!==0&&p.vx*direction<-.35;
    const acceleration=p.skidding?.34:.2;
    if(direction<0&&!p.crouched){p.vx=Math.max(p.vx-acceleration,-speed);p.facing='left';}
    if(direction>0&&!p.crouched){p.vx=Math.min(p.vx+acceleration,speed);p.facing='right';}
    if((direction===0||p.crouched)&&p.grounded)p.vx=Math.sign(p.vx)*Math.max(0,Math.abs(p.vx)-.16);
    if(Math.abs(p.vx)<.08)p.vx=0;
    if(p.grounded){
      p.flight=0;
      if(run&&Math.abs(p.vx)>=3.2&&!p.crouched)p.powerMeter=Math.min(60,p.powerMeter+1);
      else p.powerMeter=Math.max(0,p.powerMeter-2);
    }else if(p.flight===0)p.powerMeter=Math.max(0,p.powerMeter-.12);
    p.coyote=p.grounded?5:Math.max(0,p.coyote-1);
    p.jumpBuffer=jump&&!p.oldJump?6:Math.max(0,p.jumpBuffer-1);
    if(p.jumpBuffer>0&&(p.grounded||p.coyote>0)){
      if(p.raccoon&&p.powerMeter>=60){p.flight=256;p.wag=16;this.event('flight-started');}
      p.vy=-(6.2+Math.min(Math.abs(p.vx),3.6)*.16);p.grounded=false;p.coyote=0;p.jumpBuffer=0;this.sound(p.big?'jump-big':'jump');
    }
    if(!jump&&p.vy<-3)p.vy=-3;
    if(p.raccoon&&!p.grounded&&jumpPressed){p.wag=16;if(p.flight>0)p.vy=Math.min(p.vy,-2.7);this.sound('tail');}
    if(p.raccoon&&p.wag>0){if(p.flight>0)p.vy=Math.min(p.vy,-2.7);else if(p.vy>1)p.vy=1;}
    p.oldJump=jump;
    if(this.moveX(p,p.vx))p.vx=0;
    p.x=clamp(p.x,0,this.areaWidth-36);
    const previousBottom=p.y+p.h,wasGrounded=p.grounded;
    p.vy=Math.min(p.vy+.3,7);let ny=p.y+p.vy;p.grounded=false;
    if(p.vy>=0&&this.floor(p.x,previousBottom,ny+p.h+(this.activeLevel.slopes&&wasGrounded?6:0),this.activeLevel.slopes&&wasGrounded?6:0)){ny=this.floorY-p.h;p.vy=0;p.grounded=true;this.stompChain=0;}
    if(p.vy<0&&(this.hard(p.x+2,ny)||this.hard(p.x+13,ny))){
      const ty=Math.floor(ny/16);let tx=Math.floor((p.x+8)/16);
      if(!this.hard(tx*16+8,ny)){tx=Math.floor((p.x+2)/16);if(!this.hard(tx*16+8,ny))tx=Math.floor((p.x+13)/16);}
      ny=(ty+1)*16;p.vy=0;this.head(tx,ty);
    }
    p.y=ny;
    if(p.grounded){const tx=Math.floor((p.x+8)/16),ty=Math.floor((p.y+p.h+1)/16);if(this.cell(p.x+8,p.y+p.h+1)===10){p.vy=jump?-9:-6;p.grounded=false;p.coyote=0;this.bumps.set(ty*256+tx,{age:0});this.sound('bump');this.event('note-bounce');}}
    if(p.y<-320){p.y=-320;p.vy=Math.max(0,p.vy);}
    if(this.tryPipe(controls))return;
    if(p.y>264){this.die();return;}
    for(const c of this.collectibles)if(!c.got&&Math.abs(p.x+8-c.x-8)<13&&p.y<c.y+16&&p.y+p.h>c.y){c.got=true;this.coin(50);this.event('coin');}
    this.updatePower();this.updateEnemies(previousBottom);this.updateEnemyFireballs();p.travel+=Math.abs(p.vx);
    if(this.area==='main'&&p.x+14>this.goal.x-8&&p.x<this.goal.x+24&&p.y<this.goal.y+32&&p.y+p.h>this.goal.y-8){
      this.state='complete';this.winClock=0;this.card=Math.floor(this.frame/8)%3;this.score+=this.clock*10;this.sound('clear');this.event('course-clear');
    }
  }
  get camera() { return clamp(this.player.x-104,0,Math.max(0,this.areaWidth-320)); }
  get cameraY() { return this.area==='bonus'?0:clamp(this.player.y-64,-384,0); }
  snapshot() {
    const p=this.player,cam=this.camera;
    const near=entity=>entity.x>=cam-20&&entity.x<cam+340;
    return {
      coordinates:'World pixels; origin top-left; x right, y down. View 320x256, terrain ends at y224.',
      state:this.state,area:this.area,transition:this.transition,paused:this.paused,protectedDemo:this.auto,frame:this.frame,camera:cam,cameraY:this.cameraY,
      player:{...p},score:this.score,coins:this.coins,lives:this.lives,time:this.clock,
      enemies:this.enemies.filter(e=>e.state!==0&&near(e)).map(e=>({...e})),
      coinsVisible:this.collectibles.filter(c=>!c.got&&near(c)),power:this.power,
      course:this.course,goal:this.area==='main'?this.goal:null,pipes:this.activeLevel.pipes||[],fireballs:this.fireballs.map(b=>({...b})),enemyFireballs:this.enemyFireballs.map(b=>({...b})),effects:this.effects.map(e=>({...e})),events:this.events.slice(-5)
    };
  }
}

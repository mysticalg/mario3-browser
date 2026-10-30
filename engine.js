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
  reset() {
    this.map = Uint8Array.from(this.level.solid);
    this.tiles = Uint8Array.from(this.level.tiles);
    this.patches = new Map();
    this.collectibles = this.level.coins.map(([x,y]) => ({x,y,got:false}));
    this.enemies = this.level.objects.map(([kind,x,y]) => ({kind,x,y,baseY:y,vx:-.65,vy:0,state:1,h:[2,5].includes(kind)?32:16,cooldown:0}));
    this.player = {x:24,y:192,vx:0,vy:0,h:16,big:false,crouched:false,facing:'right',grounded:true,oldJump:false,invul:0,growing:0,travel:0,coyote:0,jumpBuffer:0,skidding:false};
    this.state = 'playing';
    this.player.carrying=-1;this.player.runHeld=false;
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
    if (x<0 || x>=2816) return 1;
    if (y<0 || y>=256) return 0;
    return this.map[Math.floor(y/16)*256+Math.floor(x/16)];
  }
  hard(x,y) { const t=this.cell(x,y); return t!==0 && t!==5; }
  wall(x,y,h) {
    for (let d=0;d<h;d+=8) if(this.hard(x+2,y+d)||this.hard(x+13,y+d)) return true;
    return this.hard(x+2,y+h-1)||this.hard(x+13,y+h-1);
  }
  moveX(body,amount,h=body.h||16) {
    const next=clamp(body.x+amount,0,2802);
    if(!this.wall(next,body.y,h)){body.x=next;return false;}
    let resolved=next;
    for(let ty=Math.floor(body.y/16);ty<=Math.floor((body.y+h-1)/16);ty++){
      for(let tx=Math.floor((next+2)/16);tx<=Math.floor((next+13)/16);tx++){
        if(!this.hard(tx*16+8,ty*16+8))continue;
        if(amount>0)resolved=Math.min(resolved,tx*16-14);
        if(amount<0)resolved=Math.max(resolved,(tx+1)*16-2);
      }
    }
    body.x=clamp(resolved,0,2802);return true;
  }
  updateEffects(){
    for(const effect of this.effects){effect.x+=effect.vx;effect.y+=effect.vy;effect.vy+=effect.gravity;effect.life--;}
    this.effects=this.effects.filter(effect=>effect.life>0);
    for(const [off,bump] of this.bumps){if(++bump.age>=10)this.bumps.delete(off);}
  }
  floor(x,previous,current) {
    let a=this.cell(x+2,current), b=this.cell(x+13,current);
    const top=Math.floor(current/16)*16;
    if(previous>top+1) { if(a===5)a=0; if(b===5)b=0; }
    return a!==0||b!==0;
  }
  patch(tx,ty,id,kind) {
    if(tx<0||tx>=256||ty<0||ty>=16)return;
    const off=ty*256+tx;
    this.map[off]=kind; this.tiles[off]=id;
    this.patches.set(off,{tx,ty,id});
  }
  pop(x,y,text) { this.popup={x,y,text,ticks:32}; }
  head(tx,ty) {
    if(tx<0||tx>=256||ty<0||ty>=16)return;
    const kind=this.map[ty*256+tx], p=this.player;
    if(kind===2) {
      if(p.big) {
        this.patch(tx,ty,0x80,0);this.score+=10;this.pop(tx*16,ty*16,'+10');this.sound('break');this.event('brick-broken');
        for(let q=0;q<4;q++)this.effects.push({kind:'brick',x:tx*16+(q%2)*8,y:ty*16+Math.floor(q/2)*8,vx:q%2?1.5:-1.5,vy:q<2?-4:-2.8,gravity:.2,life:36,q});
      }
      else {this.sound('bump');this.bumps.set(ty*256+tx,{age:0});}
    }
    if([3,4,6,7].includes(kind)) {
      this.patch(tx,ty,0x5f,1);
      this.bumps.set(ty*256+tx,{age:0});
      if(kind===4) { this.sound('appear');this.power={x:tx*16,y:ty*16,vy:0,dir:1.1,emerging:16};this.event('mushroom-released'); }
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
    if(p.big) { p.big=false;if(p.h===32)p.y+=16;p.h=16;p.crouched=false;p.invul=90;this.sound('shrink');this.event('shrunk'); }
    else this.die();
  }
  die() {
    if(this.state!=='playing')return;
    const p=this.player;
    if(p.carrying>=0)this.releaseShell();
    if(p.big){if(p.h===32)p.y+=16;p.h=16;p.big=false;p.crouched=false;}
    this.state='dying';this.deathClock=0;p.vy=-5.5;p.vx=0;p.grounded=false;p.skidding=false;p.coyote=0;p.jumpBuffer=0;this.sound('death');this.event('life-lost');
  }
  updatePower() {
    const m=this.power,p=this.player;
    if(!m)return;
    if(m.emerging>0) {m.y--;m.emerging--;}
    else {
      if(this.moveX(m,m.dir,16))m.dir=-m.dir;
      const previous=m.y+16;
      m.vy=Math.min(m.vy+.25,6);let ny=m.y+m.vy;
      if(this.floor(m.x,previous,ny+16)){ny=Math.floor((ny+16)/16)*16-16;m.vy=0;}
      m.y=ny;
    }
    if(m.y>264){this.power=null;return;}
    if(p.x+14>m.x+1&&p.x+2<m.x+15&&p.y+p.h>m.y+1&&p.y<m.y+16){
      this.power=null;this.score+=1000;
      if(!p.big){
        p.big=true;
        if(!this.wall(p.x,p.y-16,32)){p.y-=16;p.h=32;}
        else {p.h=16;p.crouched=true;}
        p.growing=18;p.invul=45;
      }
      this.pop(p.x,p.y,'SUPER! +1000');this.sound('powerup');this.event('grew');
    }
  }
  updateEnemies(previousBottom) {
    const p=this.player;
    for(let i=0;i<this.enemies.length;i++){
      const e=this.enemies[i];
      if(i===p.carrying){e.x=p.x+(p.facing==='right'?12:-12);e.y=p.y+p.h-18;continue;}
      if(e.state<0)e.state++;
      if(e.state<=0||Math.abs(e.x-p.x)>=360)continue;
      if(e.cooldown>0)e.cooldown--;
      if(e.kind===3){
        const phase=(this.frame+i*19)%180;
        let rise=Math.floor(clamp(Math.min(phase-35,145-phase)*1.5,0,32));
        if(Math.abs(p.x-e.x)<25&&rise<3)rise=0;
        e.y=e.baseY-rise;e.h=rise;
      }else{
        const previous=e.y+e.h;
        if(e.state!==2&&this.moveX(e,e.vx))e.vx=-e.vx;
        e.vy=Math.min(e.vy+.3,6);let ny=e.y+e.vy;
        if(e.vy>=0&&this.floor(e.x,previous,ny+e.h)){
          ny=Math.floor((ny+e.h)/16)*16-e.h;e.vy=[4,5].includes(e.kind)?-4:0;
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
            if(e.state===1){e.state=2;e.y+=16;e.h=16;e.cooldown=15;}
            else if(e.state===3){e.state=2;e.cooldown=15;}
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
    if(p.grounded&&this.autoHold===0){
      let need=this.hard(p.x+34,p.y+p.h-4)||this.hard(p.x+34,p.y+p.h-20);
      const gap=this.cell(p.x+32,p.y+p.h+4)===0&&this.cell(p.x+32,p.y+p.h+20)===0;
      for(let up=16;up<=64;up+=16)if(this.cell(p.x+34,p.y+p.h-up)===5)need=true;
      for(const e of this.enemies)if(e.state>0&&e.kind!==3&&e.x>p.x&&e.x-p.x<60)need=true;
      if(this.cell(p.x+12,p.y-36)===4||p.x>2625)need=true;
      if(need||gap){this.autoHold=15;input.jump=true;}
    }
    const m=this.power;
    if(m&&!p.big&&Math.abs(m.x-p.x)<100){
      if(m.x<p.x-5){input.left=true;input.right=false;}
      if(Math.abs(m.x-p.x)<8){input.left=false;input.right=false;}
      if(m.y<p.y&&p.grounded){this.autoHold=12;input.jump=true;}
    }
    if(this.enemies.some(e=>e.kind===3&&e.x>p.x+10&&e.x-p.x<75&&e.h>1)){
      input.right=false;input.left=false;input.jump=false;this.autoHold=0;
    }
    // Brake before landing in a pit after jumping from a high platform.
    if(!p.grounded&&p.vy>0&&p.y+p.h<208&&this.cell(p.x+8,212)!==0){
      const distance=208-p.y-p.h;
      const landingTicks=(Math.sqrt(p.vy*p.vy+.6*distance)-p.vy)/.3;
      const landingX=p.x+p.vx*landingTicks;
      if(this.cell(landingX+8,212)===0)input.right=false;
    }
    return input;
  }
  update(input={}) {
    if(this.paused)return;
    const controls=this.auto?this.automaticInput():input;
    const {left=false,right=false,jump=false,run=false,down=false}=controls;
    const p=this.player;this.frame++;
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
    if(p.growing>0)return;
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
    p.coyote=p.grounded?5:Math.max(0,p.coyote-1);
    p.jumpBuffer=jump&&!p.oldJump?6:Math.max(0,p.jumpBuffer-1);
    if(p.jumpBuffer>0&&(p.grounded||p.coyote>0)){
      p.vy=-(6.2+Math.min(Math.abs(p.vx),3.6)*.16);p.grounded=false;p.coyote=0;p.jumpBuffer=0;this.sound(p.big?'jump-big':'jump');
    }
    if(!jump&&p.vy<-3)p.vy=-3;
    p.oldJump=jump;
    if(this.moveX(p,p.vx))p.vx=0;
    p.x=clamp(p.x,0,2780);
    const previousBottom=p.y+p.h;
    p.vy=Math.min(p.vy+.3,7);let ny=p.y+p.vy;p.grounded=false;
    if(p.vy>=0&&this.floor(p.x,previousBottom,ny+p.h)){ny=Math.floor((ny+p.h)/16)*16-p.h;p.vy=0;p.grounded=true;this.stompChain=0;}
    if(p.vy<0&&(this.hard(p.x+2,ny)||this.hard(p.x+13,ny))){
      const ty=Math.floor(ny/16);let tx=Math.floor((p.x+8)/16);
      if(!this.hard(tx*16+8,ny)){tx=Math.floor((p.x+2)/16);if(!this.hard(tx*16+8,ny))tx=Math.floor((p.x+13)/16);}
      ny=(ty+1)*16;p.vy=0;this.head(tx,ty);
    }
    p.y=ny;
    if(p.y>264){this.die();return;}
    for(const c of this.collectibles)if(!c.got&&Math.abs(p.x+8-c.x-8)<13&&p.y<c.y+16&&p.y+p.h>c.y){c.got=true;this.coin(50);this.event('coin');}
    this.updatePower();this.updateEnemies(previousBottom);p.travel+=Math.abs(p.vx);
    if(p.x+14>2672&&p.x<2704&&p.y<152&&p.y+p.h>112){
      this.state='complete';this.winClock=0;this.card=Math.floor(this.frame/8)%3;this.score+=this.clock*10;this.sound('clear');this.event('course-clear');
    }
  }
  get camera() { return clamp(this.player.x-104,0,2496); }
  snapshot() {
    const p=this.player,cam=this.camera;
    const near=entity=>entity.x>=cam-20&&entity.x<cam+340;
    return {
      coordinates:'World pixels; origin top-left; x right, y down. View 320x256, terrain ends at y224.',
      state:this.state,paused:this.paused,protectedDemo:this.auto,frame:this.frame,camera:cam,
      player:{...p},score:this.score,coins:this.coins,lives:this.lives,time:this.clock,
      enemies:this.enemies.filter(e=>e.state!==0&&near(e)).map(e=>({...e})),
      coinsVisible:this.collectibles.filter(c=>!c.got&&near(c)),power:this.power,
      goal:{x:2680,y:120},effects:this.effects.map(e=>({...e})),events:this.events.slice(-5)
    };
  }
}

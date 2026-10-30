// Fixed 30 ms simulation ticks, matching the native RISC OS prototype.
export const STEP_MS = 30;
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
    this.player = {x:24,y:176,vx:0,vy:0,h:16,big:false,facing:'right',grounded:false,oldJump:false,invul:0,growing:0,travel:0};
    this.state = 'playing';
    this.deathClock = 0;
    this.winClock = 0;
    this.clock = 300;
    this.timeFrames = 0;
    this.autoHold = 0;
    this.power = null;
    this.popup = null;
    this.card = 0;
  }
  restart(auto = this.auto) {
    this.score=0; this.coins=0; this.lives=3; this.frame=0;
    this.auto=auto; this.paused=false; this.reset();
  }
  event(type) { this.events.push({frame:this.frame,type}); if (this.events.length>24) this.events.shift(); }
  sound(note, duration=.09) { this.onSound(note,duration); }
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
      if(p.big) { this.patch(tx,ty,0x80,0);this.score+=10;this.pop(tx*16,ty*16,'+10');this.sound(80);this.event('brick-broken'); }
      else this.sound(64);
    }
    if([3,4,6,7].includes(kind)) {
      this.patch(tx,ty,0x5f,1);
      if(kind===4) { this.power={x:tx*16,y:ty*16,vy:0,dir:1.1,emerging:16};this.event('mushroom-released'); }
      else if(kind===6) { this.lives++;this.pop(tx*16,ty*16,'1UP'); }
      else { this.coins++;this.score+=100;this.pop(tx*16,ty*16,'100'); }
      this.sound(188);
    }
  }
  hurt() {
    const p=this.player;
    if(p.invul>0||this.state!=='playing')return;
    if(p.big) { p.big=false;p.y+=16;p.h=16;p.invul=90;this.sound(76,.18);this.event('shrunk'); }
    else this.die();
  }
  die() {
    if(this.state!=='playing')return;
    this.state='dying';this.deathClock=0;this.player.vy=-5.5;this.player.vx=0;this.sound(72,.25);this.event('life-lost');
  }
  updatePower() {
    const m=this.power,p=this.player;
    if(!m)return;
    if(m.emerging>0) {m.y--;m.emerging--;}
    else {
      let nx=m.x+m.dir;
      if(this.wall(nx,m.y,16)){m.dir=-m.dir;nx=m.x+m.dir;}
      m.x=nx;const previous=m.y+16;
      m.vy=Math.min(m.vy+.25,6);let ny=m.y+m.vy;
      if(this.floor(m.x,previous,ny+16)){ny=Math.floor((ny+16)/16)*16-16;m.vy=0;}
      m.y=ny;
    }
    if(m.y>264){this.power=null;return;}
    if(p.x+14>m.x+1&&p.x+2<m.x+15&&p.y+p.h>m.y+1&&p.y<m.y+16){
      this.power=null;this.score+=1000;
      if(!p.big){p.big=true;p.y-=16;p.h=32;p.growing=18;p.invul=45;}
      this.pop(p.x,p.y,'SUPER! +1000');this.sound(220,.2);this.event('grew');
    }
  }
  updateEnemies(previousBottom) {
    const p=this.player;
    for(let i=0;i<this.enemies.length;i++){
      const e=this.enemies[i];
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
        let nx=e.state===2?e.x:e.x+e.vx;
        if(this.wall(nx,e.y,e.h)){e.vx=-e.vx;nx=e.x+e.vx;}
        e.x=nx;e.vy=Math.min(e.vy+.3,6);let ny=e.y+e.vy;
        if(e.vy>=0&&this.floor(e.x,previous,ny+e.h)){
          ny=Math.floor((ny+e.h)/16)*16-e.h;e.vy=[4,5].includes(e.kind)?-4:0;
        }
        e.y=ny;if(e.y>264)e.state=0;
      }
      if(e.state>0&&e.h>0&&p.x+13>e.x+2&&p.x+3<e.x+14&&p.y+p.h>e.y+2&&p.y<e.y+e.h){
        if(e.kind===3)this.hurt();
        else if(previousBottom<=e.y+7&&p.vy>0){
          p.y=e.y-p.h;p.vy=-4.7;p.grounded=false;this.score+=100;this.pop(e.x,e.y-10,'100');this.sound(112);
          if(e.kind===4)e.kind=1;
          else if(e.kind===5)e.kind=2;
          else if(e.kind===2){
            if(e.state===1){e.state=2;e.y+=16;e.h=16;e.cooldown=15;}
            else if(e.state===3){e.state=2;e.cooldown=15;}
            else{e.state=3;e.vx=5;e.cooldown=15;}
          }else e.state=-14;
          this.event('stomp');
        }else if(e.state===2&&e.cooldown===0){e.state=3;e.vx=p.x>e.x?-5:5;e.cooldown=15;this.score+=50;this.event('shell-kicked');}
        else if(e.cooldown===0&&p.invul===0)this.hurt();
      }
      if(e.state===3)for(const other of this.enemies){
        if(other!==e&&other.state===1&&other.kind!==3&&Math.abs(e.x-other.x)<15&&Math.abs(e.y+8-other.y-other.h/2)<20){other.state=-14;this.score+=100;this.event('shell-hit');}
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
    return input;
  }
  update(input={}) {
    if(this.paused)return;
    const controls=this.auto?this.automaticInput():input;
    const {left=false,right=false,jump=false,run=false}=controls;
    const p=this.player;this.frame++;
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
      if(this.deathClock>55){this.lives--;if(this.lives>0)this.reset();else{this.state='gameover';this.deathClock=0;}}
      return;
    }
    if(++this.timeFrames>=33){this.timeFrames=0;this.clock--;}
    if(this.clock<=0){this.die();return;}
    if(p.growing>0)return;
    const speed=run?3.6:2.4;
    if(left){p.vx=Math.max(p.vx-.3,-speed);p.facing='left';}
    if(right){p.vx=Math.min(p.vx+.3,speed);p.facing='right';}
    if(!left&&!right)p.vx*=.78;
    if(Math.abs(p.vx)<.08)p.vx=0;
    if(p.grounded&&jump&&!p.oldJump){p.vy=-6.6;p.grounded=false;this.sound(146);}
    if(!jump&&p.vy<-3)p.vy=-3;
    p.oldJump=jump;
    const nx=clamp(p.x+p.vx,0,2780);
    if(this.wall(nx,p.y,p.h))p.vx=0;else p.x=nx;
    const previousBottom=p.y+p.h;
    p.vy=Math.min(p.vy+.3,7);let ny=p.y+p.vy;p.grounded=false;
    if(p.vy>=0&&this.floor(p.x,previousBottom,ny+p.h)){ny=Math.floor((ny+p.h)/16)*16-p.h;p.vy=0;p.grounded=true;}
    if(p.vy<0&&(this.hard(p.x+2,ny)||this.hard(p.x+13,ny))){
      const ty=Math.floor(ny/16);let tx=Math.floor((p.x+8)/16);
      if(!this.hard(tx*16+8,ny)){tx=Math.floor((p.x+2)/16);if(!this.hard(tx*16+8,ny))tx=Math.floor((p.x+13)/16);}
      ny=(ty+1)*16;p.vy=0;this.head(tx,ty);
    }
    p.y=ny;
    if(p.y>264){this.die();return;}
    for(const c of this.collectibles)if(!c.got&&Math.abs(p.x+8-c.x-8)<13&&p.y<c.y+16&&p.y+p.h>c.y){c.got=true;this.coins++;this.score+=50;this.sound(196);this.event('coin');}
    this.updatePower();this.updateEnemies(previousBottom);p.travel+=Math.abs(p.vx);
    if(p.x+14>2672&&p.x<2704&&p.y<152&&p.y+p.h>112){
      this.state='complete';this.winClock=0;this.card=Math.floor(this.frame/8)%3;this.score+=this.clock*10;this.sound(210,.25);this.event('course-clear');
    }
  }
  get camera() { return Math.floor(clamp(this.player.x-104,0,2496)/4)*4; }
  snapshot() {
    const p=this.player,cam=this.camera;
    const near=entity=>entity.x>=cam-20&&entity.x<cam+340;
    return {
      coordinates:'World pixels; origin top-left; x right, y down. View 320x256, terrain ends at y224.',
      state:this.state,paused:this.paused,protectedDemo:this.auto,frame:this.frame,camera:cam,
      player:{...p},score:this.score,coins:this.coins,lives:this.lives,time:this.clock,
      enemies:this.enemies.filter(e=>e.state!==0&&near(e)).map(e=>({...e})),
      coinsVisible:this.collectibles.filter(c=>!c.got&&near(c)),power:this.power,
      goal:{x:2680,y:120},events:this.events.slice(-5)
    };
  }
}

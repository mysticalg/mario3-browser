// Presentation only: fixed-step particles and world-space trails never alter physics.
export class VisualEffects {
  constructor(){
    this.enabled=true;this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    try{this.enabled=localStorage.getItem('mario3-fx')!=='off';}catch{}
    this.reset();
  }
  reset(){this.trail=[];this.particles=[];this.seen=new WeakSet();this.tick=0;}
  toggle(){this.enabled=!this.enabled;this.reset();try{localStorage.setItem('mario3-fx',this.enabled?'on':'off');}catch{}return this.enabled;}
  burst(x,y,color,count=9){
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2,speed=.5+(i%3)*.45;
      this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-1,color,life:25,max:25,size:i%3===0?2:1});
    }
    this.particles=this.particles.slice(-100);
  }
  update(game,before){
    if(!this.enabled)return;
    const p=game.player;this.tick++;
    if(before&&Math.abs(p.x-before.x)>48){this.reset();return;}
    for(const q of this.particles){q.x+=q.vx;q.y+=q.vy;q.vy+=.045;q.life--;}
    this.particles=this.particles.filter(q=>q.life>0);
    if(this.motion&&game.state==='playing'&&Math.abs(p.vx)>2.7)this.trail.push({x:p.x,y:p.y,h:p.h,crouched:p.crouched});
    else this.trail.shift();
    if(this.trail.length>5)this.trail.shift();
    if(before&&!before.grounded&&p.grounded&&before.vy>2.5)this.burst(p.x+8,p.y+p.h-1,'#e5ce9c',7);
    if(p.skidding&&this.tick%4===0)this.burst(p.x+8,p.y+p.h-1,'#f8ead4',3);
    for(const event of game.events){
      if(this.seen.has(event))continue;this.seen.add(event);
      if(event.frame!==game.frame)continue;
      if(event.type==='coin')this.burst(p.x+8,p.y+4,'#fff29b');
      if(event.type==='stomp')this.burst(p.x+8,p.y+p.h,'#fff6dc',10);
      if(event.type==='grew')this.burst(p.x+8,p.y+p.h/2,'#b6fff0',18);
      if(event.type==='course-clear')this.burst(p.x+8,p.y,'#ffe68b',30);
    }
  }
  glow(ctx,x,y,r,color,alpha=.35){
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
  }
  shadow(ctx,game,body,cam){
    const x=body.x+8;if(x-cam<-20||x-cam>340)return;
    const bottom=body.y+(body.h||16);let ground=bottom+1;
    for(;ground<224;ground+=2)if(game.cell(x,ground)!==0)break;
    if(ground>=224)return;
    const distance=ground-bottom;ctx.save();ctx.fillStyle=`rgba(15,32,37,${Math.max(.04,.23-distance*.0018)})`;
    ctx.beginPath();ctx.ellipse(x-cam,ground-1,Math.max(3,7-distance*.025),1.7,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  background(ctx,game,cam){
    if(!this.enabled)return;
    for(let ty=0;ty<14;ty++)for(let tx=Math.max(0,Math.floor(cam/16));tx<=Math.min(175,Math.floor((cam+320)/16));tx++){
      if([3,4,6,7].includes(game.map[ty*256+tx]))this.glow(ctx,tx*16+8-cam,ty*16+8,16,'#ffd874',.22+.07*Math.sin(game.frame/16+tx));
    }
    for(const c of game.collectibles)if(!c.got&&c.x>cam-20&&c.x<cam+340)this.glow(ctx,c.x+8-cam,c.y+8,15,'#ffe26b',.28+.06*Math.sin(game.frame/12));
    if(game.power)this.glow(ctx,game.power.x+8-cam,game.power.y+8,22,'#a9ffe2',.45);
    if(2680-cam<350)this.glow(ctx,2688-cam,128,28,'#fff4a3',.5);
    this.shadow(ctx,game,game.player,cam);
    for(const e of game.enemies)if(e.state>0&&e.kind!==3)this.shadow(ctx,game,e,cam);
    if(game.power)this.shadow(ctx,game,game.power,cam);
  }
  ghosts(ctx,game,cam,drawSprite,id){
    if(!this.enabled||!this.motion||game.state!=='playing')return;
    ctx.save();
    for(let n=0;n<this.trail.length-1;n++){
      const p=this.trail[n];if(p.h!==game.player.h||p.crouched!==game.player.crouched)continue;
      ctx.globalAlpha=.035+n*.025;drawSprite(id,p.x-cam,p.y-(p.crouched?16:0),p.crouched?32:p.h);
    }
    ctx.restore();
  }
  foreground(ctx,cam){
    if(!this.enabled)return;
    ctx.save();for(const q of this.particles){ctx.globalAlpha=q.life/q.max;ctx.fillStyle=q.color;ctx.shadowColor=q.color;ctx.shadowBlur=3;ctx.fillRect(Math.round(q.x-cam),Math.round(q.y),q.size,q.size);}ctx.restore();
    const edge=ctx.createRadialGradient(160,100,100,160,100,210);edge.addColorStop(0,'transparent');edge.addColorStop(1,'#173c4b25');ctx.fillStyle=edge;ctx.fillRect(0,0,320,224);
  }
  snapshot(){return {enabled:this.enabled,motion:this.motion,trails:this.trail.length,particles:this.particles.length,tick:this.tick};}
}

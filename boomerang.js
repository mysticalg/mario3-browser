// Original PRG007 boomerang motion in 4.4 fixed-point units.
export function createBoomerang(owner,slot=0){
 const right=owner.facing==='right';return {owner,slot,x:owner.x,y:owner.y,fx:Math.floor(owner.x)*16,fy:Math.floor(owner.y)*16,vx:right?32:-32,vy:-22,phase:right?1:0,verticalPhase:0,timer:64,hold:15,age:0,dead:false};
}
export function stepBoomerang(b,frame){
 if(b.timer>0)b.timer--;
 if(b.hold>0){
  b.hold--;if(b.owner.state!==1){b.dead=true;return;}
  const right=b.owner.facing==='right';b.x=Math.floor(b.owner.x)+(right?-8:8);b.y=Math.floor(b.owner.y)+3;b.fx=Math.floor(b.x)*16;b.fy=Math.floor(b.y)*16;
  if((b.vx>0)!==right){b.vx=-b.vx;b.phase++;}return;
 }
 b.age++;
 if(b.phase>=0&&b.timer===0){const direction=b.phase&1;b.vx+=direction?-1:1;if(b.vx===(direction?-32:32)){b.timer=48;b.phase++;if(b.verticalPhase>0)b.phase=-1;}}
 if((frame&1)===0&&!(b.verticalPhase>=1&&b.vy===0)){const direction=b.verticalPhase&1;b.vy+=direction?-1:1;if(b.vy===(direction?-18:18))b.verticalPhase++;}
 b.fx+=b.vx;b.fy+=b.vy;b.x=Math.floor(b.fx/16);b.y=Math.floor(b.fy/16);
 if(b.phase<0&&((b.slot+frame)&1)===0&&b.owner.state===1&&b.owner.kind===6&&b.y-b.owner.y>=0&&b.y-b.owner.y<16&&b.x+8-b.owner.x>=0&&b.x+8-b.owner.x<16){b.dead=true;b.caught=true;}
}

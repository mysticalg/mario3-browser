// Original PRG007 Microgoomba state and 4.4 motion.
export function createMicro(x,y,slot=0){return {x,y,fx:x*16,fy:y*16,vx:0,vy:0,data:0,anim:0,slot,dead:false};}
const triangle=n=>{n&=31;return n<16?n:32-n;};
export function stepMicro(m,p,frame,pressed=false,random=0){
 let attached=0;
 if(m.data<0){m.fx+=m.vx;m.fy+=m.vy;if(m.vy<110)m.vy+=2;m.x=Math.floor(m.fx/16);m.y=Math.floor(m.fy/16);return attached;}
 if(m.data>0){
  attached=1;
  if(p.star||p.inWater){m.data=-1;m.vy=-32;m.vx=random&128?-8:8;}
  else{if(m.data<5&&(frame&15)===0)m.data++;if(pressed&&--m.data===0){m.data=-1;m.vy=-32;m.vx=random&128?-8:8;}}
  m.anim=(m.anim+1)&255;
  const wave=triangle(m.anim>>2);m.y=Math.floor(p.y)+((!p.big||p.crouched)?(wave>>1)+8:wave);m.x=Math.floor(p.x)+triangle(m.anim)-3;
  m.fx=m.x*16+(m.fx&15);m.fy=m.y*16+(m.fy&15);return attached;
 }
 m.fx+=m.vx;m.fy+=m.vy;m.x=Math.floor(m.fx/16);m.y=Math.floor(m.fy/16);
 if(m.vy<16)m.vy++;
 const direction=m.anim&1;m.vx+=direction?-1:1;if(m.vx===(direction?-16:16))m.anim=(m.anim+1)&255;
 if(((frame+m.slot)&1)!==0&&!p.invul){const big=p.big&&!p.crouched,dy=m.y+8-Math.floor(p.y)-(big?10:18),dx=m.x+6-Math.floor(p.x);if(dy>=0&&dy<(big?22:16)&&dx>=0&&dx<16)m.data=5;}
 return attached;
}
// PRG004 microgoomba bomber: physical actor uses a16px body.
export function initBomber(e){Object.assign(e,{bombPhase:0,bombTimer:0,bombAnim:0,bombWing:0,bombTurn:0,bombVx:-8,bombVy:0,bombFX:Math.floor(e.x)*16,bombFY:Math.floor(e.y)*16,bombRight:false});}
export function stepBomber(e,p,world,spawn){
 if(e.bombTimer>0)e.bombTimer--;
 const moveY=()=>{e.bombFY+=e.bombVy;e.y=Math.floor(e.bombFY/16);};
 const common=()=>{const limit=e.bombRight?20:-20;if(e.bombVx!==limit)e.bombVx+=e.bombRight?1:-1;e.bombTurn=(e.bombTurn+1)&255;if((e.bombTurn&63)===0)e.bombRight=p.x>=e.x;e.bombFX+=e.bombVx;e.x=Math.floor(e.bombFX/16);moveY();};
 if(e.bombPhase===0){
  e.bombAnim=(e.bombAnim+1)&255;e.bombVx=e.bombRight?8:-8;
  const next=e.bombFX+e.bombVx,wall=world.moveX(e,Math.floor(next/16)-e.x);e.bombFX=e.x*16+(next&15);
  const previous=e.y+16;moveY();const floor=e.bombVy>=0&&world.floor(e.x,previous,e.y+16);
  e.bombVy=Math.min(64,e.bombVy+3)-2;
  if(floor){e.y=world.floorY-16;e.bombFY=e.y*16+(e.bombFY&15);e.bombVy=0;if((e.bombAnim&63)===0)e.bombRight=p.x>=e.x;if(e.bombTimer===0){e.bombPhase=1;}else e.bombWing=e.bombTimer>=32?0:8;}
  else e.bombWing=8;
  if(wall)e.bombRight=!e.bombRight;
 }else if(e.bombPhase===1){
  e.bombWing=(e.bombWing+3)&255;
  if(p.y>=e.y&&p.y-e.y>=56){e.bombVy++;if(e.bombVy===0){e.bombPhase=2;e.bombTimer=128;e.vx=e.bombVx/16;e.vy=e.bombVy/16;return;}}
  else e.bombVy=-16;
  moveY();common();
 }else{
  if(e.bombTimer===0){e.bombPhase=0;e.bombTimer=128;}
  e.bombWing=(e.bombWing+2)&255;e.bombAnim=(e.bombAnim+1)&255;if((e.bombAnim&31)===0)spawn(e.x+4,e.y+4);
  e.bombVy=(e.bombAnim&16)?-8:8;common();
 }
 e.vx=e.bombVx/16;e.vy=e.bombVy/16;
}

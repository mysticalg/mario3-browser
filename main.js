import {VisualEffects} from './effects.js?v=0.11.0';
import {Parallax} from './parallax.js?v=0.11.0';
import {GameAudio} from './audio.js?v=0.11.0';
import {Game,STEP_MS,clamp} from './engine.js?v=0.11.0';
import {ControllerInput} from './input.js?v=0.11.0';
import {pixelText} from './pixel-font.js?v=0.11.0';
const VERSION='0.11.0';

const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
ctx.imageSmoothingEnabled=false;
const keyboard=new Set(),touch=new Set();
const controllers=new ControllerInput();
const fx=new VisualEffects();
const touchControls=document.querySelector('.touch-controls');
const touchHome=document.createComment('touch-controls-home');touchControls.before(touchHome);
let game,world,atlas,started=false,soundOn=true,audio=new GameAudio(),manualStepping=false,accumulator=0,lastTime=0;
let padState=null,controllerLabel='';
let previousVisual=null,lastPresentation=null,uiStamp='',raccoonArt,leafArt,parallax,renderCameraY=0,bonusWorld,bonusTiles,skyTiles,fireArt,flowerArt,ballArt,poofArt;
const dynamicCells=new Set();
const courses=new Map();const cleared=new Set(JSON.parse(localStorage.getItem('mario3-cleared')||'[]'));let miniStamp='';
const testMode=new URLSearchParams(location.search).has('test');

function tone(name){audio.effect(name);}
function unlockAudio(){audio.enable(soundOn);}
function focusGame(){canvas.focus({preventScroll:true});}
function start(auto=false,raccoon=false){
  if(!game)return;
  fx.reset();audio.reset();unlockAudio();game.restart(auto);started=true;accumulator=0;previousVisual=null;
  if(raccoon==='fire'){Object.assign(game.player,{fire:true,big:true,h:32,y:176});game.event('fire-practice');}
  else if(raccoon){Object.assign(game.player,{raccoon:true,big:true,h:32,y:144,vy:-2.7,grounded:false,powerMeter:60,flight:256,wag:16});game.event('raccoon-practice');}
  focusGame();syncUI();render();
}
function selectCourse(id,preserve=false){
  const course=courses.get(id);if(!course)return;
  game.setCourse(course.level,preserve);world=course.world;skyTiles=course.tiles;
  dynamicCells.clear();for(let off=0;off<game.level.solid.length;off++)if([2,3,4,6,7,8,10].includes(game.level.solid[off]))dynamicCells.add(off);
  previousVisual=null;miniStamp='';uiStamp='';fx.reset();audio.reset();started=true;accumulator=0;keyboard.clear();touch.clear();unlockAudio();focusGame();syncUI();render();
}
function startDemo(){if(game.course==='1-3')selectCourse('1-1');start(true);}
function nextCourse(){const ids=['1-1','1-2','1-3'],next=ids[ids.indexOf(game.course)+1];if(next)selectCourse(next,true);else start(false);}
function minimap(){
  const level=game.activeLevel,key=game.course+game.area;
  const width=game.areaWidth,scale=1000/width;
  if(miniStamp!==key){
    miniStamp=key;let terrain='';
    for(let row=0;row<14;row++)for(let col=0;col<Math.ceil(width/16);col++){
      const kind=level.solid[row*256+col];if(!kind)continue;
      terrain+=`<rect x="${col*16*scale}" y="${row*4+8}" width="${Math.max(1,16*scale)}" height="4" stroke="none" fill="${kind===9?'#7fd852':kind===5?'#83cdeb':'#3c8b58'}"/>`;
    }
    $('mini-map').innerHTML=`<title>Course ${game.course} minimap</title>${terrain}<rect id="mini-view" y="1" height="68" fill="#fff1" stroke="#ffffff70"/><circle id="mini-player" r="5" fill="#ff695d" stroke="#fff" stroke-width="2"/>`;
  }
  $('mini-player').setAttribute('cx',(game.player.x+8)*scale);$('mini-player').setAttribute('cy',clamp(game.player.y/4+8,4,66));
  $('mini-view').setAttribute('x',game.camera*scale);$('mini-view').setAttribute('width',320*scale);
  $('course-label').textContent=`World ${game.course}`;
  $('mini-caption').textContent=`World ${game.course}${game.area==='bonus'?' · bonus room':''} · ${Math.round(game.player.x/(width-36)*100)}%`;
  for(const button of document.querySelectorAll('[data-course]')){button.setAttribute('aria-pressed',String(button.dataset.course===game.course));button.textContent=`${cleared.has(button.dataset.course)?'✓ ':''}World ${button.dataset.course}`;}
}
function pause(){
  if(!game||!started)return;
  if(game.state==='complete'||game.state==='gameover'){start(false);return;}
  game.paused=!game.paused;keyboard.clear();touch.clear();
  if(!game.paused)focusGame();syncUI();render();
}
async function fullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.game-shell').requestFullscreen();}catch{}
  focusGame();
}
function pollController(){
  const {state,edges}=controllers.poll();padState=state;
  const label=state?`Connected: ${state.id.replace(/\s*\(.*$/,'').slice(0,56)}`:'Controller ready — connect a pad and press a button';
  if(label!==controllerLabel){controllerLabel=label;$('pad-status').textContent=label;$('pad-dot').classList.toggle('connected',!!state);}
  if(!game)return;
  if(!started){if(edges.start||edges.jump)start(false);return;}
  if(game.state==='complete'&&edges.jump){nextCourse();return;}
  if(edges.start){pause();return;}
  if(edges.restart){start(false);return;}
  if(!game.paused&&state&&(state.left||state.right||state.jump||state.run||state.down||state.up))game.auto=false;
}
function input(){
  return {
    left:keyboard.has('ArrowLeft')||keyboard.has('KeyZ')||touch.has('left')||!!padState?.left,
    right:keyboard.has('ArrowRight')||keyboard.has('KeyX')||touch.has('right')||!!padState?.right,
    jump:keyboard.has('Space')||keyboard.has('ArrowUp')||touch.has('jump')||!!padState?.jump,
    run:keyboard.has('ShiftLeft')||keyboard.has('ShiftRight')||touch.has('run')||!!padState?.run,
    down:keyboard.has('ArrowDown')||keyboard.has('KeyS')||touch.has('down')||!!padState?.down,
    up:keyboard.has('ArrowUp')||keyboard.has('KeyW')||!!padState?.up
  };
}
function step(){
  pollController();
  if(started&&!game.paused){
    previousVisual={...game.player,camera:game.camera,cameraY:game.cameraY,enemies:game.enemies.map(e=>({x:e.x,y:e.y,ref:e})),power:game.power?{x:game.power.x,y:game.power.y}:null};
    game.update(input());
    fx.update(game,previousVisual);
  }
}
function drawSprite(id,x,y,height=16){
  if(height<=0||x<-24||x>320||y-renderCameraY>224||y+height-renderCameraY<0)return;
  const source=id<256?(game.area==='bonus'?bonusTiles:skyTiles):id>=296&&id<=307?fireArt:atlas;
  ctx.drawImage(source,(id%32)*16,Math.floor(id/32)*32,16,height,Math.round(x),Math.round(y),16,height);
}
function text(value,x,y,size=8,color='#fcfcfc',align='left',outline=false){
  pixelText(ctx,value,x,y,{scale:size>=12?2:1,color,align,outline});
}
function actor(id,x,y,h=16){
  ctx.save();if(fx.enabled){ctx.shadowColor='#0b283b55';ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=2;}
  drawSprite(id,x,y,h);ctx.restore();
}
function drawPlant(id,x,y,e){
  if(e.h<=0)return;
  ctx.save();ctx.beginPath();ctx.rect(Math.round(x),Math.round(y),16,e.h);ctx.clip();
  ctx.translate(Math.round(x+(e.spits&&game.player.x>e.x?16:0)),Math.round(y));
  if(e.spits&&game.player.x>e.x)ctx.scale(-1,1);
  const sx=id%32*16,sy=Math.floor(id/32)*32;
  ctx.save();if(e.spits&&game.player.y<e.y){ctx.translate(0,16);ctx.scale(1,-1);}
  ctx.drawImage(atlas,sx,sy,16,16,0,0,16,16);ctx.restore();
  ctx.drawImage(atlas,sx,sy+16,16,16,0,16,16,16);ctx.restore();
}
function drawFirePlayer(id,x,y,h=32){ctx.drawImage(fireArt,(id%32)*16,Math.floor(id/32)*32,16,h,Math.round(x),Math.round(y),16,h);}
function drawRaccoon(x,y,p){
  let pose=p.grounded?Math.floor(p.travel/6)%3:3;
  if(p.wag>0)pose=(p.flight>0?8:11)+Math.floor(game.frame/5)%3;
  if(p.tail>0)pose=5+Math.floor((18-p.tail)/6)%3;
  if(p.crouched)pose=4;
  ctx.drawImage(raccoonArt,pose*24,p.facing==='right'?32:0,24,32,Math.round(x-(p.facing==='right'?8:0)),Math.round(y),24,32);
}
function render(alpha=1){
  if(!game||!world||!atlas)return;
  const p=game.player;
  const blend=(before,current)=>before!==undefined&&Math.abs(before-current)<64?before+(current-before)*alpha:current;
  const cam=Math.round(blend(previousVisual?.camera,game.camera));
  const cy=Math.round(blend(previousVisual?.cameraY,game.cameraY));renderCameraY=cy;
  const px=previousVisual?.h===p.h?blend(previousVisual.x,p.x):p.x;
  const py=previousVisual?.h===p.h?blend(previousVisual.y,p.y):p.y;
  lastPresentation={alpha,playerX:px,playerY:py,camera:cam,cameraY:cy};
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#a4fcf0';ctx.fillRect(0,0,320,256);
  ctx.save();ctx.beginPath();ctx.rect(0,0,320,224);ctx.clip();
  if(game.area==='main')parallax.draw(ctx,cam,cy);else{ctx.fillStyle='#000';ctx.fillRect(0,0,320,224);}
  ctx.translate(0,-cy);
  ctx.drawImage(game.area==='bonus'?bonusWorld:world,cam,0,320,224,0,0,320,224);
  for(const tile of game.sky.values())if(tile.id!==0x80)drawSprite(tile.id,tile.tx*16-cam,tile.ty*16);
  for(const off of dynamicCells){
    const id=game.tiles[off],bump=game.bumps.get(off);
    if(id!==0x80)drawSprite(id,(off%256)*16-cam,Math.floor(off/256)*16-(bump?Math.sin(bump.age/10*Math.PI)*3:0));
  }
  for(const [off,patch] of game.patches)if(!dynamicCells.has(off)&&patch.id!==0x80)drawSprite(patch.id,patch.tx*16-cam,patch.ty*16,16);
  fx.background(ctx,game,cam);
  for(const c of game.collectibles)if(!c.got)drawSprite(276+Math.floor(game.frame/6)%4,c.x-cam,c.y);
  for(let n=0;n<game.enemies.length;n++){
    const e=game.enemies[n],before=previousVisual?.enemies[n]?.ref===e?previousVisual.enemies[n]:null;
    if(e.state===0)continue;
    ctx.save();
    if(e.pipeTicks>0){ctx.beginPath();const mouth=e.pipeMouth-cam;ctx.rect(e.pipeDirection>0?mouth:0,-512,e.pipeDirection>0?320-mouth:mouth,1024);ctx.clip();}
    let id=272+(e.pipeTicks>0?Math.floor((40-e.pipeTicks)/4)%2:Math.floor(game.frame/8)%2),h=16;
    if([2,5].includes(e.kind)){id=e.vx>0?285:284;h=32;}
    if(e.kind===3){id=e.plantPhase===undefined?283:311+(e.spits?(e.plantRed?4:2):0)+Math.floor((e.plantAnim||0)/8)%2;h=e.h;}
    if(e.state===2||e.state===3){id=286;h=16;}
    if(e.state<0){id=e.deathStyle==='tumble'?([2,5].includes(e.kind)?286:e.kind===3?283:272):274;h=e.deathStyle==='tumble'?e.h:16;}
    if(e.red&&[284,285,286].includes(id))id+=24;
    const ex=blend(before?.x,e.x),ey=blend(before?.y,e.y);
    const shake=e.state===2&&e.wake<80&&(e.wake&[2,2,4,8,16,16][Math.floor(e.wake/16)])?1:0;
    if(e.deathStyle==='tumble'&&e.state<0){ctx.save();ctx.translate(Math.round(ex-cam),Math.round(ey+h));ctx.scale(1,-1);ctx.drawImage(atlas,(id%32)*16,Math.floor(id/32)*32,16,h,0,0,16,h);ctx.restore();}
    else if(e.kind===3&&e.plantPhase!==undefined)drawPlant(id,ex-cam,ey,e);
    else actor(id,ex-cam+shake,ey,h);
    if(e.kind===4&&e.state>0)drawSprite(287,ex-cam,ey-6,16);
    ctx.restore();
  }
  if(game.power){
    const x=blend(previousVisual?.power?.x,game.power.x)-cam,y=blend(previousVisual?.power?.y,game.power.y);
    if(game.power.kind==='leaf'||game.power.kind==='flower')ctx.drawImage(game.power.kind==='leaf'?leafArt:flowerArt,Math.round(x),Math.round(y),16,16);else actor(275,x,y);
  }
  for(const b of game.fireballs){
    if(fx.enabled)fx.glow(ctx,b.x+4-cam,b.y+4,b.poof?14:12,'#ffae43',.55);
    if(b.poof){const pose=Math.min(3,Math.floor((13-b.poof)/4));ctx.drawImage(poofArt,pose*16,0,16,16,Math.round(b.x-cam-4),Math.round(b.y-4),16,16);}
    else ctx.drawImage(ballArt,Math.floor(game.frame/4)%4*8,0,8,16,Math.round(b.x-cam),Math.round(b.y-4),8,16);
  }
  for(const b of game.enemyFireballs){
    if(fx.enabled)fx.glow(ctx,b.x+4-cam,b.y+4,12,'#ffae43',.55);
    ctx.drawImage(ballArt,Math.floor(game.frame/4)%4*8,0,8,16,Math.round(b.x-cam),Math.round(b.y-4),8,16);
  }
  for(const effect of game.effects){
    if(effect.kind==='coin')drawSprite(276+Math.floor(game.frame/4)%4,effect.x-cam,effect.y);
    if(effect.kind==='brick'){
      const sx=(0x67%32)*16+(effect.q%2)*8,sy=Math.floor(0x67/32)*32+Math.floor(effect.q/2)*8;
      ctx.drawImage(atlas,sx,sy,8,8,Math.round(effect.x-cam),Math.round(effect.y),8,8);
    }
  }
  let frame=0;
  if(Math.abs(p.vx)>.3)frame=1+Math.floor(p.travel/6)%2;
  if(!p.grounded)frame=3;
  if(p.big)frame+=4;
  const facing=p.facing==='right'?8:0;
  let playerId=256+facing+frame,drawHeight=p.h,drawY=py;
  if(p.skidding&&p.grounded)playerId=(p.big?291:289)+(p.facing==='right'?1:0);
  if(p.crouched){playerId=293+(p.facing==='right'?1:0);drawHeight=32;drawY-=16;}
  if(game.state==='dying'){playerId=288;drawHeight=16;}
  if(p.fire&&p.firing>0)playerId=296+(p.facing==='right'?6:0)+(p.grounded?0:3)+Math.min(2,Math.floor(p.firing/4));
  fx.ghosts(ctx,game,cam,p.raccoon?(_,x,y)=>drawRaccoon(x,y,p):p.fire?drawFirePlayer:drawSprite,playerId);
  ctx.save();
  if(game.state==='pipe'){
    ctx.beginPath();if(game.transition.clip==='above')ctx.rect(0,-384,320,game.transition.mouth+384);else ctx.rect(0,game.transition.mouth,320,640);ctx.clip();
  }
  if(game.state==='dying'||game.state==='pipe'||game.auto||p.invul===0||game.frame%6<3){
    if(p.raccoon&&game.state!=='dying'){
      drawRaccoon(px-cam,py-(p.crouched?16:0),p);
    }else if(p.fire)drawFirePlayer(playerId,px-cam,drawY,drawHeight);
    else actor(playerId,px-cam,drawY,drawHeight);
  }
  ctx.restore();
  if(game.state!=='complete'&&game.area==='main')drawSprite(280+Math.floor(game.frame/8)%3,game.goal.x-cam,game.goal.y);
  fx.foreground(ctx,cam);
  if(game.popup)text(game.popup.text,Math.floor(game.popup.x-cam),Math.floor(game.popup.y),7,'#fcfcfc','left',true);
  ctx.translate(0,cy);
  if(game.state==='complete'&&game.auto){
    ctx.fillStyle='#080d16dc';ctx.fillRect(53,57,214,77);
    text('COURSE CLEAR!',160,79,14,'#fcfcfc','center');text('YOU GOT A CARD',160,95,8,'#b5e9e6','center');drawSprite(280+game.card,152,104);
  }
  ctx.restore();
  ctx.fillStyle='#10151c';ctx.fillRect(0,224,320,32);
  text(game.area==='bonus'?'BONUS':`WORLD ${game.course}`,7,236);text(`M ×${game.lives}`,91,236);text(String(game.score).padStart(6,'0'),157,236);text(`$${String(game.coins).padStart(2,'0')}`,276,236);
  text(`TIME ${String(game.clock).padStart(3,'0')}`,7,249,8,'#bec9d7');
  const meter=clamp(Math.floor(p.powerMeter/60*7),0,7);
  text('P '+'>'.repeat(meter)+'·'.repeat(7-meter),91,249,8,p.flight>0||meter===7?'#ffe28b':'#bec9d7');
  text(p.fire?'FIRE MARIO':p.raccoon?'RACCOON':p.big?'SUPER MARIO':'MARIO',313,249,8,p.big?'#f8bd7f':'#bec9d7','right');
  syncUI();
}
function syncUI(){
  if(!game)return;
  if(game.state==='complete'&&!cleared.has(game.course)){cleared.add(game.course);localStorage.setItem('mario3-cleared',JSON.stringify([...cleared]));}
  minimap();
  const stamp=[started,game.course,game.state,game.area,game.paused,game.auto,game.score,game.coins].join('|');
  if(stamp===uiStamp)return;
  uiStamp=stamp;
  const end=['complete','gameover'].includes(game.state);
  $('demo-btn').textContent=game.course==='1-3'?'Watch World 1-1 demo':'Watch protected demo';
  $('start-menu').hidden=started;
  $('pause-menu').hidden=!started||(!game.paused&&!(end&&!game.auto));
  $('overlay').hidden=started&&!game.paused&&!(end&&!game.auto);
  $('pause-btn').disabled=!started||end;
  $('pause-btn').setAttribute('aria-label',game.paused?'Resume game':'Pause game');
  $('pause-btn').setAttribute('aria-pressed',String(game.paused));
  if(end){
    $('pause-kicker').textContent=game.state==='complete'?'NICE RUN':'ONE MORE TRY?';
    $('pause-title').textContent=game.state==='complete'?'COURSE CLEAR!':'GAME OVER';
    $('pause-description').textContent=`Score ${String(game.score).padStart(6,'0')} · ${game.coins} coins`;
    $('resume-btn').textContent=game.state==='complete'&&game.course!=='1-3'?'Next course':'Play again';$('menu-restart-btn').textContent=game.course==='1-3'?'Watch World 1-1 demo':'Watch protected demo';
  }else{
    $('pause-kicker').textContent='TAKE A BREATHER';$('pause-title').textContent='PAUSED';
    $('pause-description').textContent='Your adventure is right where you left it.';
    $('resume-btn').textContent='Resume game';$('menu-restart-btn').textContent='Start again';
  }
  $('mode-status').textContent=!started?'Ready to play':game.paused?'Paused':game.auto?'Protected preview · move to play':game.state==='complete'?'Course complete':game.state==='gameover'?'Game over':game.state==='pipe'?'Travelling through pipe':game.area==='bonus'?'Bonus room · jump up into exit pipe':'Playing';
}
const actionKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyS','KeyW','Space','KeyZ','KeyX','ShiftLeft','ShiftRight']);
window.addEventListener('keydown',event=>{
  if(event.target.matches?.('select,input,textarea')||event.target.isContentEditable)return;
  if(event.target.closest?.('details')&&event.target!==canvas)return;
  if(actionKeys.has(event.code)){
    if(event.code==='Space'&&event.target.tagName==='BUTTON')return;
    event.preventDefault();keyboard.add(event.code);
    if(!started){start(false);}
    else if(!game.paused)game.auto=false;
    unlockAudio();
  }
  if(event.repeat)return;
  if(event.code==='KeyP'||(event.code==='Escape'&&!document.fullscreenElement)){event.preventDefault();pause();}
  if(event.code==='KeyR'){event.preventDefault();start(false);}
  if(event.code==='KeyF'){event.preventDefault();fullscreen();}
  if(event.code==='KeyM'){event.preventDefault();document.getElementById('music-btn').click();}
  if(event.code==='KeyV'){event.preventDefault();document.getElementById('fx-btn').click();}
});
window.addEventListener('keyup',event=>keyboard.delete(event.code));
window.addEventListener('blur',()=>{
  keyboard.clear();touch.clear();document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed'));
  if(started&&['playing','pipe'].includes(game?.state)){game.paused=true;syncUI();render();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&['playing','pipe'].includes(game?.state)){game.paused=true;keyboard.clear();touch.clear();syncUI();}});
for(const button of document.querySelectorAll('[data-control]')){
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();button.setPointerCapture(event.pointerId);touch.add(button.dataset.control);button.classList.add('pressed');
    if(!started)start(false);else game.auto=false;unlockAudio();
  });
  const release=()=>{touch.delete(button.dataset.control);button.classList.remove('pressed');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
$('start-btn').addEventListener('click',()=>start(false));
$('demo-btn').addEventListener('click',startDemo);
$('raccoon-btn').addEventListener('click',()=>start(false,$('practice-suit').value));
$('practice-suit').addEventListener('change',()=>{document.querySelector('#start-menu .menu-foot').textContent=$('practice-suit').value==='fire'?'Fire Mario: tap Run to shoot · two fireballs max':'Raccoon: tap Jump to fly · tap Run to swipe';});
$('pause-btn').addEventListener('click',pause);
$('restart-btn').addEventListener('click',()=>start(false));
$('resume-btn').addEventListener('click',()=>{if(game.state==='complete')nextCourse();else if(game.state==='gameover')start(false);else pause();});
$('menu-restart-btn').addEventListener('click',()=>{if(['complete','gameover'].includes(game.state))startDemo();else start(false);});
$('fullscreen-btn').addEventListener('click',fullscreen);
$('exit-fullscreen').addEventListener('click',fullscreen);
document.addEventListener('fullscreenchange',()=>{
  const shell=document.querySelector('.game-shell'),active=document.fullscreenElement===shell;
  $('exit-fullscreen').hidden=!active;
  $('fullscreen-btn').setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
  if(active)shell.append(touchControls);
  else touchHome.parentNode.insertBefore(touchControls,touchHome.nextSibling);
  focusGame();
});
function syncFX(){
  $('fx-btn').textContent=fx.enabled?'FX on':'FX off';$('fx-btn').setAttribute('aria-pressed',String(fx.enabled));
}
$('fx-btn').addEventListener('click',()=>{fx.toggle();syncFX();focusGame();render();});syncFX();
$('music-btn').addEventListener('click',()=>{audio.music=!audio.music;audio.stopMusic();$('music-btn').setAttribute('aria-pressed',String(audio.music));$('music-btn').setAttribute('aria-label',audio.music?'Mute music':'Enable music');$('music-btn').querySelector('span').textContent=audio.music?'Music on':'Music off';focusGame();});
$('sound-btn').addEventListener('click',()=>{
  soundOn=!soundOn;unlockAudio();$('sound-btn').setAttribute('aria-pressed',String(soundOn));
  $('sound-btn').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');$('sound-btn').querySelector('span').textContent=soundOn?'Sound on':'Sound off';focusGame();
});
window.addEventListener('gamepadconnected',pollController);window.addEventListener('gamepaddisconnected',pollController);
function loop(now){
  const elapsed=Math.min(100,now-(lastTime||now));lastTime=now;
  if(game){
    if(!started||game.paused)pollController();
    if(!manualStepping){accumulator+=elapsed;while(accumulator+1e-7>=STEP_MS){accumulator=Math.max(0,accumulator-STEP_MS);step();}}
    audio.update(started&&!game.paused&&game.state==='playing',game.clock<100,game.paused,game.activeLevel.music||'overworld');
    render(manualStepping||game.paused||!started?1:clamp(accumulator/STEP_MS,0,1));
  }
  requestAnimationFrame(loop);
}
window.advanceTime=ms=>{
  manualStepping=true;accumulator+=Math.max(0,ms);
  while(accumulator+1e-7>=STEP_MS){accumulator=Math.max(0,accumulator-STEP_MS);if(game)step();}
  render();
};
window.render_game_to_text=()=>JSON.stringify(game?{...game.snapshot(),parallax:parallax?.snapshot(),fx:fx.snapshot(),audio:audio.snapshot(),screen:!started?'menu':game.paused?'paused':game.state,controller:padState?{connected:true,id:padState.id,controls:padState}:null}:{screen:'loading'});
function loadImage(name){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(`Could not load ${name}`));const url=new URL(`./assets/${name}`,import.meta.url);url.searchParams.set('v',VERSION);im.src=url;});}
window.gameReady=Promise.all([
  fetch(new URL('./assets/level.json?v=0.11.0',import.meta.url)).then(r=>{if(!r.ok)throw Error('Could not load level data');return r.json();}),loadImage('world.png'),loadImage('sprites.png'),loadImage('raccoon.png'),loadImage('leaf.png'),loadImage('parallax-sky.png'),loadImage('parallax-hills.png'),loadImage('parallax-forest.png'),loadImage('bonus-world.png'),loadImage('bonus-tiles.png'),loadImage('fire-player.png'),loadImage('flower.png'),loadImage('fireball.png'),loadImage('fire-poof.png')
]).then(([level,background,sprites,raccoon,leaf,skyLayer,hillsLayer,forestLayer,room,roomTiles,fire,flower,ball,poof])=>{
  fireArt=fire;flowerArt=flower;ballArt=ball;poofArt=poof;
  bonusWorld=room;bonusTiles=roomTiles;const layers=[skyLayer,hillsLayer,forestLayer];
  raccoonArt=raccoon;leafArt=leaf;parallax=new Parallax(layers);
  const scenery=document.createElement('canvas');scenery.width=4096;scenery.height=256;
  const backgroundCtx=scenery.getContext('2d');backgroundCtx.drawImage(background,0,0);
  const sky=backgroundCtx.getImageData(0,0,1,1).data;backgroundCtx.fillStyle=`rgb(${sky[0]},${sky[1]},${sky[2]})`;
  for(let off=0;off<level.solid.length;off++)if([2,3,4,6,7,8].includes(level.solid[off])){
    dynamicCells.add(off);backgroundCtx.fillRect((off%256)*16,Math.floor(off/256)*16,16,16);
  }
  const pixels=backgroundCtx.getImageData(0,0,4096,256);
  for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]===sky[0]&&pixels.data[i+1]===sky[1]&&pixels.data[i+2]===sky[2])pixels.data[i+3]=0;
  backgroundCtx.putImageData(pixels,0,0);
  for(let off=0;off<level.tiles.length;off++)if(level.solid[off]===0&&level.tiles[off]>=0x1f&&level.tiles[off]<=0x24)backgroundCtx.clearRect((off%256)*16,Math.floor(off/256)*16,16,16);
  skyTiles=document.createElement('canvas');skyTiles.width=512;skyTiles.height=320;const tileCtx=skyTiles.getContext('2d');tileCtx.drawImage(sprites,0,0);const tilePixels=tileCtx.getImageData(0,0,512,256);
  for(let i=0;i<tilePixels.data.length;i+=4)if(tilePixels.data[i]===sky[0]&&tilePixels.data[i+1]===sky[1]&&tilePixels.data[i+2]===sky[2])tilePixels.data[i+3]=0;tileCtx.putImageData(tilePixels,0,0);
  world=scenery;atlas=sprites;game=new Game(level,tone);$('loading').hidden=true;
  if(testMode)window.__test={game,start,render,controllers,audio,fx,presentation:()=>lastPresentation};
  courses.set('1-1',{level,world:scenery,tiles:skyTiles});
  for(const button of document.querySelectorAll('[data-course]'))button.addEventListener('click',()=>selectCourse(button.dataset.course));
  return Promise.all(['1-2','1-3'].map(async id=>{
    const [courseLevel,courseWorld,courseTiles]=await Promise.all([fetch(new URL(`./assets/courses/${id}.json?v=${VERSION}`,import.meta.url)).then(r=>{if(!r.ok)throw Error('Missing course '+id);return r.json();}),loadImage(`courses/${id}-world.png`),loadImage(`courses/${id}-tiles.png`)]);
    courses.set(id,{level:courseLevel,world:courseWorld,tiles:courseTiles});
  })).then(()=>{if(testMode)Object.assign(window.__test,{selectCourse,courses});minimap();render();return true;});
}).catch(error=>{
  $('loading').textContent=`Unable to load the game. ${error.message}. Please reload.`;console.error(error);return false;
});
requestAnimationFrame(loop);

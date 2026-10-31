import {VisualEffects} from './effects.js?v=0.6.1';
import {Parallax} from './parallax.js?v=0.6.1';
import {GameAudio} from './audio.js?v=0.6.1';
import {Game,STEP_MS,clamp} from './engine.js?v=0.6.1';
import {ControllerInput} from './input.js?v=0.6.1';
import {pixelText} from './pixel-font.js?v=0.6.1';
const VERSION='0.6.1';

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
let previousVisual=null,lastPresentation=null,uiStamp='',raccoonArt,leafArt,parallax,renderCameraY=0;
const dynamicCells=new Set();
const testMode=new URLSearchParams(location.search).has('test');

function tone(name){audio.effect(name);}
function unlockAudio(){audio.enable(soundOn);}
function focusGame(){canvas.focus({preventScroll:true});}
function start(auto=false,raccoon=false){
  if(!game)return;
  fx.reset();audio.reset();unlockAudio();game.restart(auto);started=true;accumulator=0;previousVisual=null;
  if(raccoon){Object.assign(game.player,{raccoon:true,big:true,h:32,y:144,vy:-2.7,grounded:false,powerMeter:60,flight:256,wag:16});game.event('raccoon-practice');}
  focusGame();syncUI();render();
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
  if(edges.start){pause();return;}
  if(edges.restart){start(false);return;}
  if(!game.paused&&state&&(state.left||state.right||state.jump||state.run||state.down))game.auto=false;
}
function input(){
  return {
    left:keyboard.has('ArrowLeft')||keyboard.has('KeyZ')||touch.has('left')||!!padState?.left,
    right:keyboard.has('ArrowRight')||keyboard.has('KeyX')||touch.has('right')||!!padState?.right,
    jump:keyboard.has('Space')||keyboard.has('ArrowUp')||touch.has('jump')||!!padState?.jump,
    run:keyboard.has('ShiftLeft')||keyboard.has('ShiftRight')||touch.has('run')||!!padState?.run,
    down:keyboard.has('ArrowDown')||keyboard.has('KeyS')||touch.has('down')||!!padState?.down
  };
}
function step(){
  pollController();
  if(started&&!game.paused){
    previousVisual={...game.player,camera:game.camera,cameraY:game.cameraY,enemies:game.enemies.map(e=>({x:e.x,y:e.y})),power:game.power?{x:game.power.x,y:game.power.y}:null};
    game.update(input());
    fx.update(game,previousVisual);
  }
}
function drawSprite(id,x,y,height=16){
  if(height<=0||x<-24||x>320||y-renderCameraY>224||y+height-renderCameraY<0)return;
  ctx.drawImage(atlas,(id%32)*16,Math.floor(id/32)*32,16,height,Math.round(x),Math.round(y),16,height);
}
function text(value,x,y,size=8,color='#fcfcfc',align='left',outline=false){
  pixelText(ctx,value,x,y,{scale:size>=12?2:1,color,align,outline});
}
function actor(id,x,y,h=16){
  ctx.save();if(fx.enabled){ctx.shadowColor='#0b283b55';ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=2;}
  drawSprite(id,x,y,h);ctx.restore();
}
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
  parallax.draw(ctx,cam,cy);ctx.translate(0,-cy);
  ctx.drawImage(world,cam,0,320,224,0,0,320,224);
  for(const off of dynamicCells){
    const id=game.tiles[off],bump=game.bumps.get(off);
    if(id!==0x80)drawSprite(id,(off%256)*16-cam,Math.floor(off/256)*16-(bump?Math.sin(bump.age/10*Math.PI)*3:0));
  }
  for(const [off,patch] of game.patches)if(!dynamicCells.has(off)&&patch.id!==0x80)drawSprite(patch.id,patch.tx*16-cam,patch.ty*16,16);
  fx.background(ctx,game,cam);
  for(const c of game.collectibles)if(!c.got)drawSprite(276+Math.floor(game.frame/6)%4,c.x-cam,c.y);
  for(let n=0;n<game.enemies.length;n++){
    const e=game.enemies[n],before=previousVisual?.enemies[n];
    if(e.state===0)continue;
    let id=272+Math.floor(game.frame/8)%2,h=16;
    if([2,5].includes(e.kind)){id=e.vx>0?285:284;h=32;}
    if(e.kind===3){id=283;h=e.h;}
    if(e.state===2||e.state===3){id=286;h=16;}
    if(e.state<0){id=274;h=16;}
    const ex=blend(before?.x,e.x),ey=blend(before?.y,e.y);
    const shake=e.state===2&&e.wake<80&&(e.wake&[2,2,4,8,16,16][Math.floor(e.wake/16)])?1:0;
    actor(id,ex-cam+shake,ey,h);
    if(e.kind===4&&e.state>0)drawSprite(287,ex-cam,ey-6,16);
  }
  if(game.power){
    const x=blend(previousVisual?.power?.x,game.power.x)-cam,y=blend(previousVisual?.power?.y,game.power.y);
    if(game.power.kind==='leaf')ctx.drawImage(leafArt,Math.round(x),Math.round(y),16,16);else actor(275,x,y);
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
  fx.ghosts(ctx,game,cam,p.raccoon?(_,x,y)=>drawRaccoon(x,y,p):drawSprite,playerId);
  if(game.state==='dying'||game.auto||p.invul===0||game.frame%6<3){
    if(p.raccoon&&game.state!=='dying'){
      drawRaccoon(px-cam,py-(p.crouched?16:0),p);
    }else actor(playerId,px-cam,drawY,drawHeight);
  }
  if(game.state!=='complete')drawSprite(280+Math.floor(game.frame/8)%3,2680-cam,120);
  fx.foreground(ctx,cam);
  if(game.popup)text(game.popup.text,Math.floor(game.popup.x-cam),Math.floor(game.popup.y),7,'#fcfcfc','left',true);
  ctx.translate(0,cy);
  if(game.state==='complete'&&game.auto){
    ctx.fillStyle='#080d16dc';ctx.fillRect(53,57,214,77);
    text('COURSE CLEAR!',160,79,14,'#fcfcfc','center');text('YOU GOT A CARD',160,95,8,'#b5e9e6','center');drawSprite(280+game.card,152,104);
  }
  ctx.restore();
  ctx.fillStyle='#10151c';ctx.fillRect(0,224,320,32);
  text('WORLD 1-1',7,236);text(`M ×${game.lives}`,91,236);text(String(game.score).padStart(6,'0'),157,236);text(`$${String(game.coins).padStart(2,'0')}`,276,236);
  text(`TIME ${String(game.clock).padStart(3,'0')}`,7,249,8,'#bec9d7');
  const meter=clamp(Math.floor(p.powerMeter/60*7),0,7);
  text('P '+'>'.repeat(meter)+'·'.repeat(7-meter),91,249,8,p.flight>0||meter===7?'#ffe28b':'#bec9d7');
  text(p.raccoon?'RACCOON':p.big?'SUPER MARIO':'MARIO',313,249,8,p.big?'#f8bd7f':'#bec9d7','right');
  syncUI();
}
function syncUI(){
  if(!game)return;
  const stamp=[started,game.state,game.paused,game.auto,game.score,game.coins].join('|');
  if(stamp===uiStamp)return;
  uiStamp=stamp;
  const end=['complete','gameover'].includes(game.state);
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
    $('resume-btn').textContent='Play again';$('menu-restart-btn').textContent='Watch protected demo';
  }else{
    $('pause-kicker').textContent='TAKE A BREATHER';$('pause-title').textContent='PAUSED';
    $('pause-description').textContent='Your adventure is right where you left it.';
    $('resume-btn').textContent='Resume game';$('menu-restart-btn').textContent='Start again';
  }
  $('mode-status').textContent=!started?'Ready to play':game.paused?'Paused':game.auto?'Protected preview · move to play':game.state==='complete'?'Course complete':game.state==='gameover'?'Game over':'Playing';
}
const actionKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyS','Space','KeyZ','KeyX','ShiftLeft','ShiftRight']);
window.addEventListener('keydown',event=>{
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
  if(started&&game?.state==='playing'){game.paused=true;syncUI();render();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&game?.state==='playing'){game.paused=true;keyboard.clear();touch.clear();syncUI();}});
for(const button of document.querySelectorAll('[data-control]')){
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();button.setPointerCapture(event.pointerId);touch.add(button.dataset.control);button.classList.add('pressed');
    if(!started)start(false);else game.auto=false;unlockAudio();
  });
  const release=()=>{touch.delete(button.dataset.control);button.classList.remove('pressed');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
$('start-btn').addEventListener('click',()=>start(false));
$('demo-btn').addEventListener('click',()=>start(true));
$('raccoon-btn').addEventListener('click',()=>start(false,true));
$('pause-btn').addEventListener('click',pause);
$('restart-btn').addEventListener('click',()=>start(false));
$('resume-btn').addEventListener('click',()=>{if(game.state==='complete'||game.state==='gameover')start(false);else pause();});
$('menu-restart-btn').addEventListener('click',()=>start(['complete','gameover'].includes(game.state)));
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
    audio.update(started&&!game.paused&&game.state==='playing',game.clock<100,game.paused);
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
  fetch(new URL('./assets/level.json?v=0.6.1',import.meta.url)).then(r=>{if(!r.ok)throw Error('Could not load level data');return r.json();}),loadImage('world.png'),loadImage('sprites.png'),loadImage('raccoon.png'),loadImage('leaf.png'),loadImage('parallax-sky.png'),loadImage('parallax-hills.png'),loadImage('parallax-forest.png')
]).then(([level,background,sprites,raccoon,leaf,...layers])=>{
  raccoonArt=raccoon;leafArt=leaf;parallax=new Parallax(layers);
  const scenery=document.createElement('canvas');scenery.width=4096;scenery.height=256;
  const backgroundCtx=scenery.getContext('2d');backgroundCtx.drawImage(background,0,0);
  const sky=backgroundCtx.getImageData(0,0,1,1).data;backgroundCtx.fillStyle=`rgb(${sky[0]},${sky[1]},${sky[2]})`;
  for(let off=0;off<level.solid.length;off++)if([2,3,4,6,7].includes(level.solid[off])){
    dynamicCells.add(off);backgroundCtx.fillRect((off%256)*16,Math.floor(off/256)*16,16,16);
  }
  const pixels=backgroundCtx.getImageData(0,0,4096,256);
  for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]===sky[0]&&pixels.data[i+1]===sky[1]&&pixels.data[i+2]===sky[2])pixels.data[i+3]=0;
  backgroundCtx.putImageData(pixels,0,0);
  for(let off=0;off<level.tiles.length;off++)if(level.solid[off]===0&&level.tiles[off]>=0x1f&&level.tiles[off]<=0x24)backgroundCtx.clearRect((off%256)*16,Math.floor(off/256)*16,16,16);
  world=scenery;atlas=sprites;game=new Game(level,tone);$('loading').hidden=true;
  if(testMode)window.__test={game,start,render,controllers,audio,fx,presentation:()=>lastPresentation};
  render();return true;
}).catch(error=>{
  $('loading').textContent=`Unable to load the game. ${error.message}. Please reload.`;console.error(error);return false;
});
requestAnimationFrame(loop);

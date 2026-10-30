import {Game,STEP_MS,clamp} from './engine.js';
import {ControllerInput} from './input.js';

const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
ctx.imageSmoothingEnabled=false;
const keyboard=new Set(),touch=new Set();
const controllers=new ControllerInput();
let game,world,atlas,started=false,soundOn=false,audio=null,manualStepping=false,accumulator=0,lastTime=0;
let padState=null,controllerLabel='';
const testMode=new URLSearchParams(location.search).has('test');

function tone(note,duration){
  if(!soundOn||!audio||audio.state!=='running')return;
  const oscillator=audio.createOscillator(),gain=audio.createGain(),time=audio.currentTime;
  oscillator.type='square';oscillator.frequency.setValueAtTime(110*Math.pow(2,(note-80)/48),time);
  gain.gain.setValueAtTime(.035,time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(time);oscillator.stop(time+duration);
}
function unlockAudio(){
  if(!soundOn)return;
  try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{soundOn=false;}
}
function focusGame(){canvas.focus({preventScroll:true});}
function start(auto=false){
  if(!game)return;
  unlockAudio();game.restart(auto);started=true;accumulator=0;
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
  if(!game.paused&&state&&(state.left||state.right||state.jump))game.auto=false;
}
function input(){
  return {
    left:keyboard.has('ArrowLeft')||keyboard.has('KeyZ')||touch.has('left')||!!padState?.left,
    right:keyboard.has('ArrowRight')||keyboard.has('KeyX')||touch.has('right')||!!padState?.right,
    jump:keyboard.has('Space')||keyboard.has('ArrowUp')||touch.has('jump')||!!padState?.jump,
    run:keyboard.has('ShiftLeft')||keyboard.has('ShiftRight')||touch.has('run')||!!padState?.run
  };
}
function step(){
  pollController();
  if(started&&!game.paused)game.update(input());
}
function drawSprite(id,x,y,height=16){
  if(height<=0||x<-16||x>320||y>224||y+height<0)return;
  ctx.drawImage(atlas,(id%32)*16,Math.floor(id/32)*32,16,height,Math.floor(x),Math.floor(y),16,height);
}
function text(value,x,y,size=8,color='#fcfcfc',align='left'){
  ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(value,x,y);
}
function render(){
  if(!game||!world||!atlas)return;
  const p=game.player,cam=game.camera;
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#a4fcf0';ctx.fillRect(0,0,320,256);
  ctx.save();ctx.beginPath();ctx.rect(0,0,320,224);ctx.clip();
  ctx.drawImage(world,cam,0,320,224,0,0,320,224);
  for(const patch of game.patches.values())drawSprite(patch.id,patch.tx*16-cam,patch.ty*16,16);
  for(const c of game.collectibles)if(!c.got)drawSprite(276+Math.floor(game.frame/6)%4,c.x-cam,c.y);
  for(const e of game.enemies){
    if(e.state===0)continue;
    let id=272+Math.floor(game.frame/8)%2,h=16;
    if([2,5].includes(e.kind)){id=e.vx>0?285:284;h=32;}
    if(e.kind===3){id=283;h=e.h;}
    if(e.state===2||e.state===3){id=286;h=16;}
    if(e.state<0){id=274;h=16;}
    drawSprite(id,e.x-cam,e.y,h);
    if(e.kind===4&&e.state>0)drawSprite(287,e.x-cam,e.y-6,16);
  }
  if(game.power)drawSprite(275,game.power.x-cam,game.power.y);
  let frame=0;
  if(Math.abs(p.vx)>.3)frame=1+Math.floor(p.travel/6)%2;
  if(!p.grounded)frame=3;
  if(p.big)frame+=4;
  const facing=p.facing==='right'?8:0;
  if(game.state==='dying'||game.auto||p.invul===0||game.frame%6<3)drawSprite(256+facing+frame,p.x-cam,p.y,p.h);
  if(game.state!=='complete')drawSprite(280+Math.floor(game.frame/8)%3,2680-cam,120);
  if(game.popup)text(game.popup.text,Math.floor(game.popup.x-cam),Math.floor(game.popup.y),7);
  if(game.state==='complete'&&game.auto){
    ctx.fillStyle='#080d16dc';ctx.fillRect(53,57,214,77);
    text('COURSE CLEAR!',160,79,14,'#fcfcfc','center');text('YOU GOT A CARD',160,95,8,'#b5e9e6','center');drawSprite(280+game.card,152,104);
  }
  ctx.restore();
  ctx.fillStyle='#10151c';ctx.fillRect(0,224,320,32);
  text('WORLD 1-1',7,236);text(`M ×${game.lives}`,91,236);text(String(game.score).padStart(6,'0'),157,236);text(`$${String(game.coins).padStart(2,'0')}`,276,236);
  text(`TIME ${String(game.clock).padStart(3,'0')}`,7,249,8,'#bec9d7');
  const meter=clamp(Math.floor(Math.abs(p.vx)*2),0,7);
  text('P '+'>'.repeat(meter)+'·'.repeat(7-meter),91,249,8,'#bec9d7');
  text(p.big?'SUPER MARIO':'MARIO',313,249,8,p.big?'#f8bd7f':'#bec9d7','right');
  syncUI();
}
function syncUI(){
  if(!game)return;
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
const actionKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','Space','KeyZ','KeyX','ShiftLeft','ShiftRight']);
window.addEventListener('keydown',event=>{
  if(event.target.closest?.('details')&&event.target!==canvas)return;
  if(actionKeys.has(event.code)){
    if(event.code==='Space'&&event.target.tagName==='BUTTON')return;
    event.preventDefault();keyboard.add(event.code);
    if(!started){start(false);}
    else if(!game.paused&&!event.code.startsWith('Shift'))game.auto=false;
    unlockAudio();
  }
  if(event.repeat)return;
  if(event.code==='KeyP'||(event.code==='Escape'&&!document.fullscreenElement)){event.preventDefault();pause();}
  if(event.code==='KeyR'){event.preventDefault();start(false);}
  if(event.code==='KeyF'){event.preventDefault();fullscreen();}
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
$('pause-btn').addEventListener('click',pause);
$('restart-btn').addEventListener('click',()=>start(false));
$('resume-btn').addEventListener('click',()=>{if(game.state==='complete'||game.state==='gameover')start(false);else pause();});
$('menu-restart-btn').addEventListener('click',()=>start(['complete','gameover'].includes(game.state)));
$('fullscreen-btn').addEventListener('click',fullscreen);
$('sound-btn').addEventListener('click',()=>{
  soundOn=!soundOn;unlockAudio();$('sound-btn').setAttribute('aria-pressed',String(soundOn));
  $('sound-btn').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');$('sound-btn').querySelector('span').textContent=soundOn?'Sound on':'Sound off';focusGame();
});
window.addEventListener('gamepadconnected',pollController);window.addEventListener('gamepaddisconnected',pollController);
function loop(now){
  const elapsed=Math.min(100,now-(lastTime||now));lastTime=now;
  if(game){
    pollController();
    if(!manualStepping){accumulator+=elapsed;while(accumulator>=STEP_MS){step();accumulator-=STEP_MS;}}
    render();
  }
  requestAnimationFrame(loop);
}
window.advanceTime=ms=>{
  manualStepping=true;accumulator+=Math.max(0,ms);
  while(accumulator>=STEP_MS){if(game)step();accumulator-=STEP_MS;}
  render();
};
window.render_game_to_text=()=>JSON.stringify(game?{...game.snapshot(),screen:!started?'menu':game.paused?'paused':game.state,controller:padState?{connected:true,id:padState.id,controls:padState}:null}:{screen:'loading'});
function loadImage(name){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(`Could not load ${name}`));im.src=new URL(`./assets/${name}`,import.meta.url);});}
window.gameReady=Promise.all([
  fetch(new URL('./assets/level.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Could not load level data');return r.json();}),loadImage('world.png'),loadImage('sprites.png')
]).then(([level,background,sprites])=>{
  world=background;atlas=sprites;game=new Game(level,tone);$('loading').hidden=true;
  if(testMode)window.__test={game,start,render,controllers};
  render();return true;
}).catch(error=>{
  $('loading').textContent=`Unable to load the game. ${error.message}. Please reload.`;console.error(error);return false;
});
requestAnimationFrame(loop);

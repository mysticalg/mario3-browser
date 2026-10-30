import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const base=process.argv[2]||'http://127.0.0.1:4173';
const output=path.resolve(process.argv[3]||'test-results');await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];const results=[];
function check(name,condition){assert.ok(condition,name);results.push(name);}
function track(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
const page=await browser.newPage({viewport:{width:1280,height:900}});track(page);
await page.addInitScript(()=>{
  window.__pads=[];
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__pads});
});
const snapshot=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const seed=async fn=>page.evaluate(fn);
try{
  await page.goto(base+'/?test=1');await page.evaluate(()=>window.gameReady);
  await page.screenshot({path:path.join(output,'desktop-menu.png'),fullPage:true});
  check('start menu displayed',(await snapshot()).screen==='menu');
  const box=await page.locator('canvas').boundingBox();check('desktop game uses a readable large viewport',box.width>=700&&box.height>=500);
  await page.click('#start-btn');await advance(900);
  const before=(await snapshot()).player.x;
  await page.keyboard.down('ArrowRight');await advance(180);await page.keyboard.up('ArrowRight');
  check('keyboard right movement and facing',(await snapshot()).player.x>before&&(await snapshot()).player.facing==='right');
  const interpolation=await page.evaluate(()=>{
    const t=window.__test;t.render(0);const a=t.presentation().playerX;t.render(1);const b=t.presentation().playerX;t.render(.5);const middle=t.presentation().playerX;t.render(1);return {a,b,middle};
  });
  check('presentation interpolates between physics ticks',interpolation.b>interpolation.a&&Math.abs(interpolation.middle-(interpolation.a+interpolation.b)/2)<.001);
  await page.keyboard.down('Space');await advance(210);await page.keyboard.up('Space');
  check('keyboard jump lifts player',(await snapshot()).player.y<180);
  await page.screenshot({path:path.join(output,'keyboard-gameplay.png'),fullPage:true});
  await page.keyboard.press('KeyP');const pause=await snapshot();await advance(600);
  check('keyboard pause freezes game',(await snapshot()).frame===pause.frame&&(await snapshot()).paused);
  await page.click('#resume-btn');check('resume button unpauses',!(await snapshot()).paused);
  await page.keyboard.press('KeyR');await advance(30);check('restart resets position and lives',(await snapshot()).player.x===24&&(await snapshot()).lives===3);
  await page.click('#sound-btn');await page.click('#sound-btn');check('sound button enables audio',(await page.getAttribute('#sound-btn','aria-pressed'))==='true');
  await page.waitForFunction(()=>window.__test.audio.snapshot().ready);await page.waitForTimeout(100);
  const audioState=await page.evaluate(()=>window.__test.audio.snapshot());
  check('original ROM music decoded and playing',audioState.state==='running'&&audioState.scheduled>0&&audioState.source==='original-rom');
  const renderedAudio=await page.evaluate(async()=>{
    const {GameAudio}=await import('./audio.js?v=0.4.1');const results=[];
    for(const name of ['jump','jump-big','coin','bump','break','stomp','kick','appear','powerup','oneup','shrink','death','clear','gameover','warning']){
      const context=new OfflineAudioContext(1,44100*2,44100),a=new GameAudio();a.context=context;a.enabled=true;await a.load();a.effect(name);
      const buffer=await context.startRendering(),data=buffer.getChannelData(0);let energy=0,peak=0;
      for(const sample of data){energy+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
      results.push({name,rms:Math.sqrt(energy/data.length),peak});
    }
    return results;
  });
  check('all 15 original effects and fanfares render audible waveforms without clipping',renderedAudio.every(a=>a.rms>.001&&a.peak<.95));
  const originalMusic=await page.evaluate(()=>{
    const a=window.__test.audio,b=a.buffers.get('overworld'),h=a.buffers.get('overworld-hurry');
    return {duration:b.duration,hurryDuration:h.duration,loop:a.manifest.files.overworld.loop,source:a.musicNode?.buffer===b};
  });
  check('original soundtrack uses ROM-derived intro and loop boundaries',originalMusic.source&&originalMusic.duration>28&&originalMusic.loop.start>3&&originalMusic.loop.end<=originalMusic.duration+.001);
  check('hurry music is separately rendered at the ROM fast tempo',originalMusic.hurryDuration<originalMusic.duration-4);
  await page.keyboard.press('KeyM');check('music can be muted independently',!(await page.evaluate(()=>window.__test.audio.snapshot())).music);
  await page.keyboard.press('KeyM');check('music can be enabled again',(await page.evaluate(()=>window.__test.audio.snapshot())).music);
  await page.evaluate(()=>window.__test.game.sound('coin'));
  check('game events route to distinct audio effects',(await page.evaluate(()=>window.__test.audio.snapshot())).lastEffect==='coin');
  await page.keyboard.press('KeyP');await page.waitForTimeout(30);
  check('pause silences music voices',(await page.evaluate(()=>window.__test.audio.snapshot())).voices===0);
  const pausedMusic=(await page.evaluate(()=>window.__test.audio.snapshot())).position;
  await page.waitForTimeout(100);check('music position freezes while paused',Math.abs((await page.evaluate(()=>window.__test.audio.snapshot())).position-pausedMusic)<.001);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(40);check('music resumes from the paused position',(await page.evaluate(()=>window.__test.audio.snapshot())).position>=pausedMusic);
  await page.click('#sound-btn');check('sound button mutes audio',(await page.getAttribute('#sound-btn','aria-pressed'))==='false');
  await seed(()=>{
    const g=window.__test.game;g.restart(false);g.enemies.forEach(e=>e.state=0);Object.assign(g.enemies[0],{kind:2,state:2,x:40,y:192,h:16,vx:0,vy:0,cooldown:0});
  });
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('ArrowRight');await advance(180);await page.keyboard.up('ArrowRight');
  check('run button picks up a stationary shell',(await snapshot()).player.carrying===0);
  await page.screenshot({path:path.join(output,'carrying-shell.png'),fullPage:true});
  await page.keyboard.up('ShiftLeft');await advance(30);
  check('releasing run throws the shell',(await snapshot()).player.carrying===-1&&(await snapshot()).events.some(e=>e.type==='shell-thrown'));
  await page.keyboard.press('KeyR');await advance(30);
  await page.click('#fullscreen-btn');await page.waitForFunction(()=>!!document.fullscreenElement);
  const fullBox=await page.locator('canvas').boundingBox();
  check('fullscreen uses the full available height',fullBox.height>=890);
  await page.click('#exit-fullscreen');await page.waitForFunction(()=>!document.fullscreenElement);

  // Real browser Gamepad API consumer, fed a standard-mapped virtual device.
  await seed(()=>{
    window.__pads=[{index:0,id:'Test Xbox-compatible standard pad',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}];
  });
  await advance(30);
  check('controller connection indicator updates',(await page.textContent('#pad-status')).includes('Connected:'));
  const padStartX=(await snapshot()).player.x;
  await seed(()=>window.__pads[0].buttons[15].pressed=true);await advance(150);
  check('controller D-pad moves right',(await snapshot()).player.x>padStartX);
  await seed(()=>{window.__pads[0].buttons[15].pressed=false;window.__pads[0].axes[0]=-.8;});await advance(240);
  check('controller analogue stick faces left',(await snapshot()).player.facing==='left');
  await seed(()=>{window.__pads[0].axes[0]=0;window.__test.game.restart(false);});await advance(900);
  await seed(()=>window.__pads[0].buttons[0].pressed=true);await advance(210);
  check('controller A jumps',(await snapshot()).player.y<180);
  await seed(()=>{window.__pads[0].buttons[0].pressed=false;window.__pads[0].buttons[9].pressed=true;});await advance(30);
  check('controller Start pauses',(await snapshot()).paused);
  const held=(await snapshot()).frame;await advance(300);check('held Start does not toggle repeatedly',(await snapshot()).paused&&(await snapshot()).frame===held);
  await seed(()=>window.__pads[0].buttons[9].pressed=false);await advance(30);
  await seed(()=>window.__pads[0].buttons[9].pressed=true);await advance(30);
  check('second Start resumes',!(await snapshot()).paused);
  await seed(()=>{window.__pads[0].buttons[9].pressed=false;window.__pads[0].buttons[8].pressed=true;});await advance(30);
  check('controller Select restarts',(await snapshot()).player.x===24&&(await snapshot()).score===0);
  await seed(()=>{window.__pads[0].buttons[8].pressed=false;window.__pads[0].buttons[15].pressed=true;window.__pads[0].buttons[2].pressed=true;});await advance(450);
  check('controller X enables running',(await snapshot()).player.vx>3);
  await seed(()=>window.__pads=[]);await advance(300);
  check('disconnect releases controller inputs',(await snapshot()).controller===null&&Math.abs((await snapshot()).player.vx)<1);

  // Exercise multi-step interactions in the actual browser-rendered engine.
  await seed(()=>{
    const g=window.__test.game;g.restart(false);g.enemies.forEach(e=>e.state=0);g.patch(10,10,0x61,4);Object.assign(g.player,{x:160,y:176,vy:-4});
  });
  await page.keyboard.down('Space');await advance(30);await page.keyboard.up('Space');
  check('browser head collision releases power-up',(await snapshot()).power?.emerging>0);
  await seed(()=>{const g=window.__test.game;Object.assign(g.power,{x:g.player.x,y:g.player.y,emerging:0,vy:0});});await advance(30);
  check('growth under a ceiling stays safely crouched',(await snapshot()).player.big&&(await snapshot()).player.h===16&&(await snapshot()).player.crouched);
  await seed(()=>{const p=window.__test.game.player;p.x=32;p.y=192;p.growing=0;});await advance(30);
  check('Super Mario stands when the ceiling clears',(await snapshot()).player.h===32&&!(await snapshot()).player.crouched);
  await page.keyboard.down('ArrowDown');await advance(30);
  check('keyboard Down ducks without moving the feet',(await snapshot()).player.crouched&&(await snapshot()).player.y===192);
  await page.keyboard.up('ArrowDown');await advance(30);
  await seed(()=>{
    window.__pads=[{index:0,id:'Duck control check',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},(_,n)=>({pressed:n===13,value:n===13?1:0}))}];
  });await advance(30);
  check('controller Down ducks Super Mario',(await snapshot()).player.crouched);
  await seed(()=>window.__pads=[]);await advance(30);
  await page.screenshot({path:path.join(output,'super-mario.png'),fullPage:true});
  await seed(()=>{const g=window.__test.game;g.player.growing=0;g.player.invul=0;g.hurt();});await advance(30);
  check('browser damage shrinks Mario',!(await snapshot()).player.big&&(await snapshot()).player.invul>0);
  await seed(()=>{const g=window.__test.game;g.player.invul=0;g.hurt();});await advance(1800);
  check('browser death respawns with one fewer life',(await snapshot()).lives===2&&(await snapshot()).state==='playing');

  // Complete course with the same protected preview as the native demo.
  await seed(()=>window.__test.start(true));
  await page.evaluate(()=>{for(let i=0;i<4000&&window.__test.game.state!=='complete';i++)window.advanceTime(30);});
  check('browser preview reaches goal',(await snapshot()).state==='complete');
  await page.screenshot({path:path.join(output,'course-clear.png'),fullPage:true});
  await advance(5000);check('preview restarts automatically',(await snapshot()).state==='playing');
  await page.keyboard.down('ArrowLeft');await advance(90);await page.keyboard.up('ArrowLeft');
  check('manual input takes over protected demo',!(await snapshot()).protectedDemo);

  await seed(()=>{
    const {game:g,fx}=window.__test;g.restart(false);fx.enabled=true;fx.reset();g.enemies.forEach(e=>e.state=0);
    Object.assign(g.player,{x:400,y:70,vx:3.6,vy:0,grounded:false});g.collectibles=[{x:410,y:70,got:false},{x:460,y:50,got:false}];
    g.power={x:500,y:100,vy:0,dir:0,emerging:16};
  });
  await advance(100);
  check('running builds bounded motion trails',(await snapshot()).fx.trails>0&&(await snapshot()).fx.trails<=5);
  check('coin collection creates visible particles',(await snapshot()).fx.particles>0);
  await page.screenshot({path:path.join(output,'fx-on.png'),fullPage:true});
  const readPixels=()=>page.evaluate(()=>Array.from(document.querySelector('canvas').getContext('2d').getImageData(0,0,320,256).data).reduce((sum,v,i)=>(sum+v*(i%7+1))%2147483647,0));
  const lit=await readPixels(),physics=await page.evaluate(()=>JSON.stringify(window.__test.game.snapshot()));
  await page.keyboard.press('KeyV');
  check('FX toggle restores crisp rendering',!(await snapshot()).fx.enabled&&await readPixels()!==lit);
  check('FX toggle does not change gameplay state',await page.evaluate(()=>JSON.stringify(window.__test.game.snapshot()))===physics);
  await page.screenshot({path:path.join(output,'fx-off.png'),fullPage:true});
  await page.keyboard.press('KeyV');await page.keyboard.press('KeyP');const fxPaused=(await snapshot()).fx;await advance(500);
  check('paused FX freeze with the game',JSON.stringify((await snapshot()).fx)===JSON.stringify(fxPaused));
  await page.keyboard.press('KeyP');await page.keyboard.press('KeyV');
  await page.reload();await page.evaluate(()=>window.gameReady);
  check('FX preference persists after reload',!(await snapshot()).fx.enabled);
  const reduced=await browser.newPage({reducedMotion:'reduce'});track(reduced);await reduced.goto(base+'/?test=1');await reduced.evaluate(()=>window.gameReady);
  check('reduced-motion preference disables motion trails',await reduced.evaluate(()=>!window.__test.fx.motion));await reduced.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});track(mobile);
  await mobile.goto(base+'/?test=1');await mobile.evaluate(()=>window.gameReady);
  await mobile.screenshot({path:path.join(output,'mobile-menu.png'),fullPage:true});
  check('mobile has no horizontal overflow',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('touch controls visible',await mobile.locator('.touch-controls').isVisible());
  await mobile.tap('#start-btn');await mobile.evaluate(()=>window.advanceTime(900));
  const session=await mobile.context().newCDPSession(mobile);
  const rightBox=await mobile.locator('[data-control="right"]').boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rightBox.x+rightBox.width/2,y:rightBox.y+rightBox.height/2,id:10}]});
  await mobile.evaluate(()=>window.advanceTime(180));
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('touch right moves player',await mobile.evaluate(()=>window.__test.game.player.x>24));
  const jumpBox=await mobile.locator('[data-control="jump"]').boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jumpBox.x+jumpBox.width/2,y:jumpBox.y+jumpBox.height/2,id:11}]});
  await mobile.evaluate(()=>window.advanceTime(210));
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('touch jump lifts player',await mobile.evaluate(()=>window.__test.game.player.y<180));
  await mobile.screenshot({path:path.join(output,'mobile-gameplay.png'),fullPage:true});
  await mobile.evaluate(()=>window.__test.start(false));
  const runBox=await mobile.locator('[data-control="run"]').boundingBox();
  const rightPoint={x:rightBox.x+rightBox.width/2,y:rightBox.y+rightBox.height/2,id:20},runPoint={x:runBox.x+runBox.width/2,y:runBox.y+runBox.height/2,id:21};
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[rightPoint,runPoint]});await mobile.evaluate(()=>window.advanceTime(250));
  check('simultaneous touch run and direction reach running speed',await mobile.evaluate(()=>window.__test.game.player.vx>3));
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[rightPoint,runPoint,{x:jumpBox.x+jumpBox.width/2,y:jumpBox.y+jumpBox.height/2,id:22}]});
  await mobile.evaluate(()=>window.advanceTime(150));
  check('third touch can jump while running',await mobile.evaluate(()=>window.__test.game.player.y<180));
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.evaluate(()=>window.__test.start(false));
  await mobile.tap('#fullscreen-btn');await mobile.waitForFunction(()=>!!document.fullscreenElement);
  check('touch controls remain in fullscreen',await mobile.evaluate(()=>document.fullscreenElement.contains(document.querySelector('.touch-controls'))));
  await mobile.screenshot({path:path.join(output,'mobile-fullscreen.png')});
  await mobile.tap('#exit-fullscreen');await mobile.waitForFunction(()=>!document.fullscreenElement);
  await mobile.setViewportSize({width:320,height:740});
  check('small phone has no horizontal overflow',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.screenshot({path:path.join(output,'small-phone.png'),fullPage:true});
  check('no browser errors',errors.length===0);
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify({url:base,passed:results.length,checks:results,errors},null,2));
  console.log(JSON.stringify({passed:results.length,errors,output}));
}catch(error){
  await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});
  await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,errors,checks:results,state:await snapshot()},null,2));
  throw error;
}finally{await browser.close();}

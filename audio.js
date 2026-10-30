// Rendered from the supplied ROM's original 6502 sound driver. See provenance.json.
const ROOT=new URL('./assets/audio/',import.meta.url);
let encodedAssets;
function assets(){
 return encodedAssets ||= fetch(new URL('provenance.json',ROOT)).then(r=>{if(!r.ok)throw Error('Audio manifest unavailable');return r.json();}).then(async manifest=>{
 const files=await Promise.all(Object.keys(manifest.files).map(async name=>{const r=await fetch(new URL(name+'.wav',ROOT));if(!r.ok)throw Error(`Missing ROM audio: ${name}`);return [name,await r.arrayBuffer()];}));return {manifest,files};
 }).catch(error=>{encodedAssets=null;throw error;});
}
export class GameAudio {
 constructor(factory=()=>new (window.AudioContext||window.webkitAudioContext)()){
 this.factory=factory;this.enabled=false;this.music=true;this.context=null;this.nodes=new Set();this.buffers=new Map();this.manifest=null;this.loading=null;this.error=null;
 this.active=false;this.scheduled=0;this.lastEffect=null;this.fanfareUntil=0;this.musicNode=null;this.offset=0;this.track='overworld';this.pending=[];
 }
 async load(){
 if(this.manifest)return;
 return this.loading ||= assets().then(async({manifest,files})=>{
 const decoded=await Promise.all(files.map(async([name,bytes])=>[name,await this.context.decodeAudioData(bytes.slice(0))]));
 this.buffers=new Map(decoded);this.manifest=manifest;this.error=null;
 const pending=this.pending.splice(0);if(this.enabled)for(const name of pending)this.effect(name);
 }).catch(error=>{this.loading=null;this.error=error.message;throw error;});
 }
 async enable(value){
 this.enabled=value;if(!value){this.pending=[];this.stop();return;}
 try{this.context ||= this.factory();await this.context.resume();await this.load();}catch(error){this.error=error.message;}
 }
 musicPosition(){
 if(!this.musicNode)return this.offset;
 let position=this.offset+this.context.currentTime-this.musicStarted;const loop=this.manifest.files[this.track].loop;
 if(position>=loop.end)position=loop.start+(position-loop.start)%(loop.end-loop.start);return position;
 }
 stopMusic(){
 if(!this.musicNode)return;this.offset=this.musicPosition();const node=this.musicNode;this.musicNode=null;try{node.stop();}catch{}this.nodes.delete(node);
 }
 stop(){this.stopMusic();for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();}
 reset(){this.stop();this.offset=0;this.track='overworld';this.fanfareUntil=0;this.pending=[];}
 effect(name){
 if(!this.enabled||!this.context)return;
 if(!this.buffers.size){this.pending.push(name);if(this.pending.length>4)this.pending.shift();return;}
 const buffer=this.buffers.get(name);if(!buffer)return;const now=this.context.currentTime;this.lastEffect=name;
 if(['death','clear','gameover','warning'].includes(name)){this.stopMusic();this.fanfareUntil=now+buffer.duration;if(name!=='warning')this.offset=0;}
 const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=1.25;
 source.connect(gain);gain.connect(this.context.destination);this.nodes.add(source);
 source.onended=()=>{this.nodes.delete(source);source.disconnect();gain.disconnect();};source.start();this.scheduled++;
 }
 update(active,hurry=false,paused=false){
 if(!active){if(paused)this.stop();else this.stopMusic();}this.active=active;
 if(!active||!this.enabled||!this.music||!this.manifest||this.context.state!=='running')return;
 const track=hurry?'overworld-hurry':'overworld';
 if(track!==this.track){this.stopMusic();const old=this.manifest.files[this.track].loop,next=this.manifest.files[track].loop;this.offset=this.offset/old.end*next.end;this.track=track;if(hurry)this.effect('warning');}
 if(this.musicNode||this.context.currentTime<this.fanfareUntil)return;
 const source=this.context.createBufferSource(),gain=this.context.createGain(),loop=this.manifest.files[track].loop;
 source.buffer=this.buffers.get(track);source.loop=true;source.loopStart=loop.start;source.loopEnd=loop.end;gain.gain.value=.65;
 source.connect(gain);gain.connect(this.context.destination);this.nodes.add(source);this.musicNode=source;this.musicStarted=this.context.currentTime;
 source.onended=()=>{this.nodes.delete(source);source.disconnect();gain.disconnect();};source.start(0,this.offset);this.scheduled++;
 }
 snapshot(){return {source:'original-rom',enabled:this.enabled,music:this.music,active:this.active,state:this.context?.state||'locked',ready:!!this.manifest,error:this.error,scheduled:this.scheduled,lastEffect:this.lastEffect,voices:this.nodes.size,track:this.track,position:this.musicPosition(),loop:this.manifest?.files[this.track]?.loop};}
}

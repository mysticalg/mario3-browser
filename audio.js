// Small, original chiptune arrangement: two pulse voices, triangle bass and noise.
// All notes are generated locally; no media downloads or ROM audio engine needed.
const hz=midi=>440*2**((midi-69)/12);
const effects={
  jump:[[60,0,.06],[67,.045,.08],[76,.10,.10]],
  'jump-big':[[48,0,.06],[55,.045,.08],[64,.10,.10]],
  coin:[[83,0,.07],[95,.07,.18]],bump:[[43,0,.07]],
  break:[[36,0,.06],[30,.05,.12]],stomp:[[50,0,.055],[38,.045,.10]],
  kick:[[64,0,.04],[45,.035,.10]],
  appear:[[48,0,.07],[52,.07,.07],[55,.14,.07],[60,.21,.12]],
  powerup:[[60,0,.07],[64,.07,.07],[67,.14,.07],[72,.21,.07],[76,.28,.07],[79,.35,.18]],
  oneup:[[76,0,.1],[79,.1,.1],[88,.2,.1],[84,.3,.1],[86,.4,.1],[91,.5,.22]],
  shrink:[[72,0,.06],[67,.06,.06],[60,.12,.06],[48,.18,.15]],
  death:[[72,0,.15],[71,.18,.1],[67,.3,.14],[64,.47,.14],[60,.64,.35]],
  clear:[[60,0,.12],[64,.12,.12],[67,.24,.12],[72,.36,.2],[67,.6,.1],[72,.74,.45]]
};
const melody=[76,0,79,0,81,79,76,72,74,0,76,0,79,76,72,0,77,0,81,0,84,81,79,77,76,0,79,76,74,72,71,0,
  72,76,79,0,84,0,81,79,77,0,74,77,81,0,79,77,76,79,84,0,83,81,79,76,74,0,71,74,72,0,0,0];
const bass=[48,55,48,55,53,60,53,60,48,55,48,55,43,50,43,55];
export class GameAudio {
  constructor(factory=()=>new (window.AudioContext||window.webkitAudioContext)()){
    this.factory=factory;this.enabled=false;this.music=true;this.context=null;this.nodes=new Set();this.next=0;this.beat=0;this.active=false;this.scheduled=0;this.lastEffect=null;this.fanfareUntil=0;
  }
  async enable(value){
    this.enabled=value;
    if(!value){this.stop();return;}
    try{this.context ||= this.factory();await this.context.resume();}catch{this.enabled=false;}
  }
  stop(){for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();this.next=0;}
  note(midi,start,duration,type='square',volume=.035){
    if(!this.enabled||!this.context||!midi)return;
    const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(hz(midi),start);
    g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(volume,start+.004);g.gain.setValueAtTime(volume*.65,start+duration*.45);g.gain.exponentialRampToValueAtTime(.0001,start+duration);
    o.connect(g);g.connect(c.destination);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();};o.start(start);o.stop(start+duration+.01);this.scheduled++;
  }
  noise(start){
    const c=this.context,b=c.createBuffer(1,Math.floor(c.sampleRate*.035),c.sampleRate),data=b.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length)*.025;
    const n=c.createBufferSource();n.buffer=b;n.connect(c.destination);this.nodes.add(n);n.onended=()=>{this.nodes.delete(n);n.disconnect();};n.start(start);
  }
  effect(name){
    if(!this.enabled||!this.context||(this.context.state!=='running'&&!this.context.startRendering))return;
    const now=this.context.currentTime;this.lastEffect=name;
    if(name==='death'||name==='clear'){this.stop();this.fanfareUntil=now+1.4;}
    for(const [pitch,offset,length] of effects[name]||effects.bump)this.note(pitch,now+offset,length,'square',.055);
    if(name==='break'||name==='stomp'||name==='kick')this.noise(now);
  }
  update(active,hurry=false){
    if(!active&&this.active&&(!this.context||this.context.currentTime>=this.fanfareUntil))this.stop();this.active=active;
    if(!active||!this.enabled||!this.music||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime;if(now<this.fanfareUntil)return;
    if(!this.next||this.next<now){this.next=now+.025;}
    const duration=hurry?.115:.145;
    while(this.next<now+.12){
      const i=this.beat%melody.length;
      this.note(melody[i],this.next,duration*.8,'square',.018);
      if(i%2===0)this.note(bass[Math.floor(i/4)%bass.length],this.next,duration*1.65,'triangle',.065);
      if(i%4===2)this.note(melody[i]?melody[i]-12:67,this.next,duration*.5,'square',.009);
      if(i%2===0)this.noise(this.next);
      this.next+=duration;this.beat++;
    }
  }
  snapshot(){return {enabled:this.enabled,music:this.music,active:this.active,state:this.context?.state||'locked',scheduled:this.scheduled,lastEffect:this.lastEffect,voices:this.nodes.size};}
}

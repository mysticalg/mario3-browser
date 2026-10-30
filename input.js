export function readGamepad(pad) {
  if(!pad||pad.connected===false)return null;
  const button=index=>!!pad.buttons?.[index]?.pressed||(pad.buttons?.[index]?.value||0)>.5;
  const axis=Number(pad.axes?.[0]||0);
  return {
    index:pad.index,id:String(pad.id||'Game controller'),
    left:button(14)||axis<-.25,right:button(15)||axis>.25,
    jump:button(0),run:button(1)||button(2),start:button(9),restart:button(8),
    anyButton:pad.buttons?.some(b=>b.pressed||b.value>.5)||false
  };
}

export class ControllerInput {
  constructor(getPads=()=>navigator.getGamepads?.()||[]) {
    this.getPads=getPads;this.active=null;this.previous={start:false,restart:false,jump:false};
  }
  poll() {
    let pads=[];try{pads=Array.from(this.getPads()||[]);}catch{}
    const live=pads.filter(p=>p&&p.connected!==false);
    // Keep the active pad until it disconnects; let a newly-used pad take over.
    const used=live.find(p=>p.buttons?.some(b=>b.pressed||b.value>.5)||Math.abs(p.axes?.[0]||0)>.25);
    const pad=used||live.find(p=>p.index===this.active?.index)||live[0];
    const state=readGamepad(pad);
    const changed=state?.index!==this.active?.index;
    if(changed)this.previous={start:false,restart:false,jump:false};
    const edges={start:!!state?.start&&!this.previous.start,restart:!!state?.restart&&!this.previous.restart,jump:!!state?.jump&&!this.previous.jump};
    this.active=state;
    this.previous={start:!!state?.start,restart:!!state?.restart,jump:!!state?.jump};
    return {state,edges};
  }
}

export class Parallax {
  constructor(images){this.images=images;this.layers=[];}
  draw(ctx,camera,cameraY){
    const gradient=ctx.createLinearGradient(0,0,0,224);gradient.addColorStop(0,'#37bce7');gradient.addColorStop(1,'#b7fff1');ctx.fillStyle=gradient;ctx.fillRect(0,0,320,224);
    this.layers=[];
    for(const [n,rate,y] of [[0,.08,0],[1,.22,70-cameraY*.2],[2,.45,105-cameraY*.55]]){
      const im=this.images[n],width=768,offset=((camera*rate)%width+width)%width;
      this.layers.push({rate,offset,y});
      for(let x=-offset;x<320;x+=width)ctx.drawImage(im,x,y,width,n===0?224:171);
    }
  }
  snapshot(){return this.layers;}
}

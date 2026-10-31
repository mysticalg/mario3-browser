# ROM asset decoder. Frame/palette reference: Southbird PRG008/029; projectiles: PRG007.
from pathlib import Path
from PIL import Image
import re,json,hashlib,sys
if len(sys.argv)!=3:raise SystemExit('Usage: python tools/export-fire-assets.py your-rom.nes FCEUX.pal')
r=Path(__file__).resolve().parents[1]/'assets';rom=Path(sys.argv[1]).read_bytes();ch=rom[262160:];pal=Path(sys.argv[2]).read_bytes();source=Image.open(r/'sprites.png').convert('RGBA');fire=source.copy()
old=[tuple(pal[n*3:n*3+3]) for n in [0x16,0x36,0x0f]];new=[tuple(pal[n*3:n*3+3]) for n in [0x27,0x36,0x16]];mapping=dict(zip(old,new))
fire.putdata([(*mapping.get(p[:3],p[:3]),p[3]) for p in fire.getdata()])
def column(bank,t,colors,flip=False):
 im=Image.new('RGBA',(8,16))
 for y in range(16):
  off=bank*1024+(t+y//8)*16;yy=y%8
  for x in range(8):
   v=((ch[off+yy]>>(7-x))&1)|(((ch[off+yy+8]>>(7-x))&1)<<1)
   if v:im.putpixel((x,y),(*pal[colors[v]*3:colors[v]*3+3],255))
 return im.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else im
frameBase=16+29*8192+0xc51;assert rom[frameBase:frameBase+6]==bytes([1,3,0xf1,5,7,9]);colors=[0,0x27,0x36,0x16]
for n,f in enumerate([0x0e,0x11,0x10,0x34,0x35,0x36]):
 vals=list(rom[frameBase+f*6:frameBase+(f+1)*6]);bank=84+rom[frameBase+486+f];im=Image.new('RGBA',(16,32))
 for q,t in enumerate(vals):
  if t!=0xf1 and q%3<2:im.paste(column(bank,t&0x3e,colors),((q%3)*8,(q//3)*16))
 for id,img in [(296+n,im),(302+n,im.transpose(Image.Transpose.FLIP_LEFT_RIGHT))]:fire.paste(img,((id%32)*16,(id//32)*32))
fire.save(r/'fire-player.png',optimize=True)
objpal=list(rom[0x36ca2+132:0x36ca2+136]);flower=Image.new('RGBA',(16,16));left=column(4,18,objpal);flower.paste(left,(0,0));flower.paste(left.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(8,0));flower.save(r/'flower.png')
ball=Image.new('RGBA',(32,16));poof=Image.new('RGBA',(64,16))
for n in range(4):
 im=column(4,36+(n%2)*2,objpal)
 if n>=2:im=im.transpose(Image.Transpose.ROTATE_180)
 ball.paste(im,(n*8,0))
 left=column(4,[4,0,2,6][n],objpal);poof.paste(left,(n*16,0));poof.paste(left.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(n*16+8,0))
ball.save(r/'fireball.png');poof.save(r/'fire-poof.png')

(r/'fire-provenance.json').write_text(json.dumps({'romSHA256':hashlib.sha256(rom).hexdigest(),'frameTableOffset':frameBase,'framePageOffsets':frameBase+486,'throwFrames':[14,17,16,52,53,54],'paletteTableOffset':rom.find(bytes.fromhex('00 16 36 0f 00 2a 36 0f 00 27 36 16')),'firePalette':[39,54,22],'projectilePatterns':[101,103],'projectileCHRBank':4},indent=2))

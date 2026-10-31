# Original plant CHR: PRG005 ObjPA0/ObjPA4, object page 79.
from pathlib import Path
from PIL import Image
import sys,json,hashlib
root=Path(__file__).resolve().parents[1];rom=Path(sys.argv[1]).read_bytes();pal=Path(sys.argv[2]).read_bytes();ch=rom[262160:]
assert hashlib.sha256(rom).hexdigest()=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579'
atlas=Image.open(root/'assets/sprites.png').convert('RGBA')
def column(t,colors,flip=False):
 im=Image.new('RGBA',(8,16))
 for y in range(16):
  off=79*1024+(t+y//8)*16;yy=y%8
  for x in range(8):
   v=((ch[off+yy]>>(7-x))&1)|(((ch[off+yy+8]>>(7-x))&1)<<1)
   if v:im.putpixel((x,y),(*pal[colors[v]*3:colors[v]*3+3],255))
 return im.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else im
for style,fire,red in [(0,False,False),(1,True,False),(2,True,True)]:
 colors=list(rom[0x36ca2+(132 if red else 136):0x36ca2+(136 if red else 140)])
 for frame in range(2):
  im=Image.new('RGBA',(16,32));left=(48 if fire else 32)+frame*4;right=left+2 if fire else left
  im.paste(column(left,colors),(0,0));im.paste(column(right,colors,not fire),(8,0));stemColors=list(rom[0x36ca2+136:0x36ca2+140]);im.paste(column(34,stemColors),(0,16));im.paste(column(34,stemColors,True),(8,16))
  target=311+style*2+frame;atlas.paste(im,(target%32*16,target//32*32))
atlas.save(root/'assets/sprites.png')
(root/'assets/plant-provenance.json').write_text(json.dumps({'romSHA256':hashlib.sha256(rom).hexdigest(),'chrBank':79,'paletteBase':0x36ca2,'plainHeadPatterns':[0xe1,0xe5],'fireHeadPatterns':[0xf1,0xf3,0xf5,0xf7],'stemPattern':0xe3,'atlasFrames':[311,312,313,314,315,316],'behaviourReference':'Southbird PRG005 Piranha_Emerge/Attack/Retract/HideInPipe/SpitFire'},indent=2))

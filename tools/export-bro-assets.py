# ROM brother and boomerang CHR assets. Southbird PRG004 ObjP82 and PRG007.
from pathlib import Path
from PIL import Image
import sys,json,hashlib
root=Path(__file__).resolve().parents[1];rom=Path(sys.argv[1]).read_bytes();pal=Path(sys.argv[2]).read_bytes();ch=rom[262160:]
assert hashlib.sha256(rom).hexdigest()=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579'
def column(pattern,colors):
 im=Image.new('RGBA',(8,16));t=pattern&0x3e
 for y in range(16):
  off=78*1024+(t+y//8)*16;yy=y%8
  for x in range(8):
   v=((ch[off+yy]>>(7-x))&1)|(((ch[off+yy+8]>>(7-x))&1)<<1)
   if v:im.putpixel((x,y),(*pal[colors[v]*3:colors[v]*3+3],255))
 return im
frames=[[0xb1,0xb3,0xb5,0xb7],[0xb1,0xb3,0xa5,0xa7],[0xbd,0xbf,0xb5,0xb7],[0xbd,0xbf,0xa5,0xa7]]
colors=list(rom[0x36ca2+136:0x36ca2+140]);sheet=Image.new('RGBA',(128,32))
for frame,patterns in enumerate(frames):
 im=Image.new('RGBA',(16,32))
 for q,p in enumerate(patterns):im.paste(column(p,colors),(q%2*8,q//2*16))
 sheet.paste(im,(frame*16,0));sheet.paste(im.transpose(Image.Transpose.FLIP_LEFT_RIGHT),((frame+4)*16,0))
sheet.save(root/'assets/bros.png')
colors=list(rom[0x36ca2+132:0x36ca2+136]);sheet=Image.new('RGBA',(64,16));patterns=[0x8b,0x8f,0x89,0x8d,0x8b,0x8f]
for frame in range(4):
 im=Image.new('RGBA',(16,16));im.paste(column(patterns[frame],colors),(0,0));im.paste(column(patterns[frame+2],colors),(8,0))
 if frame<2:im=im.transpose(Image.Transpose.ROTATE_180)
 sheet.paste(im,(frame*16,0))
sheet.save(root/'assets/boomerang.png')
(root/'assets/bro-provenance.json').write_text(json.dumps({'romSHA256':hashlib.sha256(rom).hexdigest(),'chrBank':78,'frames':frames,'broPaletteOffset':0x36ca2+136,'boomerangPaletteOffset':0x36ca2+132,'boomerangPatterns':patterns,'reference':'Southbird PRG004 ObjP82 / EnemyBro_DrawAndHandleBump and PRG007 Boomerang_Patterns'},indent=2))

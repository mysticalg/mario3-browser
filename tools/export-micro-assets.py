# Original Microgoomba and animated bomber wing CHR. Southbird PRG004/007.
from pathlib import Path
from PIL import Image
import sys,json,hashlib
root=Path(__file__).resolve().parents[1];rom=Path(sys.argv[1]).read_bytes();pal=Path(sys.argv[2]).read_bytes();ch=rom[262160:]
assert hashlib.sha256(rom).hexdigest()=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579'
def column(pattern,colors):
 im=Image.new('RGBA',(8,16));t=pattern&0x3e
 for y in range(16):
  off=79*1024+(t+y//8)*16;yy=y%8
  for x in range(8):
   v=((ch[off+yy]>>(7-x))&1)|(((ch[off+yy+8]>>(7-x))&1)<<1)
   if v:im.putpixel((x,y),(*pal[colors[v]*3:colors[v]*3+3],255))
 return im
column(0xff,list(rom[0x36ca2+140:0x36ca2+144])).save(root/'assets/microgoomba.png')
sheet=Image.new('RGBA',(40,16));colors=list(rom[0x36ca2+136:0x36ca2+140])
for n,pattern in enumerate([0xcf,0xcd]):
 im=column(pattern,colors);sheet.paste(im.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(n*20,0));sheet.paste(im,(n*20+12,0))
sheet.save(root/'assets/bomber-wings.png')
(root/'assets/micro-provenance.json').write_text(json.dumps({'romSHA256':hashlib.sha256(rom).hexdigest(),'chrBank':79,'microPattern':255,'microPaletteOffset':0x36ca2+140,'wingPatterns':[207,205],'wingPaletteOffset':0x36ca2+136,'wingOffsets':[-2,10],'wingYOffset':-10,'reference':'Southbird PRG004 ParaGoomba_Draw / PRG007 Microgoomba_Draw'},indent=2))

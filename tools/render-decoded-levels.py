# Render decoder research output with original metatiles, CHR and palette.
from pathlib import Path
from PIL import Image
import json,sys,hashlib
if len(sys.argv)<4:raise SystemExit('Usage: python tools/render-decoded-levels.py your-rom.nes FCEUX.pal decoded-output-dir')
rom=Path(sys.argv[1]).read_bytes();pal=Path(sys.argv[2]).read_bytes();out=Path(sys.argv[3]);ch=rom[262160:]
assert len(pal)==192
palettes={'plains':0x36ca2,'hills':rom.find(bytes.fromhex('3c 0f 30 3c 3c 0f 36 27 3c 0f 2a 1a 3c 0f 2a 12'))}
for p in sorted(out.glob('*.json')):
 level=json.loads(p.read_text());
 if 'course' not in level:continue
 assert hashlib.sha256(rom).hexdigest()==level['provenance']['romSHA256']
 render=level['render'];base=16+render['layoutBank']*8192;layout=rom[base:base+1024]
 paletteOffset=palettes[render['paletteSet']]+render['paletteIndex']*16;assert paletteOffset>=0
 colors=rom[paletteOffset:paletteOffset+16];atlas=[]
 for t in range(256):
  tile=Image.new('RGB',(16,16))
  for q in range(4):
   pattern=layout[q*256+t];off=render['chrPages'][pattern//128]*1024+(pattern%128)*16
   for y in range(8):
    for x in range(8):
     v=((ch[off+y]>>(7-x))&1)|(((ch[off+y+8]>>(7-x))&1)<<1);c=colors[(t>>6)*4+v]
     tile.putpixel(((q//2)*8+x,(q%2)*8+y),tuple(pal[c*3:c*3+3]))
  atlas.append(tile)
 scene=Image.new('RGB',(level['playableWidth'],level['height']*16))
 for i,t in enumerate(level['tiles']):
  x=i%level['width']*16;y=i//level['width']*16
  if x<scene.width:scene.paste(atlas[t],(x,y))
 scene.save(out/(p.stem+'.png'),optimize=True)
 scene.crop((0,208,768,432)).save(out/(p.stem+'-start.png'),optimize=True)
 print(p.stem,'rendered',scene.size,'palette',hex(paletteOffset))

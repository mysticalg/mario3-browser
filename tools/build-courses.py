# Build playable course assets from the original decoder outputs.
from pathlib import Path
from PIL import Image
import json,sys
root=Path(__file__).resolve().parents[1];rom=Path(sys.argv[1]).read_bytes();pal=Path(sys.argv[2]).read_bytes();ch=rom[262160:];out=root/'assets/courses';out.mkdir(exist_ok=True)
for name in ['1-2','1-3']:
 src=json.loads((root/f'research/levels/{name}.json').read_text());render=src['render'];bank=render['layoutBank'];layout=rom[16+bank*8192:16+bank*8192+1024];base=0x36e22 if name=='1-2' else 0x36ca2;colors=rom[base:base+16]
 atlas=Image.new('RGBA',(512,320));tileImages=[]
 for t in range(256):
  im=Image.new('RGBA',(16,16))
  for q in range(4):
   pat=layout[q*256+t];off=render['chrPages'][pat//128]*1024+(pat%128)*16
   for y in range(8):
    for x in range(8):
     v=((ch[off+y]>>(7-x))&1)|(((ch[off+y+8]>>(7-x))&1)<<1);c=colors[(t>>6)*4+v]
     im.putpixel(((q//2)*8+x,(q%2)*8+y),(*pal[c*3:c*3+3],255 if v else 0))
  tileImages.append(im);atlas.paste(im,(t%32*16,t//32*32))
 skyId=2 if name=='1-2' else 0x80;attrs=[0x25,0x5f,0x99,0xe2,0x2e,0x5f,0xa6,0xf0] if name=='1-2' else [0x25,0x50,0xa0,0xe2,0x2d,0x53,0xad,0xf0]
 tiles=[skyId]*4096;solid=[0]*4096;sky=[];coins=[];scene=Image.new('RGBA',(4096,256));dynamic=[0x2e,0x2f,0x30,0x31,0xbc,0x60,0x61,0x63,0x65,0x67,0x68,0x69,0x6b,0x6e,0x70];kinds={0x2e:10,0x2f:10,0x30:10,0x31:10,0xbc:10,0x60:8,0x61:4,0x63:3,0x65:3,0x67:2,0x68:8,0x69:4,0x6b:3,0x6e:6,0x70:7}
 for i,t in enumerate(src['tiles']):
  tx=i%240;ty=i//240-13
  if tx*16>=src['playableWidth']:continue
  quad=t>>6;kind=0 if t<attrs[quad] else (5 if t<attrs[quad+4] else 1)
  shape=src['slopes']['tileShape'][t] if src['slopes'] else 0
  if shape in [1,2,12,13,14,15]:kind=9
  if t in kinds:kind=kinds[t]
  if t==0x40:coins.append([tx*16,ty*16]);t=skyId;kind=0
  if ty<0:
   if t!=skyId:sky.append({'tx':tx,'ty':ty,'id':t,'solid':kind})
  else:
   tiles[ty*256+tx]=t;solid[ty*256+tx]=kind
   if t not in dynamic:scene.paste(tileImages[t],(tx*16,ty*16),tileImages[t])
 objects=[];metadata=[];unsupported=[];spawners=[]
 for o in src['objects']:
  id=o['id'];kind={0x72:1,0x73:4,0x74:4,0x6c:2,0x6d:2,0x6e:5,0xa0:3,0xa4:3,0xa6:3}.get(id)
  if kind:
   objects.append([kind,o['x'],o['y']-208-(16 if kind in [2,5] else 0)]);metadata.append({'romId':id,'red':id==0x6d})
  elif id in [0xc0,0xc1]:spawners.append({'romId':id,'x':o['x'],'y':o['y']-208,'direction':1 if id==0xc1 else -1})
  elif id!=0x41:unsupported.append(o)
 goal=next(o for o in src['objects'] if o['id']==0x41)
 level={'id':name,'spawn':{'x':24,'y':176 if name=='1-2' else 192},'width':4096,'height':256,'playableWidth':src['playableWidth'],'tiles':tiles,'solid':solid,'sky':sky,'coins':coins,'objects':objects,'objectMetadata':metadata,'pipes':[],'goal':{'x':goal['x']-8,'y':goal['y']-216},'slopes':src['slopes'],'emptyTile':skyId,'music':'athletic' if name=='1-2' else 'overworld','spawners':spawners,'unsupportedObjects':unsupported,'provenance':src['provenance']}
 (out/f'{name}.json').write_text(json.dumps(level,separators=(',',':')));atlas.save(out/f'{name}-tiles.png');scene.save(out/f'{name}-world.png',optimize=True)
 print(name,'enemies',len(objects),'remaining object variants',len(unsupported),'coins',len(coins))

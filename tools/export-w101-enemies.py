from pathlib import Path
import json,hashlib,sys
from PIL import Image
root=Path(__file__).resolve().parents[1]
rom=Path(sys.argv[1]).read_bytes();pal=Path(sys.argv[2]).read_bytes()
assert hashlib.sha256(rom).hexdigest()=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579'
off=0xc537;assert rom[off]==1
records=[];p=off+1
while rom[p]!=255:
 id,x,y=rom[p:p+3];records.append({'romId':id,'column':x,'row':y,'red':id==0x6d});p+=3
level=json.loads((root/'assets/level.json').read_text())
assert len(records)==len(level['objects'])+1 and records[-1]['romId']==0x41
for record,obj in zip(records,level['objects']):
 assert record['column']*16==obj[1]
level['objectMetadata']=records[:-1]
level['objectProvenance']={'romSHA256':hashlib.sha256(rom).hexdigest(),'streamOffset':off,'streamBytes':p-off+1,'records':records}
(root/'assets/level.json').write_text(json.dumps(level,separators=(',',':')))
atlas=Image.open(root/'assets/sprites.png').convert('RGBA')
green=tuple(pal[0x2a*3:0x2a*3+3]);red=tuple(pal[0x16*3:0x16*3+3])
for source,target in [(284,308),(285,309),(286,310)]:
 im=atlas.crop((source%32*16,source//32*32,source%32*16+16,source//32*32+32))
 im.putdata([(*red,v[3]) if v[:3]==green else v for v in im.getdata()])
 atlas.paste(im,(target%32*16,target//32*32))
atlas.save(root/'assets/sprites.png')
print('Extracted',len(records),'ROM objects; red Koopas:',sum(r['red'] for r in records))

# ROM-derived World 1-1 bonus / sky exporter. Requires Pillow.
# Geometry reference: Southbird SMB3 disassembly, PRG014/015/026.
from pathlib import Path
from PIL import Image
import re,json,hashlib,sys
if len(sys.argv)!=3:raise SystemExit('Usage: python tools/export-w101-bonus.py your-rom.nes FCEUX.pal')
root=Path(__file__).resolve().parents[1]/'assets';rom=Path(sys.argv[1]).read_bytes();pal=Path(sys.argv[2]).read_bytes();chr=rom[262160:];sky={}
offset=0x1FB9B
stream=rom[offset:offset+264]
assert stream[:3]==bytes((0,0,3)) and stream[-1]==255
tiles=[[0x80]*256 for _ in range(16)]
solid=[[0]*256 for _ in range(16)]
coin_positions=[];commands=[]
def put(x,row,t,kind=0):
    yy=row-13
    if 0<=x<256 and -24<=yy<0:sky[(x,yy)]={'tx':x,'ty':yy,'id':t,'solid':kind}
    if 0<=x<256 and 0<=yy<16:
        tiles[yy][x]=t;solid[yy][x]=kind
def bigblock(x,row,w,color,floating=False):
    top=[[0x26,0x25,0x27],[0x51,0x50,0x52],[0xA1,0xA0,0xA2],[0xE3,0xE2,0xE4]][color]
    mid=[[7,9,8],[0x47,0x49,0x48],[0x87,0x89,0x88],[0xC7,0xC9,0xC8]][color]
    bot=[[0x0D,0x0A,0x0E],[0x4D,0x4A,0x4E],[0x8D,0x8A,0x8E],[0xCD,0xCA,0xCE]][color]
    end=min(26,row+3) if floating else 26
    for xx in range(w+1):
        col=0 if xx==0 else 2 if xx==w else 1
        for rr in range(row,end):
            yy=rr-13
            if rr>row and 0<=yy<16 and solid[yy][x+xx]==1:break
            put(x+xx,rr,(top if rr==row else bot if rr==end-1 else mid)[col],5 if rr==row else 0)
def bush(x,row,w=4,h=4):
    for yy in range(h):
        for xx in range(w):
            t=(0x90 if xx==0 else 0x91 if xx==w-1 else 0x98) if yy==0 else (0x94 if xx==0 else 0x95 if xx==w-1 else 0x98)
            if 0<=row+yy-13<16 and solid[row+yy-13][x+xx]==0:put(x+xx,row+yy,t)
i=0
while stream[i]!=255:
    a,x,c=stream[i:i+3];i+=3
    if a>>5==7:commands.append({'junction':[a,x,c]});continue
    row=a&31;w=c&15;fixed=(c>>4)==0
    g=(a>>5)*16+w if fixed else (a>>5)*15+(c>>4)-1
    extra=None
    if not fixed and g in (11,12,35,36,37,38,39,40,41,42):extra=stream[i];i+=1
    commands.append({'kind':'fixed' if fixed else 'run','generator':g,'x':x,'row':row,'width_param':w,'extra':extra})
    if fixed:
        if g in (0,1,2):bush(x,row,5 if g==0 else 4 if g==1 else 6,4 if g==0 else 3 if g==1 else 8)
        elif g==3:pass # Random high-altitude coin clouds are outside this viewport.
        elif g==17:put(x,row,0x61,4)
        elif g==27:put(x,row,0x6E,6)
        elif g==29:put(x,row,0x70,7)
        elif g==41:
            for xx in range(x,176):
                for rr in range(13,26):put(xx,rr,0xFF)
                put(xx,26,0x53,1);put(xx,27,0x54,1)
        else:raise ValueError(('unhandled fixed generator',g))
    elif g<=7:bigblock(x,row,w,g%4,g>=4)
    elif g==8:
        for xx in range(w+1):put(x+xx,row,0x86)
    elif g==9:
        for xx in range(w+1):
            for rr in range(row,29):put(x+xx,rr,0x80)
    elif g==10:
        for xx in range(w+1):put(x+xx,row,0x2C,5)
    elif g==11:
        for xx in range(extra+1):
            for yy in range(w+2):put(x+xx,row+yy,(0x55 if xx==0 else 0x57 if xx==extra else 0x53) if yy==0 else (0x56 if xx==0 else 0x58 if xx==extra else 0x54),1)
    elif g==13:
        for xx in range(w+2):
            put(x+xx,row,0x1F if xx==0 else 0x21 if xx==w+1 else 0x20)
            put(x+xx,row+1,0x22 if xx==0 else 0x24 if xx==w+1 else 0x23)
    elif g in (15,16,18,22):
        for xx in range(w+1):
            if g==22:coin_positions.append(((x+xx)*16,row*16-208));continue
            put(x+xx,row,{15:0x67,16:0x63,18:0x79}[g],{15:2,16:3,18:1}[g])
    elif g in (23,24):
        for yy in range(w+1):
            put(x,row+yy,0xAD if yy==0 else 0xBA,1);put(x+1,row+yy,0xAE if yy==0 else 0xBB,1)
    else:raise ValueError(('unhandled run generator',g))

sky=list(sky.values());(root/'sky.json').write_text(json.dumps(sky,separators=(',',':')))
# Match the alternate room's source stream against bytes in this exact ROM.
mainHeader=0x1fb92;cpu=int.from_bytes(rom[mainHeader:mainHeader+2],'little');offset=16+15*8192+cpu-0xa000+9
assert rom[offset:offset+4]==bytes([0x4f,0,0xbb,7])
b=list(rom[offset:offset+128])
solid=[0]*4096;tiles=[0x80]*4096;coins=[];pipes=[];commands=[]
def put(x,row,t,kind=1):
 y=row-13
 if 0<=x<32 and 0<=y<16:tiles[y*256+x]=t;solid[y*256+x]=kind
i=0
while b[i]!=255:
 a,x,c=b[i:i+3];i+=3
 if a>>5==7:commands.append({'junction':[a,x,c]});continue
 row=a&31;w=c&15;g=(a>>5)*15+(c>>4)-1
 extra=None
 if g in [11,12,35,36,37,38,39,40,41,42]:extra=b[i];i+=1
 commands.append({'g':g,'x':x,'row':row,'w':w,'extra':extra})
 if g==40:
  for xx in range(x,x+extra+1):
   for yy in range(row,row+w+1):put(xx,yy,0xf0)
 elif g==22:
  for xx in range(x,x+w+1):coins.append([xx*16,(row-13)*16])
 elif g in (26,27):
  for yy in range(w):put(x,row+yy,0xba);put(x+1,row+yy,0xbb)
  put(x,row+w,0xad if g==26 else 0xb1);put(x+1,row+w,0xae if g==26 else 0xb2)
  if g==26:pipes.append({'x':x*16,'y':(row+w-13)*16+16,'direction':'up','target':'main','spawnX':2328,'spawnY':176,'exit':'up'})
 else:raise ValueError(('Unsupported original generator',g))
bonus={'width':4096,'playableWidth':512,'height':256,'tiles':tiles,'solid':solid,'coins':coins,'objects':[],'pipes':pipes,'sky':[],'music':'underground','provenance':{'ROM_SHA256':hashlib.sha256(rom).hexdigest(),'streamOffset':offset,'streamBytes':i+1,'mainHeaderOffset':mainHeader,'alternateCPUAddress':cpu,'PRGBank':15,'commands':commands,'junction':[0xe1,0x71,0x19]}}
(root/'bonus.json').write_text(json.dumps(bonus,separators=(',',':')))
layout=rom[16+15*8192:16+15*8192+1024];palette=rom[0x36ca2+5*16:0x36ca2+6*16];atlas=Image.new('RGBA',(512,256));scene=Image.new('RGBA',(4096,256),(0,0,0,255))
for t in range(256):
 im=Image.new('RGBA',(16,16))
 for q in range(4):
  pattern=layout[q*256+t];off=(8 if pattern<128 else 96)*1024+(pattern%128)*16
  for y in range(8):
   for x in range(8):
    value=((chr[off+y]>>(7-x))&1)|(((chr[off+y+8]>>(7-x))&1)<<1);color=palette[(t>>6)*4+value]
    im.putpixel(((q//2)*8+x,(q%2)*8+y),(*pal[color*3:color*3+3],255))
 atlas.paste(im,((t%32)*16,(t//32)*32))
 for off,id in enumerate(tiles):
  if id==t and off%256<32:scene.paste(im,((off%256)*16,(off//256)*16))
atlas.save(root/'bonus-tiles.png',optimize=True);scene.save(root/'bonus-world.png',optimize=True)
print('ROM bonus stream:',hex(offset),'coins:',len(coins),'sky tiles:',len(sky),'pipes:',pipes)

main=json.loads((root/'level.json').read_text());main['bonus']=bonus;main['sky']=sky;main['pipes']=[{'x':2256,'y':-96,'direction':'down','target':'bonus','spawnX':136,'spawnY':64,'exit':'down'}];(root/'level.json').write_text(json.dumps(main,separators=(',',':')))

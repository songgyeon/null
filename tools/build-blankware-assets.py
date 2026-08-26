from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math, random

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "blankware"
OUT.mkdir(parents=True, exist_ok=True)
S = 1024

def canvas(seed=0):
    random.seed(seed)
    im=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(im,"RGBA")
    for y in range(S):
        t=y/(S-1); c=(int(242+9*t),int(237+12*t),255,int(248-12*t))
        d.line((0,y,S,y),fill=c)
    for _ in range(35):
        x=random.randrange(S); y=random.randrange(S); r=random.randrange(2,9)
        d.ellipse((x-r,y-r,x+r,y+r),fill=(255,255,255,random.randrange(45,130)))
    return im,d

def glass(d, box, radius=42, fill=(255,250,255,205), outline=(132,101,190,235), w=5):
    x0,y0,x1,y1=box
    d.rounded_rectangle((x0+12,y0+18,x1+12,y1+18),radius,fill=(106,74,158,38))
    d.rounded_rectangle(box,radius,fill=fill,outline=outline,width=w)
    d.rounded_rectangle((x0+12,y0+12,x1-12,y0+82),max(18,radius-12),fill=(227,213,252,225))
    d.line((x0+12,y0+82,x1-12,y0+82),fill=(126,98,180,170),width=3)
    for i,c in enumerate(((255,132,184,230),(255,220,128,230),(139,218,217,230))):
        cx=x1-48-i*34; d.ellipse((cx-10,y0+34,cx+10,y0+54),fill=c,outline=(102,76,148,170),width=2)

def sparkle(d,x,y,r=26,c=(255,255,255,235)):
    d.polygon([(x,y-r),(x+r//4,y-r//4),(x+r,y),(x+r//4,y+r//4),(x,y+r),(x-r//4,y+r//4),(x-r,y),(x-r//4,y-r//4)],fill=c)

def save(name, painter, seed):
    im,d=canvas(seed); painter(im,d); im.save(OUT/name,optimize=True)

def window(title=False,wide=False,error=False):
    def p(im,d):
        box=(100,245 if wide else 150,924,765 if wide else 860); glass(d,box,48)
        if error:
            d.rounded_rectangle((180,390,844,675),30,fill=(255,238,250,210),outline=(215,104,160,210),width=4)
            d.ellipse((235,470,325,560),fill=(255,157,196,230)); d.line((280,490,280,535),fill="white",width=10); d.ellipse((274,543,286,555),fill="white")
        else:
            for i in range(5): d.rounded_rectangle((185,365+i*64,835,395+i*64),15,fill=(209-i*7,194+i*4,242,105))
        if title:
            for x,y in ((145,115),(870,175),(825,825),(135,830)): sparkle(d,x,y,26,(255,255,255,210))
    return p

def heart(im,d):
    pts=[]
    for i in range(360):
        t=math.radians(i); x=16*math.sin(t)**3; y=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
        pts.append((512+x*22,500-y*22))
    d.polygon(pts,fill=(244,151,203,235),outline=(119,89,169,255))
    sparkle(d,430,360,45); sparkle(d,630,445,25)

def button(im,d):
    d.rounded_rectangle((170,370,854,660),80,fill=(113,79,162,40))
    d.rounded_rectangle((155,345,839,635),80,fill=(244,225,255,245),outline=(119,88,174,255),width=7)
    d.rounded_rectangle((190,380,804,470),45,fill=(255,255,255,160))
    for x in range(270,760,95): sparkle(d,x,545,18,(255,255,255,210))

def cd(im,d):
    d.ellipse((170,170,854,854),fill=(211,195,244,240),outline=(112,84,165,255),width=8)
    for r,c in ((280,(255,167,209,90)),(210,(130,222,225,100)),(145,(255,244,170,100))): d.ellipse((512-r,512-r,512+r,512+r),outline=c,width=34)
    d.ellipse((420,420,604,604),fill=(246,240,255,255),outline=(112,84,165,255),width=6); sparkle(d,310,290,42)

def meter(im,d):
    glass(d,(100,290,924,735),42)
    d.rounded_rectangle((165,470,859,590),28,fill=(255,255,255,190),outline=(123,93,177,220),width=5)
    for i in range(12):
        x=184+i*54; d.rounded_rectangle((x,488,x+38,572),12,fill=((246,151+i*3,203,235) if i<8 else (226,218,244,160)))
    sparkle(d,820,410,24)

def sticker(kind):
    def p(im,d):
        if kind=="star":
            pts=[]
            for i in range(16):
                a=-math.pi/2+i*math.pi/8; r=270 if i%2==0 else 150; pts.append((512+math.cos(a)*r,512+math.sin(a)*r))
            d.polygon(pts,fill=(217,191,255,245),outline=(103,75,155,255)); sparkle(d,450,420,55)
        elif kind=="cursor":
            d.rounded_rectangle((240,240,784,784),80,fill=(207,188,250,210),outline=(106,78,162,255),width=8)
            for q in ((350,350),(660,360),(510,600)): sparkle(d,*q,42)
        else:
            for i,(x,y,r,c) in enumerate(((390,520,190,(245,161,208,220)),(585,470,165,(185,218,244,210)),(545,630,130,(223,194,250,210)))): d.ellipse((x-r,y-r,x+r,y+r),fill=c,outline=(119,89,169,190),width=5)
            sparkle(d,500,370,35)
    return p

def map_asset(im,d):
    d.polygon([(140,290),(375,220),(650,300),(884,225),(884,755),(650,825),(375,745),(140,820)],fill=(248,240,255,245),outline=(111,83,162,255))
    d.line((375,220,375,745),fill=(139,108,190,170),width=5); d.line((650,300,650,825),fill=(139,108,190,170),width=5)
    path=[(205,650),(330,535),(470,590),(590,435),(760,510),(820,345)]; d.line(path,fill=(242,122,184,235),width=18,joint="curve")
    for x,y in path[::2]: d.ellipse((x-22,y-22,x+22,y+22),fill=(255,255,255,255),outline=(111,83,162,255),width=5)

def icon(kind):
    def p(im,d):
        if kind=="chat":
            glass(d,(145,215,785,695),44); glass(d,(270,340,900,820),44)
        elif kind=="camera":
            d.rounded_rectangle((170,310,854,745),70,fill=(220,201,250,245),outline=(104,77,158,255),width=8); d.rounded_rectangle((270,240,475,350),35,fill=(239,224,255,255),outline=(104,77,158,255),width=6); d.ellipse((350,365,675,690),fill=(145,119,198,255),outline=(255,255,255,220),width=22); d.ellipse((425,440,600,615),fill=(80,70,128,255)); sparkle(d,705,390,28)
        elif kind=="folder":
            d.rounded_rectangle((145,325,879,775),55,fill=(218,195,250,245),outline=(104,77,158,255),width=8); d.rounded_rectangle((205,240,535,380),45,fill=(229,210,255,255),outline=(104,77,158,255),width=7); d.rounded_rectangle((430,450,650,675),42,fill=(255,244,251,240),outline=(192,100,151,255),width=6); d.arc((475,365,605,535),180,360,fill=(192,100,151,255),width=18)
        elif kind=="bag":
            d.rounded_rectangle((190,330,834,790),80,fill=(219,197,251,245),outline=(104,77,158,255),width=8); d.arc((330,170,694,520),180,360,fill=(104,77,158,255),width=24); d.rounded_rectangle((260,470,764,650),35,fill=(255,242,251,190)); sparkle(d,710,385,30)
        elif kind=="gift":
            d.rounded_rectangle((185,385,839,800),50,fill=(246,185,220,245),outline=(107,79,161,255),width=8); d.rectangle((470,385,555,800),fill=(213,190,250,235)); d.rectangle((185,330,839,465),fill=(232,211,255,245),outline=(107,79,161,255),width=7); d.ellipse((300,205,500,400),fill=(247,184,220,235),outline=(107,79,161,255),width=7); d.ellipse((525,205,725,400),fill=(247,184,220,235),outline=(107,79,161,255),width=7)
    return p

assets={
"window-empty-frame.png":window(),"window-transparent-frame.png":window(wide=True),"sticker-fill-heart.png":heart,"button-fill-blank.png":button,"sticker-blank-cd.png":cd,
"name-fill-meter.png":meter,"screen-null-empty.png":window(wide=True),"canvas-null-empty.png":window(),"button-pastel.png":button,"sticker-opal-star.png":sticker("star"),
"cursor-square-sparkle.png":sticker("cursor"),"sticker-pixel-bubbles.png":sticker("bubble"),"window-error-empty.png":window(error=True),"window-system-error.png":window(error=True,title=True),
"window-loading-wide.png":window(wide=True,title=True),"map-folded.png":map_asset,"messenger-windows.png":icon("chat"),"camera-retro.png":icon("camera"),"hidden-folder-lock.png":icon("folder"),
"bag-items.png":icon("bag"),"gift-ribbon-box.png":icon("gift"),"window-main-glossy.png":window(title=True),"window-opening-null.png":window(title=True,wide=True)}

for i,(name,painter) in enumerate(assets.items()): save(name,painter,100+i)
print(f"wrote {len(assets)} assets to {OUT}")

# ChatGPTの絵（白背景）を透過してwebpにする。表情シート（2行×4列）は表情ごとに切り出す
# 使い方: python3 scripts/cut_art.py <元画像フォルダ> src/assets/art
import sys
from PIL import Image, ImageFilter
from collections import deque
raw, out = sys.argv[1], sys.argv[2]
EXPR = ['normal','smile','laugh','surprise','down','angry','think','shy']
def unwhite(im, tol=30):
    # 線画を2pxふくらませて壁にし、外側の白だけを塗りつぶす（線のすき間から服の白へ漏れないように）
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    ink = im.convert('L').point(lambda v: 255 if v < 215 else 0).filter(ImageFilter.MaxFilter(5)).load()
    bg = bytearray(w*h); q = deque()
    for x in range(w): q.append((x,0))
    for y in range(h): q.append((0,y)); q.append((w-1,y))
    while q:
        x,y = q.popleft()
        if x<0 or y<0 or x>=w or y>=h or bg[y*w+x] or ink[x,y]: continue
        bg[y*w+x] = 1
        q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
    def white(x,y):
        r,g,b,a = px[x,y]; return r>255-tol and g>255-tol and b>255-tol
    for _ in range(3):  # ふくらませた分の白い縁を取り戻す
        add = [(x,y) for y in range(h) for x in range(w) if not bg[y*w+x] and white(x,y) and any(0<=x+dx<w and 0<=y+dy<h and bg[(y+dy)*w+x+dx] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))]
        for x,y in add: bg[y*w+x] = 1
    for y in range(h):
        for x in range(w):
            if bg[y*w+x]: px[x,y] = (255,255,255,0)
    for y in range(h):
        for x in range(w):
            r,g,b,a = px[x,y]
            if a and r>220 and g>220 and b>220 and any(0<=x+dx<w and 0<=y+dy<h and bg[(y+dy)*w+x+dx] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                px[x,y] = (r,g,b,110)
    return im
def finish(c):
    # 胸元の下の白い余白を先に落とす（服の白と背景がつながらないように）
    g = c.convert('L').load(); cw2, ch2 = c.size
    rows = [y for y in range(ch2) if sum(1 for x in range(cw2) if g[x,y] < 235) > cw2*0.35]
    c = c.crop((0, 0, cw2, rows[-1] - 3))
    c = unwhite(c)
    bb = c.getbbox(); c = c.crop((bb[0], bb[1], bb[2], c.size[1]))
    c.thumbnail((400, 400))
    return c

import glob, os
# 表情シートがある人は8コマに分ける。立ち絵しかない人は「ふつう」だけ作る（ほかの表情は「ふつう」で代用される）
for path in sorted(glob.glob(f'{raw}/ch_*_sheet.png')):
    ch = os.path.basename(path)[3:-len('_sheet.png')]
    sheet = Image.open(path)
    W,H = sheet.size; cw, chh = W//4, H//2
    for i,e in enumerate(EXPR):
        finish(sheet.crop(((i%4)*cw, (i//4)*chh, (i%4+1)*cw, (i//4+1)*chh))).save(f'{out}/{ch}_{e}.webp', quality=82, method=6)
for path in sorted(glob.glob(f'{raw}/ch_*_stand.png')):
    ch = os.path.basename(path)[3:-len('_stand.png')]
    if os.path.exists(f'{raw}/ch_{ch}_sheet.png'): continue
    for old in glob.glob(f'{out}/{ch}_*.webp'): os.remove(old)
    finish(Image.open(path)).save(f'{out}/{ch}_normal.webp', quality=82, method=6)
for path in sorted(glob.glob(f'{raw}/bg_*.png')):
    bg = Image.open(path).convert('RGB'); bg.thumbnail((960,960))
    bg.save(f"{out}/{os.path.basename(path)[:-4]}.webp", quality=78, method=6)

# ChatGPTの絵（白背景）を透過してwebpにする。表情シート（2行×4列）は表情ごとに切り出す
# 使い方: python3 scripts/cut_art.py <元画像フォルダ> src/assets/art
import sys
from PIL import Image, ImageFilter
from collections import deque
raw, out = sys.argv[1], sys.argv[2]
EXPR = ['normal','smile','laugh','surprise','down','angry','think','shy']
def unwhite(im, tol=30, guard_body=False):
    # 線画を2pxふくらませて壁にし、外側の白だけを塗りつぶす（線のすき間から服の白へ漏れないように）
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    ink = im.convert('L').point(lambda v: 255 if v < 215 else 0).filter(ImageFilter.MaxFilter(5)).load()
    bg = bytearray(w*h); q = deque()
    # guard_body: 胸から下（体が横幅いっぱいに広がる行より下）では、体の左右の端より外側だけを背景にする。
    # 白いTシャツが線の切れ目で背景とつながっている人用。髪が横に広い人に使うと、肩の脇に白が残る
    lum = im.convert('L').load()
    span = []
    for y in range(h):
        xs = [x for x in range(w) if lum[x,y] < 215]
        span.append((xs[0], xs[-1]) if xs else (w, -1))
    # ゴミの点や隣のコマの線で1行だけ幅が狂うので、上下15行の中央値でならし、胸から下は下へ行くほど広がるようにする
    def med(vals): return sorted(vals)[len(vals)//2]
    span = [(med([span[j][0] for j in range(max(0,y-7), min(h,y+8))]), med([span[j][1] for j in range(max(0,y-7), min(h,y+8))])) for y in range(h)]
    body = next((y for y in range(h) if span[y][1] - span[y][0] >= w*0.85), h)
    for y in range(body + 1, h):
        span[y] = (min(span[y][0], span[y-1][0]), max(span[y][1], span[y-1][1]))
    def allowed(x, y):
        return not guard_body or y < body or x < span[y][0] or x > span[y][1]
    for x in range(w): q.append((x,0))
    for y in range(h): q.append((0,y)); q.append((w-1,y))
    while q:
        x,y = q.popleft()
        if x<0 or y<0 or x>=w or y>=h or bg[y*w+x] or ink[x,y] or not allowed(x,y): continue
        bg[y*w+x] = 1
        q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
    def white(x,y):
        r,g,b,a = px[x,y]; return r>255-tol and g>255-tol and b>255-tol
    # 線をふくらませた分、髪の毛先のすき間などに白が残る。背景から白い画素だけをたどって取り戻す。
    # 首から上（体が横いっぱいに広がる行より上）は深く、それより下は浅くたどる（服の白に入り込まないように）
    def strict_white(x,y):
        r,g,b,a = px[x,y]; return r>238 and g>238 and b>238
    dist = {}
    q = deque((x,y,0) for y in range(h) for x in range(w) if bg[y*w+x])
    while q:
        x,y,d = q.popleft()
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny = x+dx,y+dy
            if nx<0 or ny<0 or nx>=w or ny>=h or bg[ny*w+nx] or not allowed(nx,ny): continue
            limit = 14 if ny < body else 3
            if d+1 > limit or not (white(nx,ny) if d < 3 else strict_white(nx,ny)): continue
            bg[ny*w+nx] = 1
            q.append((nx,ny,d+1))
    for y in range(h):
        for x in range(w):
            if bg[y*w+x]: px[x,y] = (255,255,255,0)
    for y in range(h):
        for x in range(w):
            r,g,b,a = px[x,y]
            if a and r>220 and g>220 and b>220 and any(0<=x+dx<w and 0<=y+dy<h and bg[(y+dy)*w+x+dx] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                px[x,y] = (r,g,b,255)
    return im
# 白いTシャツの輪郭が切れていて、ふつうに抜くと服まで透ける人
GUARD_BODY = {'nakaji', 'dojima'}

def finish(c, guard_body=False):
    # 胸元の下の白い余白を先に落とす（服の白と背景がつながらないように）
    g = c.convert('L').load(); cw2, ch2 = c.size
    rows = [y for y in range(ch2) if sum(1 for x in range(cw2) if g[x,y] < 235) > cw2*0.35]
    c = c.crop((0, 0, cw2, rows[-1] - 3))
    c = unwhite(c, guard_body=guard_body)
    bb = c.getbbox(); c = c.crop((bb[0], bb[1], bb[2], c.size[1]))
    c.thumbnail((400, 400))
    return clean(c)

def clean(c, ink=(34, 30, 30)):
    # 仕上げ。1) コマの境目に残った細い線やゴミを消す 2) 輪郭の白いにじみを透明へなじませる
    # 3) コマの端で体が切れている辺に、腕の線に見えるよう線を引く（透明へぼかすと体が透けて見えるため）
    import numpy as np
    from scipy import ndimage
    a = np.array(c.convert('RGBA')).astype(np.float32)
    al = a[..., 3]
    lab, n = ndimage.label(al > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        main = int(np.argmax(sizes)) + 1
        for i, sl in enumerate(ndimage.find_objects(lab), start=1):
            if i == main: continue
            hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            edge = sl[0].start == 0 or sl[1].start == 0 or sl[1].stop == al.shape[1] or sl[0].stop == al.shape[0]
            if sizes[i - 1] < 12 or (edge and min(hh, ww) <= 4):
                al[lab == i] = 0
    # 背景に接する2px幅の白っぽい画素は、白を引いた分だけ透明にする（暗い背景で白い縁が出ないように）
    solid = al > 0
    near = ndimage.binary_dilation(~solid, iterations=2) & solid
    rgb = a[..., :3]
    lo = rgb.min(axis=2)
    k = np.clip((255 - lo) / 70.0, 0, 1)
    fr = near & (lo > 150)
    newa = np.where(fr, np.minimum(al, k * 255), al)
    kk = np.maximum(newa / 255.0, 1e-3)[..., None]
    un = np.clip((rgb - 255 * (1 - kk)) / kk, 0, 255)
    rgb = np.where(fr[..., None], un, rgb)
    al = newa
    # 輪郭のすぐ内側に残った明るい画素（髪のハイライトや服の白線が縁まで届いているところ）は墨色にする。
    # 透けたまま残すと、背景が抜けて髪や肩が欠けて見えるため。下端（胸元の切れ目）は除く
    solid = al > 0
    band = ndimage.binary_dilation(~solid, iterations=2) & solid
    band[-4:, :] = False
    lum = rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11
    light = band & (lum > 120)
    # 白いハイライトは縁から少し奥まで届いていることがあるので、無彩色の白だけはもう少し内側まで見る
    band4 = ndimage.binary_dilation(~solid, iterations=5) & solid
    band4[-4:, :] = False
    mn, mx = rgb.min(axis=2), rgb.max(axis=2)
    # 黒い髪の中の細い白だけを対象にする（はちまきやシャツのような広い白は残す）
    dark_around = ndimage.uniform_filter(lum, size=9) < 105
    light |= dark_around & band4 & (mn > 160) & (mx - mn < 40)
    rgb[light] = ink
    # 髪の白いハイライトが輪郭の近くにあると、明るい背景の上で髪が欠けて見える。上の方だけ灰色に落とす
    band10 = ndimage.binary_dilation(~(al > 0), iterations=10) & (al > 0) & ~light
    band10[int(al.shape[0] * 0.75):, :] = False
    mn, mx = rgb.min(axis=2), rgb.max(axis=2)
    hl = band10 & dark_around & (mn > 150) & (mx - mn < 20)
    rgb[hl] = (118, 118, 124)
    al = np.where(light, np.maximum(al, 200), al)
    h, w = al.shape
    for side in (0, w - 1):
        col = al[:, side] > 128
        if col.sum() < h * 0.12: continue
        xs = range(0, 3) if side == 0 else range(w - 3, w)
        for x in xs:
            m = al[:, x] > 128
            rgb[m, x] = ink
            al[m, x] = 255
    out = np.dstack([rgb, al]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

import glob, os
# 表情シートがある人は8コマに分ける。立ち絵しかない人は「ふつう」だけ作る（ほかの表情は「ふつう」で代用される）
# 主要キャラは2行4列の8表情、脇役は1行3列（ふつう・笑い・驚き）。真ん中あたりに真っ白な横1行があれば2行とみなす
SIDE = [('normal',), ('smile', 'laugh'), ('surprise',)]
for path in sorted(glob.glob(f'{raw}/ch_*_sheet.png')):
    ch = os.path.basename(path)[3:-len('_sheet.png')]
    sheet = Image.open(path)
    W,H = sheet.size
    g = sheet.convert('L')
    two_rows = any(g.crop((0, y, W, y + 1)).getextrema()[0] > 200 for y in range(int(H*0.4), int(H*0.6)))
    if two_rows:
        cw, chh = W//4, H//2
        cells = [(((i%4)*cw, (i//4)*chh, (i%4+1)*cw, (i//4+1)*chh), (e,)) for i,e in enumerate(EXPR)]
    else:
        cw = W//3
        cells = [((i*cw, 0, (i+1)*cw, H), names) for i,names in enumerate(SIDE)]
    for old in glob.glob(f'{out}/{ch}_*.webp'): os.remove(old)
    for box, names in cells:
        face = finish(sheet.crop(box), ch in GUARD_BODY)
        for e in names: face.save(f'{out}/{ch}_{e}.webp', quality=82, method=6)
for path in sorted(glob.glob(f'{raw}/ch_*_stand.png')):
    ch = os.path.basename(path)[3:-len('_stand.png')]
    if os.path.exists(f'{raw}/ch_{ch}_sheet.png'): continue
    for old in glob.glob(f'{out}/{ch}_*.webp'): os.remove(old)
    finish(Image.open(path), ch in GUARD_BODY).save(f'{out}/{ch}_normal.webp', quality=82, method=6)
for path in sorted(glob.glob(f'{raw}/bg_*.png')):
    bg = Image.open(path).convert('RGB'); bg.thumbnail((960,960))
    bg.save(f"{out}/{os.path.basename(path)[:-4]}.webp", quality=78, method=6)

# 今の切り抜き（400px）と同じ枠で、元絵から大きいまま切り直す
import sys, glob, os, importlib.util
import numpy as np, cv2
from PIL import Image
from scipy import ndimage
S = sys.argv[1]
spec = importlib.util.spec_from_file_location('ck', f'{S}/cut_key_hi.py'); ck = importlib.util.module_from_spec(spec); spec.loader.exec_module(ck)
ART = '/home/claude/waragaku/src/assets/art'
os.makedirs(f'{S}/match', exist_ok=True)
def white(rgba):
    a = rgba[..., 3:4] / 255.0
    return (rgba[..., :3] * a + 255 * (1 - a)).astype(np.uint8)
def clean(rgba):
    al = rgba[..., 3]
    lab, n = ndimage.label(al > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        main = int(np.argmax(sizes)); keep = []
        for i, sl in enumerate(ndimage.find_objects(lab)):
            touches = sl[0].start == 0 or sl[1].start == 0 or sl[1].stop == al.shape[1]
            if i == main or (sizes[i] >= 40 and not (touches and sizes[i] < sizes[main] * 0.05)): keep.append(i + 1)
        rgba = rgba.copy(); rgba[..., 3] = np.where(np.isin(lab, keep), al, 0)
    return rgba
srcs = {}
for p in sorted(glob.glob(f'{S}/raw/ch_*_sheet.png')): srcs[os.path.basename(p)[3:-10]] = p
srcs['shain'] = f'{S}/raw/ch_shain_stand.png'
only = sys.argv[2:]
report = []
for ch, p in srcs.items():
    if only and ch not in only: continue
    sheet = ck.key(np.array(Image.open(p).convert('RGB')), ch in ck.PURPLE)
    gs = cv2.cvtColor(white(sheet), cv2.COLOR_RGB2GRAY)
    files = [f for f in glob.glob(f'{ART}/{ch}_*.webp') if os.path.basename(f)[len(ch) + 1:-5].isalpha() and (ch != 'rival2' or not f.endswith('_bare.webp'))]
    if ch == 'hero_m' or ch == 'hero_f': files = [f for f in files if '_circle_' not in f and '_salaryman_' not in f]
    for f in files:
        old = np.array(Image.open(f).convert('RGBA')); h, w = old.shape[:2]
        go = cv2.cvtColor(white(old), cv2.COLOR_RGB2GRAY)
        best = (-1, 0, 0)
        for s in np.arange(1.0, 3.2, 0.04):
            tw, th = int(w * s), int(h * s)
            if tw > gs.shape[1] or th > gs.shape[0]: break
            r = cv2.matchTemplate(gs, cv2.resize(go, (tw, th), interpolation=cv2.INTER_CUBIC), cv2.TM_CCOEFF_NORMED)
            _, mv, _, ml = cv2.minMaxLoc(r)
            if mv > best[0]: best = (mv, s, ml)
        mv, s0, _ = best
        for s in np.arange(s0 - 0.04, s0 + 0.041, 0.008):
            tw, th = int(w * s), int(h * s)
            if tw > gs.shape[1] or th > gs.shape[0] or s < 1: continue
            r = cv2.matchTemplate(gs, cv2.resize(go, (tw, th), interpolation=cv2.INTER_CUBIC), cv2.TM_CCOEFF_NORMED)
            _, v, _, ml = cv2.minMaxLoc(r)
            if v >= best[0]: best = (v, s, ml)
        mv, s, (x, y) = best
        tw, th = int(w * s), int(h * s)
        crop = clean(sheet[y:y + th, x:x + tw])
        Image.fromarray(crop, 'RGBA').save(f'{S}/match/{os.path.basename(f)}', quality=82, method=6)
        report.append((os.path.basename(f), round(mv, 3), round(s, 2), (tw, th)))
        print(report[-1], flush=True)

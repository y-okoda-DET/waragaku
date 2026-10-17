# ChatGPTで背景をマゼンタ（#FF00FF）に塗り直した絵を透過してwebpにする。表情シート（2行×4列）は表情ごとに切り出す
# 白背景から抜く cut_art.py より、輪郭がなめらかで、服の白まで抜けることがない
# ChatGPTで塗り直した元絵は /mnt/project-files/art/raw/v3 に置いてある。v3にあるキャラは cut_art.py ではなくこちらで作る
# 使い方: python3 scripts/cut_key.py <元画像フォルダ> <出力フォルダ> [キャラ名...]
import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

EXPR = ['normal', 'smile', 'laugh', 'surprise', 'down', 'angry', 'think', 'shy']
SIDE = [('normal',), ('smile', 'laugh'), ('surprise',)]
# 服に紫が入っていて、マゼンタのにじみ取りを弱める人
PURPLE = {'rival1'}


def key(rgb, purple=False):
    # マゼンタらしさ（赤と青の小さいほう − 緑）から透明度を決め、縁に混ざったマゼンタを差し引く
    c = rgb.astype(np.float32)
    k = np.median(c[np.minimum(c[..., 0], c[..., 2]) - c[..., 1] > 200], axis=0)
    m = np.minimum(c[..., 0], c[..., 2]) - c[..., 1]
    full = np.minimum(k[0], k[2]) - k[1]
    # 0.2〜0.85 の間をなめらかにつなぐ。下は肌や舌の赤み、上は背景のゆらぎを吸収する
    t = np.clip((m / full - 0.2) / 0.65, 0, 1)
    a = 1 - t
    # 背景とつながっていないマゼンタっぽい所（服の柄など）は抜かない
    lab, _ = ndimage.label(t > 0.5)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(edge_labels))
    reach = ndimage.binary_dilation(outside, iterations=3)
    a = np.where(reach, a, 1.0)
    aa = np.maximum(a, 1e-3)[..., None]
    fg = np.clip((c - (1 - aa) * k) / aa, 0, 255)
    # 半透明の縁は、まわりの不透明な色に寄せる（マゼンタ色かぶりを残さない）
    edge = (a > 0) & (a < 0.95)
    if edge.any():
        solid = a >= 0.95
        _, idx = ndimage.distance_transform_edt(~solid, return_indices=True)
        near = c[idx[0], idx[1]]
        fg[edge] = near[edge]
    # 縁から10pxまでは、緑より赤と青が強い分（マゼンタのにじみ）を差し引く。肌や舌は緑の方が強いので変わらない
    # 紫の服の人（purple）は、服の紫まで消さないよう縁の2pxだけにする
    band = ndimage.binary_dilation(a < 0.95, iterations=2 if purple else 10)
    # 髪のすき間などに残った、赤と青がほぼ同じでマゼンタそのものに近い色は、縁から遠くても差し引く
    magentaish = (np.abs(fg[..., 0] - fg[..., 2]) < 30) & (np.minimum(fg[..., 0], fg[..., 2]) - fg[..., 1] > 60)
    if not purple:
        band |= magentaish
    spill = np.clip(np.minimum(fg[..., 0], fg[..., 2]) - fg[..., 1], 0, None) * band
    fg[..., 0] -= spill
    fg[..., 2] -= spill
    a[a < 0.04] = 0
    return np.dstack([fg, a * 255]).astype(np.uint8)


def split_at(bgfrac, n, size):
    # だいたい等分の位置の近くで、いちばん背景の多い線を区切りにする
    cuts = [0]
    for i in range(1, n):
        c = size * i // n
        lo, hi = c - size // (n * 6), c + size // (n * 6)
        cuts.append(lo + int(np.argmax(bgfrac[lo:hi])))
    cuts.append(size)
    return cuts


def finish(rgba):
    im = Image.fromarray(rgba, 'RGBA')
    al = rgba[..., 3]
    # 小さなゴミ（隣のコマのはみ出し、点のノイズ）を落とす。驚きの線や汗のような離れた描き文字は残す
    lab, n = ndimage.label(al > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        main = int(np.argmax(sizes))
        keep_ids = []
        for i, sl in enumerate(ndimage.find_objects(lab)):
            touches = sl[0].start == 0 or sl[1].start == 0 or sl[1].stop == al.shape[1]
            if i == main or (sizes[i] >= 40 and not (touches and sizes[i] < sizes[main] * 0.05)):
                keep_ids.append(i + 1)
        keep = np.isin(lab, keep_ids)
        rgba = rgba.copy()
        rgba[..., 3] = np.where(keep, al, 0)
        im = Image.fromarray(rgba, 'RGBA')
    bb = im.getbbox()
    im = im.crop((bb[0], bb[1], bb[2], im.size[1]))
    im.thumbnail((400, 400), Image.LANCZOS)
    return im


def main():
    raw, out = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3:])
    os.makedirs(out, exist_ok=True)
    for path in sorted(glob.glob(f'{raw}/ch_*_sheet.png')):
        ch = os.path.basename(path)[3:-len('_sheet.png')]
        if only and ch not in only:
            continue
        rgba = key(np.array(Image.open(path).convert('RGB')), ch in PURPLE)
        H, W = rgba.shape[:2]
        clear = rgba[..., 3] == 0
        rows = clear.mean(1)
        two_rows = rows[int(H * 0.4):int(H * 0.6)].max() > 0.97
        if two_rows:
            ys, xs = split_at(rows, 2, H), split_at(clear.mean(0), 4, W)
            cells = [((xs[i % 4], ys[i // 4], xs[i % 4 + 1], ys[i // 4 + 1]), (e,)) for i, e in enumerate(EXPR)]
        else:
            xs = split_at(clear.mean(0), 3, W)
            cells = [((xs[i], 0, xs[i + 1], H), names) for i, names in enumerate(SIDE)]
        for old in glob.glob(f'{out}/{ch}_*.webp'):
            os.remove(old)
        for (x0, y0, x1, y1), names in cells:
            face = finish(rgba[y0:y1, x0:x1])
            for e in names:
                face.save(f'{out}/{ch}_{e}.webp', quality=82, method=6)
        print(ch, 'sheet', len(cells))
    for path in sorted(glob.glob(f'{raw}/ch_*_stand.png')):
        ch = os.path.basename(path)[3:-len('_stand.png')]
        if (only and ch not in only) or os.path.exists(f'{raw}/ch_{ch}_sheet.png'):
            continue
        for old in glob.glob(f'{out}/{ch}_*.webp'):
            os.remove(old)
        finish(key(np.array(Image.open(path).convert('RGB')), ch in PURPLE)).save(f'{out}/{ch}_normal.webp', quality=82, method=6)
        print(ch, 'stand')


if __name__ == '__main__':
    main()

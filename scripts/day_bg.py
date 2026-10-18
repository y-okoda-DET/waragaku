import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, dst, full = sys.argv[1], sys.argv[2], sys.argv[3] == '1'
im = np.array(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
night = (b > r + 8) & (lum < 125)
yy = np.arange(h)[:, None].repeat(w, 1)
night &= yy < h * (0.75 if full else 0.6)
# 窓の中の町の明かりや建物も含めて、夜空の領域をまとめる
reg = ndimage.binary_closing(night, structure=np.ones((9, 9)), iterations=2)
reg = ndimage.binary_fill_holes(reg)
lab, n = ndimage.label(reg)
sizes = ndimage.sum(reg, lab, range(1, n + 1))
keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > h * w * 0.004])
ink = (im.max(axis=2) < 38) & (np.abs(b - r) < 12)
# 空のグラデーション（上ほど濃い青）
t = (yy / h)[..., None]
sky = (1 - t) * np.array([120, 185, 235]) + t * np.array([205, 232, 250])
out = im.copy()
m = keep & ~ink
out[m] = sky[m]
# 窓の外に白い雲をうっすら
if full:
    out = np.clip(out * 1.08 + 8, 0, 255)
Image.fromarray(out.astype(np.uint8)).save(dst, quality=78, method=6)
print(dst, int(keep.sum()))

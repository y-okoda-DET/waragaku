# Real-ESRGAN（アニメ向け 6B）で絵を4倍にしてから、目標の大きさに縮める。透明部分は別に拡大して戻す
import sys, glob, os
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

torch.set_num_threads(os.cpu_count() or 4)


class RDB(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = RDB(nf, gc), RDB(nf, gc), RDB(nf, gc)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, nb=6, nf=64, gc=32):
        super().__init__()
        self.conv_first = nn.Conv2d(3, nf, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


net = RRDBNet()
sd = torch.load(os.path.join(os.path.dirname(__file__), 'anime6B.pth'), map_location='cpu')
net.load_state_dict(sd.get('params_ema', sd))
net.eval()


def sr(rgb: np.ndarray, tile=256, pad=10) -> np.ndarray:
    # タイルに分けて4倍にする（メモリを抑える）
    h, w, _ = rgb.shape
    x = torch.from_numpy(rgb.astype(np.float32) / 255).permute(2, 0, 1)[None]
    out = torch.zeros(1, 3, h * 4, w * 4)
    with torch.no_grad():
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                ya, yb, xa, xb = max(y0 - pad, 0), min(y0 + tile + pad, h), max(x0 - pad, 0), min(x0 + tile + pad, w)
                o = net(x[:, :, ya:yb, xa:xb])
                ty, tx = (y0 - ya) * 4, (x0 - xa) * 4
                th, tw = (min(y0 + tile, h) - y0) * 4, (min(x0 + tile, w) - x0) * 4
                out[:, :, y0 * 4:y0 * 4 + th, x0 * 4:x0 * 4 + tw] = o[:, :, ty:ty + th, tx:tx + tw]
    return (out[0].permute(1, 2, 0).clamp(0, 1).numpy() * 255 + 0.5).astype(np.uint8)


def upscale(path, dst, target_h, quality):
    im = Image.open(path)
    # 入力が大きすぎると時間がかかるので、4倍したときに目標の2倍を超えない大きさまで先に縮める
    if im.height * 4 > target_h * 2.6:
        im = im.resize((round(im.width * target_h * 2.6 / 4 / im.height), round(target_h * 2.6 / 4)), Image.LANCZOS)
    has_a = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    im = im.convert('RGBA')
    a = np.array(im)
    rgb = a[..., :3]
    if has_a:
        # 透明なところは白にしてから拡大（縁に黒がにじまないように）
        al = a[..., 3:4] / 255.0
        rgb = (rgb * al + 255 * (1 - al)).astype(np.uint8)
    big = Image.fromarray(sr(rgb))
    W, H = big.size
    th = min(target_h, H)
    tw = round(W * th / H)
    big = big.resize((tw, th), Image.LANCZOS)
    if has_a:
        alpha = Image.fromarray(a[..., 3]).resize((tw, th), Image.LANCZOS)
        big = big.convert('RGBA')
        big.putalpha(alpha)
    big.save(dst, quality=quality, method=6)
    return big.size


if __name__ == '__main__':
    src, dst, target_h, quality = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    os.makedirs(dst, exist_ok=True)
    files = sorted(glob.glob(f'{src}/*.webp') + glob.glob(f'{src}/*.png'))
    only = set(sys.argv[5:])
    for f in files:
        n = os.path.splitext(os.path.basename(f))[0]
        if only and n not in only:
            continue
        print(n, upscale(f, f'{dst}/{n}.webp', target_h, quality), flush=True)

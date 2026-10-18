# BGMからループ区間を探し、つなぎ目を重ねて焼き込み、前後に0.1秒の余白を付けて書き出す
import sys, subprocess, json, numpy as np
SR = 24000
def load(p):
    raw = subprocess.run(['ffmpeg','-v','quiet','-i',p,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def env(x, hop=480):  # 20ms ごとの音の強さの変化（拍の手がかり）
    n = len(x)//hop
    e = np.sqrt((x[:n*hop].reshape(n,hop)**2).mean(1)+1e-9)
    d = np.maximum(np.diff(np.log(e), prepend=np.log(e[0])), 0)
    return d, e
name, start, lo, hi = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
x = load(f'/mnt/project-files/audio/bgm/{name}.mp3')
d, e = env(x)
fps = SR/480
a = int(start*fps); W = int(8*fps)
best = None
for L in range(int(lo*fps), int(hi*fps)):
    if a+L+W > len(d): break
    p, q = d[a:a+W], d[a+L:a+L+W]
    c = np.dot(p-p.mean(), q-q.mean())/(np.std(p)*np.std(q)*W+1e-9)
    lvl = abs(np.log(e[a:a+W].mean()/e[a+L:a+L+W].mean()))
    s = c - lvl
    if best is None or s > best[0]: best = (s, L, c, lvl)
s, L, c, lvl = best
# 20ms 単位から、サンプル単位で細かく合わせる（±20ms の相互相関）
A = int(start*SR); Ls = int(L/fps*SR)
seg = x[A:A+4096]
r = [np.dot(seg, x[A+Ls+k:A+Ls+k+4096]) for k in range(-480, 481)]
Ls += int(np.argmax(r)) - 480
X = int(1.0*SR)  # 1秒重ねる
body = x[A:A+Ls].copy()
t = np.linspace(0, 1, X, dtype=np.float32)
body[:X] = x[A:A+X]*np.sqrt(t) + x[A+Ls:A+Ls+X]*np.sqrt(1-t)
pad = int(0.1*SR)
out = np.concatenate([body[-pad:], body, body[:pad]])
open(f'{name}.f32','wb').write(out.astype(np.float32).tobytes())
print(json.dumps({'name':name,'start':start,'len':round(Ls/SR,3),'corr':round(float(c),3),'lvl':round(float(lvl),3)}))

# 効果音：前後の無音を切り、種類ごとの目安の大きさにそろえて、モノラルで書き出す
import subprocess, numpy as np, sys
SR = 32000
# 名前: (目安, 値) LUFS で合わせるものと、短すぎてピークで合わせるもの
T = {'se_tap':('peak',-9),'se_decide':('peak',-3),'se_tsukkomi':('peak',-2),
     'se_laugh_big':('rms',-17),'se_laugh_small':('rms',-20),'se_clap':('rms',-20),'se_cheer':('rms',-17),
     'se_zawa':('rms',-27),'se_suberi':('rms',-21),'se_buzzer':('rms',-20),'se_rank':('rms',-17),'se_mekuri':('peak',-3)}
for n,(k,v) in T.items():
    x = np.frombuffer(subprocess.run(['ffmpeg','-v','quiet','-i',f'/mnt/project-files/audio/se/{n}.mp3','-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout,np.float32).copy()
    th = np.abs(x).max()*10**(-45/20)
    idx = np.where(np.abs(x) > th)[0]
    x = x[max(idx[0]-160,0):idx[-1]+1600]
    if n == 'se_zawa':  # 10秒のループにする（0.8秒重ねる）
        L, X = 10*SR, int(0.8*SR)
        t = np.linspace(0,1,X,dtype=np.float32)
        b = x[SR:SR+L].copy(); b[:X] = x[SR:SR+X]*np.sqrt(t) + x[SR+L:SR+L+X]*np.sqrt(1-t); x = b
    else:
        f = min(len(x), int(0.03*SR)); x[-f:] *= np.linspace(1,0,f)
    lvl = 20*np.log10(np.abs(x).max()) if k=='peak' else 20*np.log10(np.sqrt((x**2).mean()))
    x = x*10**((v-lvl)/20)
    pk = np.abs(x).max()
    if pk > 0.95: x *= 0.95/pk
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','56k',f'out/{n}.mp3'],input=x.astype(np.float32).tobytes())
    print(n, round(len(x)/SR,2),'s peak', round(20*np.log10(np.abs(x).max()),1))

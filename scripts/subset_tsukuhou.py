"""築豊初号明朝OFLを、ゲームで使う文字だけに抜き出す。

使う場所は「幕が上がる瞬間」だけ：タイトル、週のカード、舞台の名前、卒業の称号。
どれも出る文字が決まっているので、ソースから文字を集めて小さなwoff2にする。
文字を足したり変えたりしたら、もう一度これを流す。

  python3 scripts/subset_tsukuhou.py <TsukuhouShogoMin-OFL.ttf>

fontTools（pip install fonttools brotli）が要る。
"""
import re
import sys
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/assets/fonts/TsukuhouShogoMin-title.woff2'

FIXED = 'ワラガク！とあるお笑い養成所の一年' + '0123456789月第週のこり' + '「」 '


def chars() -> str:
    stage = (ROOT / 'src/game/stage.ts').read_text(encoding='utf-8')
    titles = re.findall(r"^\s+title: '([^']+)'", stage, re.M)
    review = (ROOT / 'src/game/review.ts').read_text(encoding='utf-8')
    head = re.search(r'const TITLE_HEAD[^{]*\{(.*?)\n\}', review, re.S).group(1)
    tail = re.search(r'const tail =(.*?)const title =', review, re.S).group(1)
    words = re.findall(r"'([^']+)'", head) + [w for w in re.findall(r"'([^']+)'", tail) if not w.isascii()]
    return ''.join(sorted(set(FIXED + ''.join(titles) + ''.join(words))))


def main() -> None:
    text = chars()
    opts = subset.Options()
    opts.flavor = 'woff2'
    font = subset.load_font(sys.argv[1], opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    subset.save_font(font, str(OUT), opts)
    print(f'{len(text)}字 → {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024}KB)')


if __name__ == '__main__':
    main()

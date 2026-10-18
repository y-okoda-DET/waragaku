import { se, setSound, useSound } from './sound'

// 音の設定とクレジット。タイトル画面から開く
const CREDITS: { what: string; who: string; url: string }[] = [
  { what: 'タイトルの曲', who: '魔王魂', url: 'https://maou.audio/' },
  { what: '「明日のお天気」 Azell', who: 'ポケットサウンド', url: 'https://pocket-se.info/' },
  { what: '「Somehow」', who: 'Mr Kimy', url: 'https://dova-s.jp/' },
]

export function SoundScreen({ onBack }: { onBack: () => void }) {
  const s = useSound()
  return (
    <div className="screen sound-screen">
      <div className="row-between">
        <h1>音とクレジット</h1>
        <button className="link" onClick={onBack}>
          戻る
        </button>
      </div>
      <section className="card">
        <div className="row-between">
          <h2>音</h2>
          <button className={s.on ? 'primary' : ''} onClick={() => setSound({ on: !s.on })}>
            {s.on ? '音あり' : '音なし'}
          </button>
        </div>
        <label className="vol">
          <span>BGM</span>
          <input type="range" min={0} max={100} value={Math.round(s.bgm * 100)} disabled={!s.on} onChange={(e) => setSound({ bgm: Number(e.target.value) / 100 })} />
        </label>
        <label className="vol">
          <span>効果音</span>
          <input type="range" min={0} max={100} value={Math.round(s.se * 100)} disabled={!s.on} onChange={(e) => setSound({ se: Number(e.target.value) / 100 })} onPointerUp={() => se('laugh_small')} />
        </label>
        <p className="small">スマホのマナーモード中は音が出ないことがあります。</p>
      </section>
      <section className="card">
        <h2>実況・配信について</h2>
        <p className="small">
          実況・配信・動画への投稿は、届け出なしで自由にどうぞ。収益化もかまいません。タイトルか説明欄に「ワラガク！」と、遊べる場所のURLを書いてもらえるとうれしいです。
        </p>
        <p className="small">相方との山場（2月の「門出の袖」）から先は、サムネイルや題名で結末が分からないようにしてもらえると助かります。</p>
      </section>
      <section className="card">
        <h2>クレジット</h2>
        <dl className="credits">
          {CREDITS.map((c) => (
            <div key={c.what}>
              <dt>{c.what}</dt>
              <dd>
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.who}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

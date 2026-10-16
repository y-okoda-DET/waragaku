import { useState } from 'react'
import { BACKGROUNDS } from '../game/data/backgrounds'
import { SKILL_BY_ID } from '../game/data/skills'
import type { NewGameInput } from '../game/engine'
import type { Origin, Role, Style } from '../game/types'
import { Avatar } from './parts'
import { HAIR, OUTFITS, outfitColor } from './looks'

export function CreateScreen({ onStart, onBack }: { onStart: (input: NewGameInput) => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [callName, setCallName] = useState('')
  const [hairColor, setHair] = useState(HAIR[0])
  const [outfit, setOutfit] = useState('parka')
  const [background, setBg] = useState('fresh')
  const [origin, setOrigin] = useState<Origin>('tokyo')
  const [role, setRole] = useState<Role>('boke')
  const [style, setStyle] = useState<Style>('manzai')

  const bg = BACKGROUNDS.find((b) => b.id === background)!
  const ready = name.trim().length > 0

  const randomize = () => {
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
    setName(pick(['山田 一平', '佐々木 まこと', '小野寺 陽', '黒川 しずく', '戸田 健太']))
    setCallName(pick(['ヤマちゃん', 'ササキ', 'てらっち', 'しずく', 'トダケン']))
    setHair(pick(HAIR))
    setOutfit(pick(OUTFITS).id)
    setBg(pick(BACKGROUNDS).id)
    setOrigin(pick(['local', 'tokyo'] as Origin[]))
    setRole(pick(['boke', 'tsukkomi'] as Role[]))
    setStyle(pick(['manzai', 'conte'] as Style[]))
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="link" onClick={onBack}>
          ← 戻る
        </button>
        <h1>入学願書</h1>
        <button className="link" onClick={randomize}>
          おまかせ
        </button>
      </header>

      <section className="card">
        <h2>1. 名前</h2>
        <label className="field">
          <span>名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：山田 一平" maxLength={16} />
        </label>
        <label className="field">
          <span>呼ばれ方</span>
          <input value={callName} onChange={(e) => setCallName(e.target.value)} placeholder="例：ヤマちゃん" maxLength={10} />
        </label>
      </section>

      <section className="card">
        <h2>2. 見た目</h2>
        <div className="look">
          <Avatar hair={hairColor} outfit={outfitColor(outfit)} size={72} />
          <div className="look-opts">
            <div className="swatches" role="radiogroup" aria-label="髪の色">
              {HAIR.map((c) => (
                <button key={c} className={`swatch ${c === hairColor ? 'on' : ''}`} style={{ background: c }} onClick={() => setHair(c)} aria-label="髪の色" />
              ))}
            </div>
            <div className="chips">
              {OUTFITS.map((o) => (
                <button key={o.id} className={`chip ${o.id === outfit ? 'on' : ''}`} onClick={() => setOutfit(o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>3. 経歴</h2>
        <div className="bg-list">
          {BACKGROUNDS.map((b) => (
            <button key={b.id} className={`bg-item ${b.id === background ? 'on' : ''}`} onClick={() => setBg(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
        <p className="note">{bg.blurb}</p>
        <p className="small">
          所持金 {bg.money.toLocaleString()}円
          {bg.skills.length > 0 && ` ／ 芸風：${bg.skills.map((id) => SKILL_BY_ID[id].name).join('、')}`}
        </p>
      </section>

      <section className="card">
        <h2>4. 出身</h2>
        <div className="seg">
          <button className={origin === 'local' ? 'on' : ''} onClick={() => setOrigin('local')}>
            地元組（実家から通う）
          </button>
          <button className={origin === 'tokyo' ? 'on' : ''} onClick={() => setOrigin('tokyo')}>
            上京組（家賃がかかる）
          </button>
        </div>
      </section>

      <section className="card">
        <h2>5. 担当</h2>
        <div className="seg">
          <button className={role === 'boke' ? 'on' : ''} onClick={() => setRole('boke')}>
            ボケ
          </button>
          <button className={role === 'tsukkomi' ? 'on' : ''} onClick={() => setRole('tsukkomi')}>
            ツッコミ
          </button>
        </div>
        <div className="seg">
          <button className={style === 'manzai' ? 'on' : ''} onClick={() => setStyle('manzai')}>
            漫才をやりたい
          </button>
          <button className={style === 'conte' ? 'on' : ''} onClick={() => setStyle('conte')}>
            コントをやりたい
          </button>
        </div>
      </section>

      <button
        className="primary big"
        disabled={!ready}
        onClick={() => onStart({ name: name.trim(), callName: callName.trim() || name.trim(), hairColor, outfit, background, origin, role, style })}
      >
        {ready ? '願書を出す' : '名前を入れてください'}
      </button>
    </div>
  )
}

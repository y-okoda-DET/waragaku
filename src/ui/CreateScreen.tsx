import { useState } from 'react'
import { BACKGROUND_BY_ID, PLAYER_LOOK } from '../game/data/backgrounds'
import type { NewGameInput } from '../game/engine'
import type { Gender, Role, Style } from '../game/types'
import { outfitColor } from './looks'
import { Avatar, HeroFace } from './parts'
import { heroKey, portrait } from './art'

// 主人公は「高校卒業・東京生まれで実家から通う」で固定。選ぶのは名前・性別・担当・やりたいネタだけ
const FRESH = BACKGROUND_BY_ID['fresh']

export function CreateScreen({ onStart, onBack }: { onStart: (input: NewGameInput) => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [callName, setCallName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [role, setRole] = useState<Role>('boke')
  const [style, setStyle] = useState<Style>('manzai')

  const ready = name.trim().length > 0

  const randomize = () => {
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
    const g = pick(['male', 'female'] as Gender[])
    const [n, c] = pick(g === 'male' ? [['山田 一平', 'ヤマちゃん'], ['戸田 健太', 'トダケン'], ['小野寺 陽', 'てらっち']] : [['黒川 しずく', 'しずく'], ['佐々木 まこと', 'ササキ'], ['森 あかり', 'モリ']])
    setGender(g)
    setName(n)
    setCallName(c)
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
        <h2>2. 性別</h2>
        <div className="gender-pick">
          {(['male', 'female'] as Gender[]).map((g) => (
            <button key={g} className={gender === g ? 'on' : ''} onClick={() => setGender(g)} aria-pressed={gender === g}>
              {portrait(heroKey(g), 'normal') ? (
                <HeroFace gender={g} size={64} />
              ) : (
                <Avatar hair={PLAYER_LOOK[g].hairColor} outfit={outfitColor(PLAYER_LOOK[g].outfit)} size={64} long={g === 'female'} />
              )}
              <span>{g === 'male' ? '男性' : '女性'}</span>
            </button>
          ))}
        </div>
        <p className="note">{FRESH.blurb}</p>
      </section>

      <section className="card">
        <h2>3. 担当</h2>
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

      <button className="primary big" disabled={!ready} onClick={() => onStart({ name: name.trim(), callName: callName.trim() || name.trim(), gender, role, style })}>
        {ready ? '願書を出す' : '名前を入れてください'}
      </button>
    </div>
  )
}

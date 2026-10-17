import { useState } from 'react'
import { BACKGROUND_BY_ID, PLAYER_LOOK } from '../game/data/backgrounds'
import type { NewGameInput } from '../game/engine'
import type { Gender, Role, Style } from '../game/types'
import { outfitColor } from './looks'
import { Avatar, HeroFace } from './parts'
import { heroKey, portrait } from './art'
import { CAREERS, openCareers, type CareerId } from '../game/careers'

// 経歴は、卒業した回数だけ選べるようになる（1周目は高校卒業だけ）。ほかに選ぶのは名前・性別・担当・やりたいネタ

// おまかせで使う名前。下の名前は、読んで性別を取り違えないものだけにする
const SURNAMES: string[] = [
  '山田', '戸田', '小野寺', '黒川', '佐々木', '森', '高橋', '松本',
  '井上', '石川', '中村', '藤田', '岡本', '坂口', '今井', '野口',
  '横山', '西村', '原田', '大野', '菅原', '平野', '宮本', '金子',
]
const MALE_NAMES: string[] = [
  '一平', '健太', '大輔', '翔太', '拓也', '雄一', '浩二', '大樹',
  '亮介', '剛', '俊介', '正人', '達也', '勇気', '慎吾', '康平',
]
const FEMALE_NAMES: string[] = [
  'しずく', 'あかり', '美咲', '彩花', '由美', '恵子', 'さくら', '奈々',
  '真由', '千尋', '優子', '麻衣', '理沙', '陽子', '香織', '桃子',
]

export function CreateScreen({ runs, onStart, onBack }: { runs: number; onStart: (input: NewGameInput) => void; onBack: () => void }) {
  const open = openCareers(runs)
  const [career, setCareer] = useState<CareerId>('fresh')
  const bg = BACKGROUND_BY_ID[career]
  const [name, setName] = useState('')
  const [callName, setCallName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [role, setRole] = useState<Role>('boke')
  const [style, setStyle] = useState<Style>('manzai')

  const ready = name.trim().length > 0

  const randomize = () => {
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
    const g = pick(['male', 'female'] as Gender[])
    const sei = pick(SURNAMES)
    const mei = pick(g === 'male' ? MALE_NAMES : FEMALE_NAMES)
    // 呼ばれ方は、下の名前・名字・名字＋ちゃんなどから選ぶ
    const call = pick([mei, sei, `${sei}ちゃん`, g === 'male' ? `${sei}くん` : `${mei}ちゃん`])
    setGender(g)
    setName(`${sei} ${mei}`)
    setCallName(call)
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
        <h2>2. キャラクター</h2>
        {open.length > 1 && (
          <div className="seg career-pick">
            {CAREERS.map((c) =>
              open.includes(c.id) ? (
                <button key={c.id} className={career === c.id ? 'on' : ''} onClick={() => setCareer(c.id)} aria-pressed={career === c.id}>
                  {c.label}
                </button>
              ) : (
                <button key={c.id} disabled>
                  ？？？
                </button>
              ),
            )}
          </div>
        )}
        <div className="gender-pick">
          {(['male', 'female'] as Gender[]).map((g) => (
            <button key={g} className={gender === g ? 'on' : ''} onClick={() => setGender(g)} aria-pressed={gender === g} aria-label={g === 'male' ? '男性' : '女性'}>
              {portrait(heroKey(g, career), 'normal') ? (
                <HeroFace gender={g} career={career} size={64} />
              ) : (
                <Avatar hair={PLAYER_LOOK[g].hairColor} outfit={outfitColor(PLAYER_LOOK[g].outfit)} size={64} long={g === 'female'} />
              )}
            </button>
          ))}
        </div>
        <p className="note">{bg.blurb}</p>
        {open.length < CAREERS.length && <p className="small">卒業すると、ほかの経歴でも入学できるようになります。</p>}
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

      <button className="primary big" disabled={!ready} onClick={() => onStart({ name: name.trim(), callName: callName.trim() || name.trim(), gender, role, style, background: career })}>
        {ready ? '願書を出す' : '名前を入れてください'}
      </button>
    </div>
  )
}

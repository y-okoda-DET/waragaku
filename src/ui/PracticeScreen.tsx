import { useState } from 'react'
import { createGame } from '../game/engine'
import { scenePool, type Lean, type ShowcaseGrade } from '../game/showcase'
import type { GameState, Role, Style } from '../game/types'
import { ShowcaseScreen } from './ShowcaseScreen'

type Level = 'low' | 'high'
type PracticeStage = 'netamise' | 'live' | 'contest_manzai' | 'grad_final'

const GRADE_NAME: Record<ShowcaseGrade, string> = { great: 'ドッ', good: 'クスッ', miss: 'シーン' }
const STAGE_CHOICES: [PracticeStage, string][] = [
  ['netamise', '授業'],
  ['live', '寄席'],
  ['contest_manzai', '大会'],
  ['grad_final', '卒業決勝'],
]

// ミニゲームだけを繰り返し遊ぶ練習モード。セーブには残さない
function practiceState(role: Role, style: Style, level: Level, lean: Lean, round: number): GameState {
  const s = createGame({ name: '練習', callName: '練習', background: 'salaryman', origin: 'local', role, style, hairColor: '#333', outfit: 'parka', seed: 1 })
  const v = level === 'high' ? 70 : 15
  // シュール寄りは発想が表現より10以上高い
  const idea = lean === 'shuru' ? v + 15 : v
  // 練習では体調の注意書きは出さない
  return { ...s, turn: round, condition: 100, stats: { ...s.stats, idea, word: v, expr: v, guts: v } }
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <>
      <p className="small">{label}</p>
      <div className="tabs" role="tablist">
        {options.map(([v, name]) => (
          <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
            {name}
          </button>
        ))}
      </div>
    </>
  )
}

export function PracticeScreen({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState<Role | null>(null)
  const [level, setLevel] = useState<Level>('low')
  const [stage, setStage] = useState<PracticeStage>('netamise')
  const [lean, setLean] = useState<Lean>('oudou')
  const [style, setStyle] = useState<Style>('manzai')
  const [round, setRound] = useState(0)
  const [log, setLog] = useState<ShowcaseGrade[]>([])

  if (!role)
    return (
      <div className="screen practice">
        <h2 className="section-title">ミニゲームだけ遊ぶ</h2>
        <p>ネタ見せの「見せ場」だけを、何回でも遊べます。本編のセーブには影響しません。</p>
        <div className="card">
          <Choice
            label="能力"
            value={level}
            onChange={setLevel}
            options={[
              ['low', '入学したて'],
              ['high', '卒業前'],
            ]}
          />
          <Choice label="舞台" value={stage} onChange={setStage} options={STAGE_CHOICES} />
          <Choice
            label="ネタ"
            value={style}
            onChange={setStyle}
            options={[
              ['manzai', '漫才'],
              ['conte', 'コント'],
            ]}
          />
          <Choice
            label="芸風（ボケのとき）"
            value={lean}
            onChange={setLean}
            options={[
              ['oudou', '王道寄り'],
              ['shuru', 'シュール寄り'],
            ]}
          />
          <p className="small">ボケは、芸風と客層の両方に合う答えがドッです。ツッコミは、ボケごとにドッの位置が変わり、大きい舞台ほど帯が狭く針が速くなります。</p>
        </div>
        <button className="primary big" onClick={() => setRole('boke')}>
          ボケで遊ぶ（ワード選び）
        </button>
        <button className="primary big" onClick={() => setRole('tsukkomi')}>
          ツッコミで遊ぶ（間でツッコむ）
        </button>
        <button className="big" onClick={onBack}>
          タイトルにもどる
        </button>
      </div>
    )

  const state = practiceState(role, style, level, lean, round)
  const pool = scenePool(role === 'boke' ? 'word' : 'tsukkomi', style)
  const scene = pool[round % pool.length]
  const count = (g: ShowcaseGrade) => log.filter((x) => x === g).length

  return (
    <ShowcaseScreen
      key={round}
      state={state}
      kind={stage}
      scenes={[scene]}
      nextLabel="次のネタへ"
      onDone={(g) => {
        setLog([...log, ...g])
        setRound(round + 1)
      }}
      footer={
        <>
          <p className="small center">
            {(round % pool.length) + 1} / {pool.length} 本目{'　'}{(['great', 'good', 'miss'] as const).map((g) => `${GRADE_NAME[g]} ${count(g)}`).join(' ／ ')}
          </p>
          <button
            className="big"
            onClick={() => {
              setRole(null)
              setRound(0)
              setLog([])
            }}
          >
            やめる
          </button>
        </>
      }
    />
  )
}

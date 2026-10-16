import { useState } from 'react'
import { createGame } from '../game/engine'
import { TSUKKOMI_SCENES, WORD_SCENES, type ShowcaseGrade } from '../game/showcase'
import type { GameState, Role } from '../game/types'
import { ShowcaseScreen } from './ShowcaseScreen'

type Level = 'low' | 'high'

const GRADE_NAME: Record<ShowcaseGrade, string> = { great: 'ドッ', good: 'クスッ', miss: 'シーン' }

// ミニゲームだけを繰り返し遊ぶ練習モード。セーブには残さない
function practiceState(role: Role, level: Level): GameState {
  const s = createGame({ name: '練習', callName: '練習', background: 'salaryman', origin: 'local', role, style: 'manzai', hairColor: '#333', outfit: 'parka', seed: 1 })
  const v = level === 'high' ? 70 : 15
  return { ...s, stats: { ...s.stats, idea: v, word: v, expr: v } }
}

export function PracticeScreen({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState<Role | null>(null)
  const [level, setLevel] = useState<Level>('low')
  const [round, setRound] = useState(0)
  const [log, setLog] = useState<ShowcaseGrade[]>([])

  if (!role)
    return (
      <div className="screen practice">
        <h2 className="section-title">ミニゲームだけ遊ぶ</h2>
        <p>ネタ見せの「見せ場」だけを、何回でも遊べます。本編のセーブには影響しません。</p>
        <div className="card">
          <p className="small">能力</p>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={level === 'low'} className={level === 'low' ? 'on' : ''} onClick={() => setLevel('low')}>
              入学したて
            </button>
            <button role="tab" aria-selected={level === 'high'} className={level === 'high' ? 'on' : ''} onClick={() => setLevel('high')}>
              卒業前
            </button>
          </div>
          <p className="small">{level === 'low' ? 'ツッコミのドッ帯・クスッ帯が狭く、ボケのヒントは出ません。' : 'ツッコミのドッ帯・クスッ帯が広がり、ボケは一番いい答えに「ピンときた」が出ます。'}</p>
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

  const state = practiceState(role, level)
  const pool = role === 'boke' ? WORD_SCENES : TSUKKOMI_SCENES
  const scene = pool[round % pool.length]
  const count = (g: ShowcaseGrade) => log.filter((x) => x === g).length

  return (
    <ShowcaseScreen
      key={round}
      state={state}
      kind="netamise"
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

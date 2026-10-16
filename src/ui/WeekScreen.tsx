import { useState } from 'react'
import { TOTAL_TURNS, weekLabel } from '../game/data/calendar'
import type { DayAction, NightAction } from '../game/engine'
import { STAT_KEYS, STAT_LABEL, type GameState } from '../game/types'
import { outfitColor } from './looks'
import { NetaPanel } from './NetaPanel'
import { Avatar, Bar, SkillBadge } from './parts'

const CLASS_LABEL = { none: '-', ume: '梅組', take: '竹組', matsu: '松組' }

type DayKey = DayAction['type']
const DAY_OPTIONS: { key: DayKey; label: string; hint: string }[] = [
  { key: 'neta', label: 'ネタ作り', hint: '発想力・完成度＋／新しいネタの種' },
  { key: 'awase', label: 'ネタ合わせ', hint: '完成度・相方との関係＋' },
  { key: 'jishuren', label: '自主練', hint: '表現力・体力＋' },
  { key: 'baito', label: 'バイト', hint: 'お金＋・体調−' },
  { key: 'jishulive', label: '自主ライブに出る', hint: 'エントリー料2,000円／度胸・外の縁＋' },
  { key: 'kangeki', label: 'ライブを観に行く', hint: '1,500円／発想力・やる気＋' },
  { key: 'rest', label: '休む', hint: '体調・やる気＋' },
]

const AWASE = [
  { v: 'park', label: '夜の公園（タダ）' },
  { v: 'karaoke', label: 'カラオケ（2,000円）' },
  { v: 'family', label: 'ファミレス（800円）' },
] as const
const JISHUREN = [
  { v: 'hassei', label: '発声・滑舌' },
  { v: 'kintore', label: '筋トレ' },
  { v: 'dance', label: 'ダンス' },
] as const
const BAITO = [
  { v: 'izakaya', label: '居酒屋（まかない付き）' },
  { v: 'karaoke', label: 'カラオケ深夜' },
  { v: 'hikkoshi', label: '引越し（高いがキツい）' },
  { v: 'call', label: 'コールセンター' },
] as const

export function WeekScreen({ state, onRun, onNeta }: { state: GameState; onRun: (d: DayAction, n: NightAction) => void; onNeta: (s: GameState) => void }) {
  const [day, setDay] = useState<DayKey>('neta')
  const [awase, setAwase] = useState<(typeof AWASE)[number]['v']>('park')
  const [jishuren, setJishuren] = useState<(typeof JISHUREN)[number]['v']>('hassei')
  const [baito, setBaito] = useState<(typeof BAITO)[number]['v']>('izakaya')
  const [night, setNight] = useState<string>('sleep')
  const [showNeta, setShowNeta] = useState(false)

  const p = state.player
  const buildDay = (): DayAction => {
    if (day === 'awase') return { type: 'awase', place: awase }
    if (day === 'jishuren') return { type: 'jishuren', kind: jishuren }
    if (day === 'baito') return { type: 'baito', kind: baito }
    return { type: day } as DayAction
  }
  const buildNight = (): NightAction => (night.startsWith('nomi:') ? { type: 'nomi', senior: night.slice(5) } : ({ type: night } as NightAction))

  return (
    <div className="screen">
      <header className="week-head">
        <div>
          <div className="date">{weekLabel(state.turn)}</div>
          <div className="small">
            残り{TOTAL_TURNS - state.turn}週 ／ 同期 {state.classmates}人 ／ {CLASS_LABEL[state.classRank]}
          </div>
        </div>
        <div className={`money ${state.money < 20000 ? 'low' : ''}`}>{state.money.toLocaleString()}円</div>
      </header>

      <section className="card me">
        <Avatar hair={p.hairColor} outfit={outfitColor(p.outfit)} size={56} />
        <div className="me-body">
          <div className="me-name">
            {p.callName}
            {state.comboName && <span className="combo">「{state.comboName}」</span>}
          </div>
          <Bar label="体調" value={state.condition} tone={state.condition < 30 ? 'warn' : undefined} />
          <Bar label="やる気" value={state.motivation} tone={state.motivation < 30 ? 'warn' : 'good'} />
        </div>
      </section>

      <section className="card">
        <h2>能力</h2>
        {STAT_KEYS.map((k) => (
          <Bar key={k} label={STAT_LABEL[k]} value={state.stats[k]} />
        ))}
        {state.skills.length > 0 && (
          <div className="skills">
            {state.skills.map((id) => (
              <SkillBadge key={id} id={id} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>ネタ帳</h2>
          <button className="link" onClick={() => setShowNeta((v) => !v)}>
            {showNeta ? '閉じる' : '組み替える'}
          </button>
        </div>
        <NetaPanel state={state} editable={showNeta} onChange={onNeta} />
      </section>

      <section className="card">
        <h2>人間関係</h2>
        {state.partner ? (
          <div className="person">
            <div>
              相方：<b>{state.partner.name}</b>
              <span className="small">（{state.partner.role === 'boke' ? 'ボケ' : 'ツッコミ'}）</span>
            </div>
            <Bar label="関係" value={state.partner.bond} tone={state.partner.bond < 25 ? 'warn' : 'good'} />
          </div>
        ) : (
          <p className="small">相方はまだいない。</p>
        )}
        {state.seniors.map((sr) => (
          <div key={sr.id} className="person">
            <div>
              <b>{sr.name}</b> <span className="small">{sr.title}</span>
            </div>
            <Bar label="仲" value={sr.like} />
            <Bar label="認め" value={sr.respect} />
          </div>
        ))}
        <p className="small">先輩は、仲が良いだけでは仕事に呼んでくれない。ウケたところを見せると「認め」が上がる。</p>
      </section>

      <section className="card">
        <h2>昼：何をする？</h2>
        <div className="options">
          {DAY_OPTIONS.map((o) => (
            <button key={o.key} className={`option ${day === o.key ? 'on' : ''}`} onClick={() => setDay(o.key)}>
              <span>{o.label}</span>
              <span className="small">{o.hint}</span>
            </button>
          ))}
        </div>
        {day === 'awase' && <Sub items={AWASE} value={awase} onChange={setAwase} />}
        {day === 'jishuren' && <Sub items={JISHUREN} value={jishuren} onChange={setJishuren} />}
        {day === 'baito' && <Sub items={BAITO} value={baito} onChange={setBaito} />}
      </section>

      <section className="card">
        <h2>夜：どう過ごす？</h2>
        <div className="options">
          {state.seniors.map((sr) => (
            <button key={sr.id} className={`option ${night === `nomi:${sr.id}` ? 'on' : ''}`} onClick={() => setNight(`nomi:${sr.id}`)}>
              <span>{sr.name}さんの飲みについて行く</span>
              <span className="small">仲＋・食費が浮く・体調−</span>
            </button>
          ))}
          {[
            { k: 'douki', label: '同期と飲む', hint: '3,000円／同期の結束・やる気＋' },
            { k: 'netacho', label: '家でネタ帳を書く', hint: '完成度＋' },
            { k: 'egosa', label: 'エゴサする', hint: 'やる気が上下する' },
            { k: 'sleep', label: '早く寝る', hint: '体調＋' },
          ].map((o) => (
            <button key={o.k} className={`option ${night === o.k ? 'on' : ''}`} onClick={() => setNight(o.k)}>
              <span>{o.label}</span>
              <span className="small">{o.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <button className="primary big sticky" onClick={() => onRun(buildDay(), buildNight())}>
        この1週間を過ごす
      </button>
    </div>
  )
}

function Sub<T extends string>({ items, value, onChange }: { items: readonly { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips sub">
      {items.map((i) => (
        <button key={i.v} className={`chip ${i.v === value ? 'on' : ''}`} onClick={() => onChange(i.v)}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

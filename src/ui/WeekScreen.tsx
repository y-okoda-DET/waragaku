import { useState } from 'react'
import { TOTAL_TURNS, weekLabel } from '../game/data/calendar'
import type { DayAction, NightAction } from '../game/engine'
import { STAT_KEYS, STAT_LABEL, type GameState } from '../game/types'
import { SKILL_BY_ID } from '../game/data/skills'
import { NetaPanel } from './NetaPanel'
import { Bar, Modal, PlayerAvatar, SkillBadge } from './parts'

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
  { v: 'park', label: '公園（タダ）', cost: 0 },
  { v: 'karaoke', label: 'カラオケ（2,000円）', cost: 2000 },
  { v: 'family', label: 'ファミレス（800円）', cost: 800 },
] as const
// お金がかかる予定
const DAY_COST: Partial<Record<DayKey, number>> = { jishulive: 2000, kangeki: 1500 }
const NIGHT_COST: Record<string, number> = { douki: 3000 }

// 来週の家賃と食費。これが払えないと、昼はバイトしか選べない
function weeklyNeed(s: GameState): number {
  return 5000 + (s.player.origin === 'tokyo' && !s.flags.isourou ? 10000 : 0) + (s.skills.includes('rouhi') ? 3000 : 0)
}
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

type Sheet = 'neta' | 'people' | 'skills' | null

export function WeekScreen({ state, onRun, onNeta }: { state: GameState; onRun: (d: DayAction, n: NightAction) => void; onNeta: (s: GameState) => void }) {
  const need = weeklyNeed(state)
  const mustWork = state.money < need
  const [day, setDay] = useState<DayKey>(mustWork ? 'baito' : 'neta')
  const [skill, setSkill] = useState<string | null>(null)
  const [awase, setAwase] = useState<(typeof AWASE)[number]['v']>('park')
  const [jishuren, setJishuren] = useState<(typeof JISHUREN)[number]['v']>('hassei')
  const [baito, setBaito] = useState<(typeof BAITO)[number]['v']>('izakaya')
  const [night, setNight] = useState<string>('sleep')
  const [tab, setTab] = useState<'day' | 'night'>('day')
  const [sheet, setSheet] = useState<Sheet>(null)

  const p = state.player
  const dayLocked = (k: DayKey) => (mustWork && k !== 'baito' ? '生活費が足りない' : (DAY_COST[k] ?? 0) > state.money ? 'お金が足りない' : '')
  const awaseLocked = (v: string) => ((AWASE.find((a) => a.v === v)?.cost ?? 0) > state.money ? 'お金が足りない' : '')
  const nightLocked = (k: string) => ((NIGHT_COST[k] ?? 0) > state.money ? 'お金が足りない' : '')
  // 選んでいた予定がお金で選べなくなったら、バイトにする
  const curDay: DayKey = dayLocked(day) ? 'baito' : day
  const curNight = nightLocked(night) ? 'sleep' : night
  const buildDay = (): DayAction => {
    const day = curDay
    if (day === 'awase') return { type: 'awase', place: awaseLocked(awase) ? 'park' : awase }
    if (day === 'jishuren') return { type: 'jishuren', kind: jishuren }
    if (day === 'baito') return { type: 'baito', kind: baito }
    return { type: day } as DayAction
  }
  const buildNight = (): NightAction => (curNight.startsWith('nomi:') ? { type: 'nomi', senior: curNight.slice(5) } : ({ type: curNight } as NightAction))

  const weakest = STAT_KEYS.reduce((a, b) => (state.stats[b] < state.stats[a] ? b : a))
  const nightOptions = [
    ...state.seniors.map((sr) => ({ k: `nomi:${sr.id}`, label: '先輩の飲み', hint: '仲＋・食費が浮く・体調−', tag: `${sr.name}さん` })),
    { k: 'douki', label: '同期と飲む', hint: '3,000円／結束・やる気＋', tag: '' },
    { k: 'netacho', label: 'ネタ帳を書く', hint: '完成度＋', tag: '' },
    { k: 'egosa', label: 'エゴサする', hint: 'やる気が上下する', tag: '' },
    { k: 'sleep', label: '早く寝る', hint: '体調＋', tag: '' },
  ]
  const dayLabel = DAY_OPTIONS.find((o) => o.key === curDay)!.label
  const nightLabel = nightOptions.find((o) => o.k === curNight)?.label ?? ''
  // 休むは8回目で出席不足（3月の卒業認定で救済の手伝い）。残りを見せる
  const restLeft = 8 - (state.counters.rest ?? 0)
  const dayTag = (k: DayKey) =>
    k === 'awase' && state.partner ? `${state.partner.name}と！` : k === 'rest' ? (restLeft > 0 ? `あと${restLeft}回で出席不足` : '出席不足') : ''

  return (
    <div className="screen week">
      <span className="blob" style={{ right: -60, top: -60, width: 220, height: 220, background: 'var(--sun)' }} />
      <span className="blob" style={{ left: -40, top: 320, width: 120, height: 120, background: 'var(--coral-light)' }} />

      <header className="week-head">
        <div>
          <div className="week-left">のこり{TOTAL_TURNS - state.turn}週</div>
          <div className="date">{weekLabel(state.turn)}</div>
          <div className="week-sub">
            同期 {state.classmates}人{state.classRank !== 'none' && ` ／ ${CLASS_LABEL[state.classRank]}`}
          </div>
        </div>
        <div className={`money ${state.money < 20000 ? 'low' : ''}`}>¥{state.money.toLocaleString()}</div>
      </header>

      <section className="card me">
        <div className="me-face">
          <PlayerAvatar player={p} size={78} />
        </div>
        <div className="me-body">
          <div className="me-name">
            {p.callName}
            {state.comboName && <span className="combo">{state.comboName}</span>}
          </div>
          <Bar label="体調" value={state.condition} tone={state.condition < 30 ? 'warn' : undefined} />
          <Bar label="やる気" value={state.motivation} tone={state.motivation < 30 ? 'warn' : 'good'} />
        </div>
      </section>

      <div className="stats">
        {STAT_KEYS.map((k) => (
          <div key={k} className={`stat ${k === weakest ? 'weak' : ''}`}>
            <span>{STAT_LABEL[k]}</span>
            <b>{Math.round(state.stats[k])}</b>
          </div>
        ))}
      </div>

      <div className="stat-row">
        <button onClick={() => setSheet('neta')}>ネタ帳（{Math.round(state.neta.polish)}）</button>
        <button onClick={() => setSheet('people')}>人間関係</button>
        <button onClick={() => setSheet('skills')}>特殊能力（{state.skills.length}）</button>
      </div>

      <div className="row-between">
        <h2 className="section-title">今週の企画</h2>
        <div className="steps" aria-label="予定を決める順番">
          <button className={tab === 'day' ? 'on' : 'done'} onClick={() => setTab('day')} disabled={tab === 'day'}>
            ① 昼
          </button>
          <span aria-hidden="true">→</span>
          <span className={tab === 'night' ? 'on' : ''}>② 夜</span>
        </div>
      </div>

      {tab === 'day' ? (
        <>
          {mustWork && <p className="warn-note">来週の家賃と食費（¥{need.toLocaleString()}）が払えない。今週はバイトしかない。</p>}
          <div className="tiles">
            {DAY_OPTIONS.map((o) => (
              <button
                key={o.key}
                className={`tile ${curDay === o.key ? 'on' : ''}`}
                onClick={() => setDay(o.key)}
                disabled={!!dayLocked(o.key)}
              >
                {dayLocked(o.key) ? <span className="tile-tag lock">{dayLocked(o.key)}</span> : dayTag(o.key) && <span className="tile-tag">{dayTag(o.key)}</span>}
                <span className="tile-name">{o.label}</span>
                <span className="tile-hint">{o.hint}</span>
              </button>
            ))}
          </div>
          {curDay === 'awase' && <Sub items={AWASE} value={awase} onChange={setAwase} locked={awaseLocked} />}
          {curDay === 'jishuren' && <Sub items={JISHUREN} value={jishuren} onChange={setJishuren} />}
          {curDay === 'baito' && <Sub items={BAITO} value={baito} onChange={setBaito} />}
        </>
      ) : (
        <div className="tiles">
          {nightOptions.map((o) => (
            <button key={o.k} className={`tile ${curNight === o.k ? 'on' : ''}`} onClick={() => setNight(o.k)} disabled={!!nightLocked(o.k)}>
              {nightLocked(o.k) ? <span className="tile-tag lock">{nightLocked(o.k)}</span> : o.tag && <span className="tile-tag">{o.tag}</span>}
              <span className="tile-name">{o.label}</span>
              <span className="tile-hint">{o.hint}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'day' ? (
        <button
          className="primary big sticky"
          onClick={() => setTab('night')}
        >
          昼はこれ！
          <span className="go-sub">昼：{dayLabel} → 次は夜の予定</span>
        </button>
      ) : (
        <button className="primary big sticky" onClick={() => onRun(buildDay(), buildNight())}>
          これでいく！
          <span className="go-sub">
            昼：{dayLabel} ／ 夜：{nightLabel}
          </span>
        </button>
      )}

      {sheet === 'neta' && (
        <Modal title="ネタ帳" onNext={() => setSheet(null)} nextLabel="閉じる">
          <NetaPanel state={state} editable onChange={onNeta} />
        </Modal>
      )}
      {sheet === 'people' && (
        <Modal title="人間関係" onNext={() => setSheet(null)} nextLabel="閉じる">
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
        </Modal>
      )}
      {sheet === 'skills' && (
        <Modal title="特殊能力" onNext={() => setSheet(null)} nextLabel="閉じる">
          {state.skills.length === 0 ? (
            <p className="small">まだ何もない。人と仲良くなったり、ネタ見せで結果を出すと身につく。</p>
          ) : (
            <>
              <p className="small">タップすると効果が見られる。</p>
              <div className="skills">
                {state.skills.map((id) => (
                  <button key={id} className={`skill-pick ${skill === id ? 'on' : ''}`} onClick={() => setSkill(skill === id ? null : id)}>
                    <SkillBadge id={id} />
                  </button>
                ))}
              </div>
              {skill && SKILL_BY_ID[skill] && (
                <div className="skill-desc">
                  <b>{SKILL_BY_ID[skill].name}</b>
                  {state.gifts?.[skill] && <span className="small">（{state.gifts[skill]}から受け継いだ）</span>}
                  <p>{SKILL_BY_ID[skill].desc}</p>
                </div>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

function Sub<T extends string>({ items, value, onChange, locked }: { items: readonly { v: T; label: string }[]; value: T; onChange: (v: T) => void; locked?: (v: T) => string }) {
  return (
    <div className="chips sub">
      {items.map((i) => (
        <button key={i.v} className={`chip ${i.v === value ? 'on' : ''}`} onClick={() => onChange(i.v)} disabled={!!locked?.(i.v)}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

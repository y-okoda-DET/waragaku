import { useState } from 'react'
import { weekLabel } from '../game/data/calendar'
import { storyView } from '../game/events'
import { conditionWarning, STAGES } from '../game/stage'
import type { GameState, StageKind, StageResult } from '../game/types'
import { AdvScreen } from './Adv'
import { pushLog } from './log'
import { NetaPanel } from './NetaPanel'

export function StoryScreen({ state, eventKey, params, onChoose }: { state: GameState; eventKey: string; params?: Record<string, string | number>; onChoose: (choice: number, text?: string) => void }) {
  const view = storyView(state, eventKey, params)
  const [text, setText] = useState('')
  // 選んだあとの相手の反応。選択肢がセリフ（「…」）なら、まず主人公がそれを言う
  const [picked, setPicked] = useState<number | null>(null)
  const choose = (i: number) => {
    const c = view.choices[i]
    const spoken = c.label.startsWith('「') && c.label.endsWith('」')
    if (!spoken || !c.reply) pushLog({ text: c.label, choice: true })
    const reply = c.reply ? (Array.isArray(c.reply) ? c.reply : [c.reply]) : []
    if (reply.length) setPicked(i)
    else onChoose(i)
  }
  if (picked !== null) {
    const c = view.choices[picked]
    const reply = Array.isArray(c.reply) ? c.reply : [c.reply ?? '']
    const said = c.label.startsWith('「') && c.label.endsWith('」') ? [`${state.player.callName}（ふつう）${c.label}`] : []
    return <AdvScreen key="reply" state={state} title={view.title} lines={[...said, ...reply]} place={view.place} onEnd={() => onChoose(picked)} />
  }
  const after = view.input ? (
    <div className="card input-card">
      <p className="input-label">自分で考える（候補から選んでもいい）</p>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={view.input.placeholder} maxLength={14} />
      <div className="chips">
        {view.input.suggestions.map((sg) => (
          <button key={sg} className="chip" onClick={() => setText(sg)}>
            {sg}
          </button>
        ))}
      </div>
      <button className="primary" disabled={!text.trim()} onClick={() => onChoose(0, text)}>
        これにする
      </button>
    </div>
  ) : view.choices.length ? (
    <div className="options">
      {view.choices.map((c, i) => (
        <button key={i} className="option" onClick={() => choose(i)} disabled={!!c.locked}>
          <span>{c.label}</span>
          {(c.locked || c.hint) && <span className="small">{c.locked ? `${c.locked}（${c.hint}）` : c.hint}</span>}
        </button>
      ))}
    </div>
  ) : undefined
  return <AdvScreen state={state} title={view.title} lines={view.lines} place={view.place} after={after} onEnd={() => onChoose(0)} />
}

export function StageIntro({ state, kind, onPerform, onNeta }: { state: GameState; kind: StageKind; onPerform: () => void; onNeta: (s: GameState) => void }) {
  const spec = STAGES[kind]
  const [edit, setEdit] = useState(false)
  return (
    <div className="screen event">
      <div className="date small">{weekLabel(Math.min(state.turn, 41))}</div>
      <article className="card story stage">
        <div className="small">{spec.venue}</div>
        <h1>{spec.title}</h1>
        {spec.intro.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </article>
      <section className="card">
        <div className="row-between">
          <h2>今日のネタ</h2>
          <button className="link" onClick={() => setEdit((v) => !v)}>
            {edit ? '決めた' : '組み替える'}
          </button>
        </div>
        <NetaPanel state={state} editable={edit} onChange={onNeta} />
      </section>
      {conditionWarning(state) && <p className="warn-note">{conditionWarning(state)}</p>}
      <button className="primary big" onClick={onPerform}>
        出囃子が鳴る（本番）
      </button>
    </div>
  )
}

const LEVEL_LABEL = ['スベった', 'まばら', 'ウケた', '爆笑']
const LEVEL_SOUND = ['シーン…', 'クスッ', 'ドッ', 'ドッカン']
const LEVEL_CELLS = [2, 4, 7, 10]

export function StageResultView({ result }: { result: StageResult }) {
  const cells = LEVEL_CELLS[result.level]
  return (
    <div className={`stage-result level-${result.level}`}>
      <div className="studio">
        <span className="blob" style={{ left: -60, top: 30, width: 220, height: 220, background: 'var(--sun-light)' }} />
        <span className="blob" style={{ right: -70, top: -50, width: 240, height: 240, background: '#ffb52e' }} />
        <span className="studio-title">{result.title}</span>
        <span className="dokkan" aria-hidden="true">
          {LEVEL_SOUND[result.level]}
        </span>
        {result.verdict && (
          <div className={`verdict ${result.verdict.good ? 'good' : 'bad'}`}>
            <small>{result.verdict.head}</small>
            <b>{result.verdict.text}</b>
          </div>
        )}
        <div className="telop">
          <span className="telop-tag">講師・客席</span>
          <span className="telop-text">{result.comment}</span>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="meter-head">
          <span>客席の笑い</span>
          <b>{LEVEL_LABEL[result.level]}</b>
        </div>
        <div className="laugh-meter" aria-label={LEVEL_LABEL[result.level]}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={i < cells - 1 ? 'on' : i === cells - 1 ? 'on edge' : ''} />
          ))}
        </div>
        {result.summary && <p className="summary">{result.summary}</p>}
        {result.tally && (
          <div className="tally">
            <span>笑い<b>{result.tally.warai}</b></span>
            <span>スベリ<b>{result.tally.suberi}</b></span>
            <span>噛み<b>{result.tally.kami}</b></span>
            <span>ネタ飛ばし<b>{result.tally.tobashi}</b></span>
            <span>拍手笑い<b>{result.tally.hakushu}</b></span>
            <span className={result.tally.dokudan ? 'on' : ''}>独壇場<b>{result.tally.dokudan ? 'あり' : '―'}</b></span>
          </div>
        )}
        {result.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      {result.why && (
        <div className="card why" style={{ marginTop: 12 }}>
          <h2>点数の内訳</h2>
          {result.why.map((w) => (
            <div key={w.label} className={`why-row${w.label === '合計' ? ' total' : ''}`}>
              <span>{w.label}</span>
              <b>{w.text}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

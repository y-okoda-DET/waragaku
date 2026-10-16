import { useState } from 'react'
import { weekLabel } from '../game/data/calendar'
import { storyView } from '../game/events'
import { STAGES } from '../game/stage'
import type { GameState, StageKind, StageResult } from '../game/types'
import { NetaPanel } from './NetaPanel'

export function StoryScreen({ state, eventKey, params, onChoose }: { state: GameState; eventKey: string; params?: Record<string, string | number>; onChoose: (choice: number, text?: string) => void }) {
  const view = storyView(state, eventKey, params)
  const [text, setText] = useState('')
  return (
    <div className="screen event">
      <div className="date small">{weekLabel(Math.min(state.turn, 41))}</div>
      <article className="card story">
        <h1>{view.title}</h1>
        {view.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </article>
      {view.input ? (
        <div className="card">
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
            <button key={i} className="option" onClick={() => onChoose(i)}>
              <span>{c.label}</span>
              {c.hint && <span className="small">{c.hint}</span>}
            </button>
          ))}
        </div>
      ) : (
        <button className="primary big" onClick={() => onChoose(0)}>
          次へ
        </button>
      )}
    </div>
  )
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
    </div>
  )
}

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

export function StageResultView({ result }: { result: StageResult }) {
  return (
    <div className={`stage-result level-${result.level}`}>
      <div className="laugh-meter" aria-label={LEVEL_LABEL[result.level]}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= result.level ? 'on' : ''} />
        ))}
      </div>
      <div className="level-label">{LEVEL_LABEL[result.level]}</div>
      {result.lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
      <p className="comment">{result.comment}</p>
    </div>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AUDIENCE_TASTE, LEAN_LABEL, gradeTsukkomi, gradeWord, maDuration, needleShake, playerLean, shuffledOptions, tsukkomiZones, wordHint, type Scene, type ShowcaseGrade, type TsukkomiScene, type WordScene } from '../game/showcase'
import { STAGES } from '../game/stage'
import type { GameState, StageKind } from '../game/types'

const GRADE_SOUND: Record<ShowcaseGrade, string> = { great: 'ドッ', good: 'クスッ', miss: 'シーン…' }

// 見せ場を順番に遊ばせ、全部終わったら出来をまとめて返す
export function ShowcaseScreen({ state, kind, scenes, onDone, nextLabel = '続きは結果で', footer }: { state: GameState; kind: StageKind; scenes: Scene[]; onDone: (grades: ShowcaseGrade[]) => void; nextLabel?: string; footer?: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [grades, setGrades] = useState<ShowcaseGrade[]>([])
  const scene = scenes[index]
  const partner = state.partner?.name ?? '相方'

  const finish = (g: ShowcaseGrade) => {
    const next = [...grades, g]
    if (index + 1 < scenes.length) {
      setGrades(next)
      setIndex(index + 1)
    } else onDone(next)
  }

  return (
    <div className="screen event showcase">
      <div className="row-between">
        <span className="studio-title">{STAGES[kind].title}</span>
        <span className="sc-step">
          見せ場 {index + 1} / {scenes.length}
        </span>
      </div>
      {scene.kind === 'word' ? (
        <WordGame key={index} state={state} kind={kind} seed={state.turn * 31 + state.stageHistory.length * 7 + index} scene={scene} partner={partner} nextLabel={nextLabel} onDone={finish} />
      ) : (
        <TsukkomiGame key={index} state={state} kind={kind} scene={scene} partner={partner} nextLabel={nextLabel} onDone={finish} />
      )}
      {footer}
    </div>
  )
}

function Outcome({ grade, label, nextLabel, onNext }: { grade: ShowcaseGrade; label: string; nextLabel: string; onNext: () => void }) {
  return (
    <>
      <div className={`sc-outcome grade-${grade}`}>
        <span className="sc-sound" aria-hidden="true">
          {GRADE_SOUND[grade]}
        </span>
        <span className="sc-label">{label}</span>
      </div>
      <button className="primary big" onClick={onNext}>
        {nextLabel}
      </button>
    </>
  )
}

const WORD_SECONDS = 8

function WordGame({ state, kind, seed, scene, partner, nextLabel, onDone }: { state: GameState; kind: StageKind; seed: number; scene: WordScene; partner: string; nextLabel: string; onDone: (g: ShowcaseGrade) => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [left, setLeft] = useState(WORD_SECONDS)
  const hint = wordHint(state)
  const [options] = useState(() => shuffledOptions(scene, seed))
  const grades = options.map((o) => gradeWord(state, kind, o.flavor))
  const taste = AUDIENCE_TASTE[STAGES[kind].audience]

  useEffect(() => {
    if (picked !== null || timedOut) return
    if (left <= 0) {
      setTimedOut(true)
      return
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [left, picked, timedOut])

  const done = picked !== null || timedOut
  const opt = picked !== null ? options[picked] : null
  const grade: ShowcaseGrade = picked !== null ? grades[picked] : 'miss'

  return (
    <>
      <div className="studio sc-stage">
        <span className="blob" style={{ right: -70, top: -50, width: 220, height: 220, background: '#ffb52e' }} />
        <div className="sc-bubble">
          <span className="telop-tag">{partner}</span>
          <span className="sc-line">「{scene.furi}」</span>
        </div>
        {done && <div className={`sc-answer ${grade === 'miss' ? 'off' : ''}`}>{opt ? `「${opt.text}」` : '（……考えすぎて、間が空いた）'}</div>}
        {done && opt && <div className="sc-react">{partner}{opt.react}</div>}
      </div>
      {!done ? (
        <>
          <div className="sc-timer" aria-label={`残り${left}秒`}>
            <span style={{ width: `${(left / WORD_SECONDS) * 100}%` }} />
          </div>
          <div className="sc-read">
            <span>
              <b>客席</b>
              {taste.label}
            </span>
            <span>
              <b>芸風</b>
              {LEAN_LABEL[playerLean(state)]}
            </span>
          </div>
          <p className="sc-help">ボケで返す。今日の客に一番ウケるのはどれ？</p>
          <div className="options">
            {options.map((o, i) => (
              <button key={i} className={`option sc-opt ${hint && grades[i] === 'great' ? 'hint' : ''}`} onClick={() => setPicked(i)}>
                <span>{o.text}</span>
                {hint && grades[i] === 'great' && <span className="small">ピンときた</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <Outcome nextLabel={nextLabel} grade={grade} label={grade === 'great' ? '会心のボケ' : grade === 'good' ? (opt?.flavor === playerLean(state) ? '客には少し遠かった' : '自分らしさは薄かった') : timedOut ? '時間切れ' : '外した'} onNext={() => onDone(grade)} />
      )}
    </>
  )
}

const TYPE_MS = 45

function TsukkomiGame({ state, kind, scene, partner, nextLabel, onDone }: { state: GameState; kind: StageKind; scene: TsukkomiScene; partner: string; nextLabel: string; onDone: (g: ShowcaseGrade) => void }) {
  const [shown, setShown] = useState(0)
  const [ma, setMa] = useState(0)
  const [result, setResult] = useState<{ grade: ShowcaseGrade; label: string } | null>(null)
  const start = useRef<number | null>(null)
  const zones = tsukkomiZones(state, scene, kind)
  const duration = maDuration(kind)
  const shake = needleShake(state, kind)
  const typing = shown < scene.boke.length

  // ボケを1文字ずつ出す
  useEffect(() => {
    if (!typing || result) return
    const t = setTimeout(() => setShown((v) => v + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [shown, typing, result])

  // 言い終わってから「間」が満ちていく
  useEffect(() => {
    if (typing || result) return
    let raf = 0
    const tick = (now: number) => {
      if (start.current === null) start.current = now
      const t = (now - start.current) / duration
      // 緊張で針が小刻みに揺れる
      const v = Math.max(0, Math.min(1, t + Math.sin(t * 40) * shake))
      setMa(v)
      if (t >= 1) setResult(gradeTsukkomi(state, scene, kind, null))
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [typing, result, state, scene, kind, duration, shake])

  const tap = () => {
    if (result) return
    // 言い終わる前のツッコミは、かなりの食い気味
    setResult(gradeTsukkomi(state, scene, kind, typing ? 0 : ma))
  }

  return (
    <>
      <div className="studio sc-stage">
        <span className="blob" style={{ right: -70, top: -50, width: 220, height: 220, background: '#ffb52e' }} />
        <div className="sc-bubble">
          <span className="telop-tag">{partner}</span>
          <span className="sc-line">「{scene.boke.slice(0, shown)}」</span>
        </div>
        {result && <div className={`sc-answer ${result.grade === 'miss' ? 'off' : ''}`}>{result.label === 'ツッコミ忘れ' ? '（……ツッコミそびれた）' : `「${scene.tsukkomi}」`}</div>}
      </div>
      {!result ? (
        <>
          <div className="sc-ma" aria-hidden="true">
            <span className="sc-zone good" style={{ left: `${zones.good.from * 100}%`, width: `${(zones.good.to - zones.good.from) * 100}%` }} />
            <span className="sc-zone great" style={{ left: `${zones.great.from * 100}%`, width: `${(zones.great.to - zones.great.from) * 100}%` }} />
            <span className="sc-needle" style={{ left: `${ma * 100}%` }} />
          </div>
          <div className="sc-legend" aria-hidden="true">
            <span className="good">クスッ</span>
            <span className="great">ドッ</span>
          </div>
          <p className="sc-help">{typing ? 'ボケを最後まで聞いて……' : '赤い「ドッ」の間を狙ってツッコむ！'}</p>
          {shake > 0.01 && <p className="small center">大舞台で手が震えている（度胸が低いと針がブレる）</p>}
          <button className="primary big sc-tap" onClick={tap}>
            ツッコむ！
          </button>
        </>
      ) : (
        <Outcome nextLabel={nextLabel} grade={result.grade} label={result.label} onNext={() => onDone(result.grade)} />
      )}
    </>
  )
}

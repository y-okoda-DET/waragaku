import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AUDIENCE_TASTE, LEAN_LABEL, gradeBlackout, gradeConte, gradeRole, gradeTsukkomi, gradeWord, roleBand, roleDrift, maDuration, needleShake, playerLean, rememberPicks, shuffledOptions, tsukkomiZones, wordHint, type ConteScene, type ConteSetting, type Scene, type ShowcaseGrade, type ShowcasePick, type TsukkomiScene, type WordScene } from '../game/showcase'
import { STAGES, conditionWarning } from '../game/stage'
import type { GameState, StageKind } from '../game/types'
import { background, charaKey, heroKey, portrait, type Expr } from './art'

const GRADE_SOUND: Record<ShowcaseGrade, string> = { great: 'ドッ', good: 'クスッ', miss: 'シーン…' }

// 見せ場を順番に遊ばせ、全部終わったら出来をまとめて返す
export function ShowcaseScreen({ state, kind, scenes, onDone, nextLabel = '続きは結果で', footer }: { state: GameState; kind: StageKind; scenes: Scene[]; onDone: (grades: ShowcaseGrade[]) => void; nextLabel?: string; footer?: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<ShowcasePick[]>([])
  const scene = scenes[index]
  const partner = state.partner?.name ?? '相方'
  const warning = conditionWarning(state)

  // 何を言ったかも覚えておき、結果文で引用する
  const finish = (pick: ShowcasePick) => {
    const next = [...picks, pick]
    if (index + 1 < scenes.length) {
      setPicks(next)
      setIndex(index + 1)
    } else {
      rememberPicks(state, kind, next)
      onDone(next.map((p) => p.grade))
    }
  }

  return (
    <div className="screen event showcase">
      <div className="row-between">
        <span className="studio-title">{STAGES[kind].title}</span>
        <span className="sc-step">
          見せ場 {index + 1} / {scenes.length}
        </span>
      </div>
      {scene.conte && <ConteLabel conte={scene.conte} />}
      {warning && (
        <p className="small center" style={{ color: 'var(--coral)', fontWeight: 900, margin: 0 }}>
          {warning}
        </p>
      )}
      {scene.kind === 'conte' ? (
        <ConteGame key={index} state={state} kind={kind} seed={state.turn * 31 + state.stageHistory.length * 7 + index} scene={scene} partner={partner} nextLabel={nextLabel} onDone={finish} />
      ) : scene.kind === 'word' ? (
        <WordGame key={index} state={state} kind={kind} seed={state.turn * 31 + state.stageHistory.length * 7 + index} scene={scene} partner={partner} nextLabel={nextLabel} onDone={finish} />
      ) : (
        <TsukkomiGame key={index} state={state} kind={kind} scene={scene} partner={partner} nextLabel={nextLabel} onDone={finish} />
      )}
      {footer}
    </div>
  )
}

// コントの設定。どこで、自分と相方が誰を演じているか
function ConteLabel({ conte }: { conte: ConteSetting }) {
  return (
    <div className="sc-read">
      <span>
        <b>設定</b>
        {conte.place}（自分＝{conte.me}／相方＝{conte.you}）
      </span>
    </div>
  )
}

// 舞台の絵。会場の背景に、主人公と相方を並べる。ウケたら笑い、スベったら落ち込む
const VENUE: Record<StageKind, string> = {
  netamise: 'kyoushitsu',
  live: 'koudou',
  contest_conte: 'livehouse',
  contest_manzai: 'livehouse',
  gasshuku: 'koudou',
  tozai: 'butai',
  grad_prelim: 'butai',
  grad_final: 'butai',
}
const FACES: Record<ShowcaseGrade | 'wait', [Expr, Expr]> = {
  wait: ['normal', 'normal'],
  great: ['laugh', 'laugh'],
  good: ['smile', 'smile'],
  miss: ['surprise', 'down'],
}
function Stage({ state, kind, mood = 'wait', blackout = false, children }: { state: GameState; kind: StageKind; mood?: ShowcaseGrade | 'wait'; blackout?: boolean; children: ReactNode }) {
  const bg = background(VENUE[kind])
  const [me, you] = FACES[mood]
  const hero = portrait(heroKey(state.player.gender, state.player.background), me)
  const partner = state.partner ? portrait(charaKey(state, state.partner.name), you) : undefined
  return (
    <div className={`studio sc-stage ${bg ? 'has-bg' : ''} ${blackout ? 'blackout' : ''}`} style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
      {!bg && <span className="blob" style={{ right: -70, top: -50, width: 220, height: 220, background: '#ffb52e' }} />}
      <div className="sc-people" aria-hidden="true">
        {hero && <img src={hero} alt="" draggable={false} />}
        {partner && <img src={partner} alt="" draggable={false} />}
      </div>
      <div className="sc-layer">{children}</div>
    </div>
  )
}

// 吹き出しの名札。コントのときは役名を添える
function speaker(partner: string, conte?: ConteSetting): string {
  return conte ? `${partner}（${conte.you}）` : partner
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

function WordGame({ state, kind, seed, scene, partner, nextLabel, onDone }: { state: GameState; kind: StageKind; seed: number; scene: WordScene; partner: string; nextLabel: string; onDone: (p: ShowcasePick) => void }) {
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
      <Stage state={state} kind={kind} mood={done ? grade : 'wait'}>
        <div className="sc-bubble">
          <span className="telop-tag">{speaker(partner, scene.conte)}</span>
          <span className="sc-line">「{scene.furi}」</span>
        </div>
        {done && <div className={`sc-answer ${grade === 'miss' ? 'off' : ''}`}>{opt ? `「${opt.text}」` : '（……考えすぎて、間が空いた）'}</div>}
        {done && opt && (
          <div className="sc-react">
            {speaker(partner, scene.conte)}
            {opt.react}
          </div>
        )}
      </Stage>
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
          <p className="sc-help">{scene.conte ? `${scene.conte.me}になりきって、ボケで返す。一番ウケるのはどれ？` : 'ボケで返す。今日の客に一番ウケるのはどれ？'}</p>
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
        <Outcome nextLabel={nextLabel} grade={grade} label={grade === 'great' ? '会心のボケ' : grade === 'good' ? (opt?.flavor === playerLean(state) ? '客には少し遠かった' : '自分らしさは薄かった') : timedOut ? '時間切れ' : '外した'} onNext={() => onDone({ grade, said: opt?.text })} />
      )}
    </>
  )
}

const TYPE_MS = 45

function TsukkomiGame({ state, kind, scene, partner, nextLabel, onDone }: { state: GameState; kind: StageKind; scene: TsukkomiScene; partner: string; nextLabel: string; onDone: (p: ShowcasePick) => void }) {
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
      <Stage state={state} kind={kind} mood={result ? result.grade : 'wait'}>
        <div className="sc-bubble">
          <span className="telop-tag">{speaker(partner, scene.conte)}</span>
          <span className="sc-line">「{scene.boke.slice(0, shown)}」</span>
        </div>
        {result && <div className={`sc-answer ${result.grade === 'miss' ? 'off' : ''}`}>{result.label === 'ツッコミ忘れ' ? '（……ツッコミそびれた）' : `「${scene.tsukkomi}」`}</div>}
      </Stage>
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
          <p className="sc-help">{typing ? 'ボケを最後まで聞いて……' : scene.conte ? `${scene.conte.me}のまま、赤い「ドッ」の間でツッコむ！` : '赤い「ドッ」の間を狙ってツッコむ！'}</p>
          {shake > 0.01 && <p className="small center">大舞台で手が震えている（度胸が低いと針がブレる）</p>}
          <button className="primary big sc-tap" onClick={tap}>
            ツッコむ！
          </button>
        </>
      ) : (
        <Outcome nextLabel={nextLabel} grade={result.grade} label={result.label} onNext={() => onDone(result)} />
      )}
    </>
  )
}

const BEAT_NAME = ['設定に入る', '役を演じ切る', '暗転前のオチ']
// 役の山は、相方のセリフをゆっくり出して、ゲージを保つ時間を作る
const ROLE_TYPE_MS = 80
const ROLE_TAIL_MS = 1000
const ROLE_GRACE_MS = 600

// コントの見せ場。入り（3択）→ 役（ゲージを帯に保つ）→ オチ（暗転のきっかけ）の順に遊ぶ
function ConteGame({ state, kind, seed, scene, partner, nextLabel, onDone }: { state: GameState; kind: StageKind; seed: number; scene: ConteScene; partner: string; nextLabel: string; onDone: (p: ShowcasePick) => void }) {
  const [beat, setBeat] = useState(0)
  const [beats, setBeats] = useState<{ grade: ShowcaseGrade; label: string }[]>([])
  const [said, setSaid] = useState<string | undefined>()
  const settled = beats.length > beat
  const next = () => setBeat((b) => b + 1)
  // 子の山はこのコールバックを effect の依存に持つので、山が変わるまで同じ関数を渡す
  const record = useCallback((r: { grade: ShowcaseGrade; label: string }) => setBeats((bs) => (bs.length > beat ? bs : [...bs, r])), [beat])
  const pickOpen = useCallback(
    (r: { grade: ShowcaseGrade; label: string }, text?: string) => {
      setSaid(text)
      record(r)
    },
    [record],
  )

  if (beat >= 3) {
    const grade = gradeConte(beats.map((b) => b.grade))
    return (
      <>
        <Stage state={state} kind={kind} mood={grade}>
          {null}
        </Stage>
        <div className="sc-read conte-beats">
          {beats.map((b, i) => (
            <span key={i} className={`grade-${b.grade}`}>
              <b>{BEAT_NAME[i]}</b>
              {GRADE_SOUND[b.grade]} {b.label}
            </span>
          ))}
        </div>
        <Outcome nextLabel={nextLabel} grade={grade} label={grade === 'great' ? 'コントの世界に連れていった' : grade === 'good' ? 'あと一歩' : '世界に入れなかった'} onNext={() => onDone({ grade, said, label: beats.map((b) => b.label).join('／'), beats: beats.map((b) => b.grade) })} />
      </>
    )
  }

  return (
    <>
      <div className="sc-steps" aria-label={`${beat + 1}つ目の山`}>
        {BEAT_NAME.map((n, i) => (
          <span key={n} className={i === beat ? 'on' : i < beat ? `done grade-${beats[i]?.grade}` : ''}>
            {i + 1}. {n}
          </span>
        ))}
      </div>
      {beat === 0 && <ConteOpen state={state} kind={kind} seed={seed} scene={scene} result={beats[0]} onPick={pickOpen} />}
      {beat === 1 && <ConteRole state={state} kind={kind} scene={scene} partner={partner} result={beats[1]} onEnd={record} />}
      {beat === 2 && <ConteOchi state={state} kind={kind} scene={scene} partner={partner} result={beats[2]} onEnd={record} />}
      {settled && (
        <button className="primary big" onClick={next}>
          {beat === 0 ? 'コントが始まる' : beat === 1 ? 'オチへ' : '舞台を下りる'}
        </button>
      )}
    </>
  )
}

function BeatResult({ r }: { r: { grade: ShowcaseGrade; label: string } }) {
  return (
    <div className={`sc-outcome small-outcome grade-${r.grade}`}>
      <span className="sc-sound" aria-hidden="true">
        {GRADE_SOUND[r.grade]}
      </span>
      <span className="sc-label">{r.label}</span>
    </div>
  )
}

function ConteOpen({ state, kind, seed, scene, result, onPick }: { state: GameState; kind: StageKind; seed: number; scene: ConteScene; result?: { grade: ShowcaseGrade; label: string }; onPick: (r: { grade: ShowcaseGrade; label: string }, text?: string) => void }) {
  const [options] = useState(() => shuffledOptions({ options: scene.open }, seed))
  const [left, setLeft] = useState(WORD_SECONDS)
  const [picked, setPicked] = useState<number | null>(null)
  const taste = AUDIENCE_TASTE[STAGES[kind].audience]
  const hint = wordHint(state)
  const grades = options.map((o) => gradeWord(state, kind, o.flavor))

  useEffect(() => {
    if (result) return
    if (left <= 0) {
      onPick({ grade: 'miss', label: '出だしで固まった' })
      return
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [left, result, onPick])

  const pick = (i: number) => {
    setPicked(i)
    const o = options[i]
    const g = grades[i]
    onPick({ grade: g, label: o.flavor === 'flat' ? '説明しすぎた' : g === 'great' ? 'ひと目で世界が伝わった' : '伝わったが、引きは弱い' }, o.text)
  }

  return (
    <>
      <Stage state={state} kind={kind} mood={result ? result.grade : 'wait'}>
        <div className="sc-bubble">
          <span className="telop-tag">明転</span>
          <span className="sc-line">{result ? (picked !== null ? options[picked].text : '（……第一声が出ない）') : `${scene.conte.place}。${scene.conte.me}として、最初に何をする？`}</span>
        </div>
      </Stage>
      {!result ? (
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
          <p className="sc-help">最初の一言・一動作で、どこで誰なのかを見せる。説明セリフは客が冷める。</p>
          <div className="options">
            {options.map((o, i) => (
              <button key={i} className={`option sc-opt ${hint && grades[i] === 'great' ? 'hint' : ''}`} onClick={() => pick(i)}>
                <span>{o.text}</span>
                {hint && grades[i] === 'great' && <span className="small">ピンときた</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <BeatResult r={result} />
      )}
    </>
  )
}

function ConteRole({ state, kind, scene, partner, result, onEnd }: { state: GameState; kind: StageKind; scene: ConteScene; partner: string; result?: { grade: ShowcaseGrade; label: string }; onEnd: (r: { grade: ShowcaseGrade; label: string }) => void }) {
  const [shown, setShown] = useState(0)
  const [level, setLevel] = useState(0.3)
  const holding = useRef(false)
  const band = roleBand(state, kind)
  const drift = roleDrift(state, kind)
  const total = scene.role.length * ROLE_TYPE_MS + ROLE_TAIL_MS

  useEffect(() => {
    if (result) return
    let raf = 0
    let last: number | null = null
    let start: number | null = null
    let p = 0.3
    const time = { inside: 0, low: 0, high: 0 }
    const phase = Math.random() * 6
    const tick = (now: number) => {
      if (start === null) start = last = now
      const dt = Math.min(50, now - last!) / 1000
      last = now
      const el = now - start
      // 押すと役が濃くなり、離すと素に戻っていく。度胸が低いと勝手に揺れる
      p += ((holding.current ? 0.7 : -0.55) + Math.sin(el * 0.006 + phase) * drift * 5) * dt
      p = Math.max(0, Math.min(1, p))
      if (el > ROLE_GRACE_MS) {
        if (p < band.from) time.low += dt
        else if (p > band.to) time.high += dt
        else time.inside += dt
      }
      setLevel(p)
      setShown(Math.min(scene.role.length, Math.floor(el / ROLE_TYPE_MS)))
      if (el >= total) {
        const sum = time.inside + time.low + time.high || 1
        onEnd(gradeRole(time.inside / sum, time.low / sum, time.high / sum))
      } else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [result, band.from, band.to, drift, total, scene.role.length, onEnd])

  const down = () => (holding.current = true)
  const up = () => (holding.current = false)

  return (
    <>
      <Stage state={state} kind={kind} mood={result ? result.grade : 'wait'}>
        <div className="sc-bubble">
          <span className="telop-tag">{speaker(partner, scene.conte)}</span>
          <span className="sc-line">「{result ? scene.role : scene.role.slice(0, shown)}」</span>
        </div>
        {result && <div className={`sc-answer ${result.grade === 'miss' ? 'off' : ''}`}>「{scene.uke}」</div>}
      </Stage>
      {!result ? (
        <>
          <div className="sc-ma role-meter" aria-hidden="true">
            <span className="sc-zone great" style={{ left: `${band.from * 100}%`, width: `${(band.to - band.from) * 100}%` }} />
            <span className="sc-needle" style={{ left: `${level * 100}%` }} />
          </div>
          <div className="sc-legend role-legend" aria-hidden="true">
            <span>素が出る</span>
            <span className="great">役</span>
            <span>やりすぎ</span>
          </div>
          <p className="sc-help">{scene.conte.me}のまま、相方のボケを受け切る。押している間は役が濃くなる。赤い帯に保とう。</p>
          <button className="primary big sc-tap" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
            役に入る（長押し）
          </button>
        </>
      ) : (
        <BeatResult r={result} />
      )}
    </>
  )
}

function ConteOchi({ state, kind, scene, partner, result, onEnd }: { state: GameState; kind: StageKind; scene: ConteScene; partner: string; result?: { grade: ShowcaseGrade; label: string }; onEnd: (r: { grade: ShowcaseGrade; label: string }) => void }) {
  const [shown, setShown] = useState(0)
  const [ma, setMa] = useState(0)
  const start = useRef<number | null>(null)
  const zones = tsukkomiZones(state, { kind: 'tsukkomi', boke: '', tsukkomi: '', center: 0.5 }, kind)
  const duration = maDuration(kind)
  const shake = needleShake(state, kind)
  const typing = shown < scene.ochi.length

  useEffect(() => {
    if (!typing || result) return
    const t = setTimeout(() => setShown((v) => v + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [shown, typing, result])

  useEffect(() => {
    if (typing || result) return
    let raf = 0
    const tick = (now: number) => {
      if (start.current === null) start.current = now
      const t = (now - start.current) / duration
      setMa(Math.max(0, Math.min(1, t + Math.sin(t * 40) * shake)))
      if (t >= 1) onEnd(gradeBlackout(state, kind, null))
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [typing, result, state, kind, duration, shake, onEnd])

  const tap = () => {
    if (result) return
    onEnd(gradeBlackout(state, kind, typing ? 0 : ma))
  }

  return (
    <>
      <Stage state={state} kind={kind} mood={result ? result.grade : 'wait'} blackout={!!result}>
        <div className="sc-bubble">
          <span className="telop-tag">{speaker(partner, scene.conte)}</span>
          <span className="sc-line">「{scene.ochi.slice(0, shown)}」</span>
        </div>
      </Stage>
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
          <p className="sc-help">{typing ? 'オチのセリフを最後まで聞いて……' : '余韻の頂点で、暗転のきっかけを出す！'}</p>
          <button className="primary big sc-tap" onClick={tap}>
            暗転！
          </button>
        </>
      ) : (
        <BeatResult r={result} />
      )}
    </>
  )
}

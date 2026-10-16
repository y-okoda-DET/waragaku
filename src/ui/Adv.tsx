import { useEffect, useRef, useState, type ReactNode } from 'react'
import { weekLabel } from '../game/data/calendar'
import { CIRCLE_PARTNER, INITIAL_SENIORS, PARTNER_CANDIDATES } from '../game/data/people'
import type { GameState } from '../game/types'
import { backgrounds, charaKey, exprOf, portrait, type Expr } from './art'
import { shotsOf } from './scene'
import { LOG, pushLog } from './log'
import { parseLine } from './script'
import { HAIR, OUTFITS } from './looks'
import { Avatar, PlayerAvatar } from './parts'

// パワプロ式の会話画面。上に登場人物、下のメッセージ枠をタップすると1行ずつ進む
// 最後の行まで読むと、選択肢（または入力欄）が出る。選択肢がなければタップで終わる

// 1文字ずつ出す速さ。句読点では少し止まる。タップすると一気に全部出る
const TYPE_MS = 48
const PAUSE_MS: Record<string, number> = { '、': 140, '。': 260, '！': 220, '？': 220, '…': 120, '」': 120 }

function LogPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [])
  return (
    <div
      className="adv-log"
      role="dialog"
      aria-label="会話のログ"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="adv-log-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row-between">
          <h2>ログ</h2>
          <button className="link" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="adv-log-list" ref={ref}>
          {LOG.length === 0 && <p className="small">まだ何もありません。</p>}
          {LOG.map((l, i) => (
            <p key={i} className={l.choice ? 'log-choice' : ''}>
              {l.speaker && <b>{l.speaker}</b>}
              {l.choice ? `▶ ${l.text}` : l.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

// 名前から見た目を決める（固定の絵がまだないので仮）
function lookOf(name: string): { hair: string; outfit: string } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { hair: HAIR[h % HAIR.length], outfit: OUTFITS[(h >>> 3) % OUTFITS.length].color }
}

const KNOWN = [...PARTNER_CANDIDATES.map((p) => p.name), CIRCLE_PARTNER.name, ...INITIAL_SENIORS.map((s) => s.name), '辻堂', '三宅', '店長', '支配人', '御堂', '真壁', '社員']

function namesOf(state: GameState): string[] {
  const names = new Set<string>([state.player.callName, ...KNOWN])
  if (state.partner) names.add(state.partner.name)
  for (const s of state.seniors) names.add(s.name)
  return [...names]
}
function Chara({ state, name, expr, focus, me }: { state: GameState; name: string; expr: Expr; focus: boolean; me?: boolean }) {
  const src = portrait(charaKey(state, name), expr)
  return (
    <figure className={`adv-chara ${me ? 'is-me' : ''} ${focus ? 'focus' : ''} ${src ? 'art' : ''}`}>
      {src ? <img src={src} alt="" draggable={false} /> : me ? <PlayerAvatar player={state.player} size={118} /> : <Avatar {...lookOf(name)} size={118} />}
      <figcaption>{name}</figcaption>
    </figure>
  )
}

export function AdvScreen({ state, title, lines: script, place, onEnd, after, dayLines }: { state: GameState; title: string; lines: string[]; place?: string; onEnd?: () => void; after?: ReactNode; dayLines?: number }) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const parsed = script.map(parseLine)
  const lines = parsed.map((l) => l.text)
  const cur = parsed[index]
  const line = lines[index] ?? ''
  const typing = shown < line.length
  const last = index >= lines.length - 1
  // 台本形式で書かれたイベントは名前をはっきり書くので、「相方」を相方の名前に読み替えない（「私の元相方」などがあるため）
  const scripted = script.some((l) => l.startsWith('ナレーション：')) || parsed.some((l) => l.speaker)
  const shot = shotsOf(parsed.map((l) => l.stage), namesOf(state), state.partner && !scripted ? { 相方: state.partner.name } : {})[index] ?? { cast: [] }
  const p = state.player

  const [log, setLog] = useState(false)

  useEffect(() => {
    if (!typing || log) return
    const t = setTimeout(() => setShown((v) => v + 1), shown === 0 ? 160 : TYPE_MS + (PAUSE_MS[line[shown - 1]] ?? 0))
    return () => clearTimeout(t)
  }, [shown, typing, line, log])

  // 表示した行をログに残す
  useEffect(() => {
    if (line) pushLog({ speaker: cur?.speaker, text: line })
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    if (typing) return setShown(line.length)
    if (!last) {
      setIndex(index + 1)
      setShown(0)
    } else if (!after && onEnd) onEnd()
  }

  const done = last && !typing
  const talking = line.trimStart().startsWith('「')
  const focus = shot.speaker ?? (shot.cast.length === 1 ? shot.cast[0] : undefined)
  const exprFor = (n: string): Expr => (n !== focus ? 'normal' : n === cur?.speaker && cur.expr ? cur.expr : exprOf(line))
  const bg = backgrounds(title, lines, place, dayLines)[index]

  return (
    // 画面のどこをタップしても進む（選択肢とログは除く）
    <div className={`screen adv ${done && after ? 'has-after' : ''}`} onClick={advance}>
      <div className={`adv-scene ${bg ? 'has-bg' : ''}`} style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        {!bg && (
          <>
            <span className="blob" style={{ right: -70, top: -60, width: 230, height: 230, background: 'var(--sun)' }} />
            <span className="blob" style={{ left: -50, bottom: -40, width: 160, height: 160, background: 'var(--coral-light)' }} />
          </>
        )}
        <div className="adv-top">
          <span className="studio-title">{title}</span>
          <span className="adv-top-right">
            <button
              className="adv-log-btn"
              onClick={(e) => {
                e.stopPropagation()
                setLog(true)
              }}
            >
              ログ
            </button>
            <span className="adv-date">{weekLabel(Math.min(state.turn, 41))}</span>
          </span>
        </div>
        <div className={`adv-cast ${focus && shot.cast.length > 1 ? 'has-focus' : ''}`}>
          {shot.cast.map((n) => (
            <Chara key={n} state={state} name={n} expr={exprFor(n)} focus={focus === n} me={n === p.callName} />
          ))}
        </div>
      </div>
      <button className={`adv-box ${talking ? 'talk' : ''}`} aria-label="次へ進む">
        {cur?.speaker && <span className="adv-name">{cur.speaker}</span>}
        <span className="adv-text">
          {line.slice(0, shown)}
          {/* まだ出ていない文字も透明で置いておく（1文字ずつ出るときに改行位置が動かないように） */}
          <span className="adv-rest" aria-hidden="true">
            {line.slice(shown)}
          </span>
        </span>
        {!typing && !(last && after) && <span className="adv-next" aria-hidden="true">▼</span>}
      </button>
      {done && after && (
        <div className="adv-after" onClick={(e) => e.stopPropagation()}>
          {after}
        </div>
      )}
      {log && <LogPanel onClose={() => setLog(false)} />}
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { weekLabel } from '../game/data/calendar'
import { CIRCLE_PARTNER, INITIAL_SENIORS, PARTNER_CANDIDATES } from '../game/data/people'
import type { GameState } from '../game/types'
import { backgrounds, charaKey, exprOf, portrait, type Expr } from './art'
import { shotsOf } from './scene'
import { HAIR, OUTFITS } from './looks'
import { Avatar, PlayerAvatar } from './parts'

// パワプロ式の会話画面。上に登場人物、下のメッセージ枠をタップすると1行ずつ進む
// 最後の行まで読むと、選択肢（または入力欄）が出る。選択肢がなければタップで終わる

const TYPE_MS = 28

// 名前から見た目を決める（固定の絵がまだないので仮）
function lookOf(name: string): { hair: string; outfit: string } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { hair: HAIR[h % HAIR.length], outfit: OUTFITS[(h >>> 3) % OUTFITS.length].color }
}

const KNOWN = [...PARTNER_CANDIDATES.map((p) => p.name), CIRCLE_PARTNER.name, ...INITIAL_SENIORS.map((s) => s.name), '講師', '辻堂', '三宅', '店長', '支配人']

function namesOf(state: GameState): string[] {
  const names = new Set<string>([state.player.callName, ...KNOWN])
  if (state.partner) names.add(state.partner.name)
  for (const s of state.seniors) names.add(s.name)
  return [...names]
}
function Chara({ state, name, expr, focus, me }: { state: GameState; name: string; expr: Expr; focus: boolean; me?: boolean }) {
  const src = portrait(charaKey(state, name), expr)
  return (
    <figure className={`adv-chara ${me ? 'me' : ''} ${focus ? 'focus' : ''} ${src ? 'art' : ''}`}>
      {src ? <img src={src} alt="" draggable={false} /> : me ? <PlayerAvatar player={state.player} size={118} /> : <Avatar {...lookOf(name)} size={118} />}
      <figcaption>{name}</figcaption>
    </figure>
  )
}

export function AdvScreen({ state, title, lines, onEnd, after }: { state: GameState; title: string; lines: string[]; onEnd?: () => void; after?: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const line = lines[index] ?? ''
  const typing = shown < line.length
  const last = index >= lines.length - 1
  const shot = shotsOf(lines, namesOf(state), state.partner ? { 相方: state.partner.name } : {})[index] ?? { cast: [] }
  const p = state.player

  useEffect(() => {
    if (!typing) return
    const t = setTimeout(() => setShown((v) => v + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [shown, typing])

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
  const exprFor = (n: string): Expr => (n === focus ? exprOf(line) : 'normal')
  const bg = backgrounds(title, lines)[index]

  return (
    <div className="screen adv">
      <div className={`adv-scene ${bg ? 'has-bg' : ''}`} onClick={advance} style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        {!bg && (
          <>
            <span className="blob" style={{ right: -70, top: -60, width: 230, height: 230, background: 'var(--sun)' }} />
            <span className="blob" style={{ left: -50, bottom: -40, width: 160, height: 160, background: 'var(--coral-light)' }} />
          </>
        )}
        <div className="adv-top">
          <span className="studio-title">{title}</span>
          <span className="adv-date">{weekLabel(Math.min(state.turn, 41))}</span>
        </div>
        <div className={`adv-cast ${focus && shot.cast.length > 1 ? 'has-focus' : ''}`}>
          {shot.cast.map((n) => (
            <Chara key={n} state={state} name={n} expr={exprFor(n)} focus={focus === n} me={n === p.callName} />
          ))}
        </div>
      </div>
      <button className={`adv-box ${talking ? 'talk' : ''}`} onClick={advance} aria-label="次へ進む">
        <span className="adv-text">{line.slice(0, shown)}</span>
        {!typing && !(last && after) && <span className="adv-next" aria-hidden="true">▼</span>}
        <span className="adv-count">
          {index + 1}/{lines.length}
        </span>
      </button>
      {done && after && <div className="adv-after">{after}</div>}
    </div>
  )
}

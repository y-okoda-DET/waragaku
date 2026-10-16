import { useEffect, useState, type ReactNode } from 'react'
import { weekLabel } from '../game/data/calendar'
import { CIRCLE_PARTNER, INITIAL_SENIORS, PARTNER_CANDIDATES } from '../game/data/people'
import type { GameState } from '../game/types'
import { HAIR, OUTFITS, outfitColor } from './looks'
import { Avatar } from './parts'

// パワプロ式の会話画面。上に登場人物、下のメッセージ枠をタップすると1行ずつ進む
// 最後の行まで読むと、選択肢（または入力欄）が出る。選択肢がなければタップで終わる

const TYPE_MS = 28

// 名前から見た目を決める（固定の絵がまだないので仮）
function lookOf(name: string): { hair: string; outfit: string } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { hair: HAIR[h % HAIR.length], outfit: OUTFITS[(h >>> 3) % OUTFITS.length].color }
}

const KNOWN = [...PARTNER_CANDIDATES.map((p) => p.name), CIRCLE_PARTNER.name, ...INITIAL_SENIORS.map((s) => s.name), '講師']

// 本文に出てくる人物を、出てきた順に最大2人まで並べる
function castOf(state: GameState, text: string): string[] {
  const names = new Set<string>(KNOWN)
  if (state.partner) names.add(state.partner.name)
  for (const s of state.seniors) names.add(s.name)
  const found = [...names].filter((n) => text.includes(n)).sort((a, b) => text.indexOf(a) - text.indexOf(b))
  if (!found.length && state.partner) found.push(state.partner.name)
  return found.slice(0, 2)
}

export function AdvScreen({ state, title, lines, onEnd, after }: { state: GameState; title: string; lines: string[]; onEnd?: () => void; after?: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const line = lines[index] ?? ''
  const typing = shown < line.length
  const last = index >= lines.length - 1
  const cast = castOf(state, title + lines.join(''))
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

  return (
    <div className="screen adv">
      <div className="adv-scene" onClick={advance}>
        <span className="blob" style={{ right: -70, top: -60, width: 230, height: 230, background: 'var(--sun)' }} />
        <span className="blob" style={{ left: -50, bottom: -40, width: 160, height: 160, background: 'var(--coral-light)' }} />
        <div className="adv-top">
          <span className="studio-title">{title}</span>
          <span className="adv-date">{weekLabel(Math.min(state.turn, 41))}</span>
        </div>
        <div className="adv-cast">
          <figure className="adv-chara me">
            <Avatar hair={p.hairColor} outfit={outfitColor(p.outfit)} size={118} />
            <figcaption>{p.callName}</figcaption>
          </figure>
          {cast.map((n) => (
            <figure key={n} className="adv-chara">
              <Avatar {...lookOf(n)} size={118} />
              <figcaption>{n}</figcaption>
            </figure>
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

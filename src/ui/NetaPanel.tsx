import { CARD_BY_ID } from '../game/data/cards'
import { setNetaCard } from '../game/engine'
import type { CardSlot, GameState } from '../game/types'
import { Bar } from './parts'

const SLOT_LABEL: Record<CardSlot, string> = { tsukami: 'ツカミ', tenkai: '展開', ochi: 'オチ' }
const SLOTS: CardSlot[] = ['tsukami', 'tenkai', 'ochi']

export function NetaPanel({ state, editable, onChange }: { state: GameState; editable: boolean; onChange: (s: GameState) => void }) {
  const style = state.player.style
  return (
    <div className="neta">
      {SLOTS.map((slot) => {
        const current = state.neta.cards[slot]
        const owned = state.cards.map((id) => CARD_BY_ID[id]).filter((c) => c && c.slot === slot)
        return (
          <div key={slot} className="neta-slot">
            <div className="neta-slot-head">
              <span className="slot-label">{SLOT_LABEL[slot]}</span>
              <span>{current ? CARD_BY_ID[current].name : '（未定）'}</span>
              {current && <span className="power">{CARD_BY_ID[current].power}</span>}
            </div>
            {editable && (
              <div className="chips">
                {owned
                  .sort((a, b) => b.power - a.power)
                  .map((c) => (
                    <button key={c.id} className={`chip ${c.id === current ? 'on' : ''}`} onClick={() => onChange(setNetaCard(state, slot, c.id))}>
                      {c.name}
                      <span className="power">{c.power}</span>
                      {c.style !== 'both' && c.style !== style && <span className="warn-mark">{c.style === 'conte' ? 'コント向き' : '漫才向き'}</span>}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )
      })}
      <Bar label="完成度" value={state.neta.polish} tone={state.neta.polish < 30 ? 'warn' : 'good'} />
      {editable && <p className="small">ネタを組み替えると完成度が少し下がる。数字はカードの強さ。</p>}
    </div>
  )
}

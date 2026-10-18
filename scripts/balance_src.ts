// どこで能力が伸びているかを数える（バランス調整用）
//   npx vite-node scripts/balance_src.ts
import { createGame, doStage, endEvents, resolveStory, runWeek, type DayAction } from '../src/game/engine'
import { STORIES } from '../src/game/events'
import { showcaseCount } from '../src/game/showcase'
import { STAT_KEYS, type GameState } from '../src/game/types'

const N = 30
const by: Record<string, Record<string, number>> = {}
const add = (src: string, a: GameState, b: GameState) => {
  by[src] ??= {}
  for (const k of STAT_KEYS) by[src][k] = (by[src][k] ?? 0) + (b.stats[k] - a.stats[k]) / N
}
for (let seed = 1; seed <= N; seed++) {
  let x = seed * 7 + 3
  const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  const drain = (s: GameState) => {
    for (let g = 0; s.pending.length && g < 60; g++) {
      const ev = s.pending[0]
      const before = s
      if (ev.type === 'stage') {
        s = doStage(s, Array.from({ length: showcaseCount(ev.kind) }, () => (r() < 0.3 ? 'great' : r() < 0.6 ? 'good' : 'miss')))
        add('舞台:' + ev.kind, before, s)
      } else {
        const v = STORIES[ev.key].view(s, ev.params ?? {})
        s = resolveStory(s, v.choices.length ? Math.floor(r() * v.choices.length) : 0, v.input ? 'テスト' : undefined)
        add('イベント', before, s)
      }
    }
    return s
  }
  let s = endEvents(drain(createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style: 'manzai', seed })))
  add('はじめ', { stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) } as unknown as GameState, s)
  const days: DayAction['type'][] = ['neta', 'awase', 'jishuren', 'baito', 'jishulive', 'kangeki', 'tetsudai']
  for (let w = 0; s.phase !== 'result' && w < 100; w++) {
    const d: DayAction = s.condition < 30 ? { type: 'rest' } : s.money < 15000 ? { type: 'baito' } : ({ type: days[Math.floor(r() * days.length)] } as DayAction)
    const before = s
    s = runWeek(s, d, s.condition < 45 ? { type: 'sleep' } : { type: 'netacho' })
    add('昼:' + d.type, before, s)
    s = drain(endEvents(drain(s)))
  }
}
for (const [src, v] of Object.entries(by).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)))
  console.log(src.padEnd(22), Math.round(Object.values(v).reduce((x, y) => x + y, 0)), STAT_KEYS.map((k) => `${k}${Math.round(v[k])}`).join(' '))

// 自動で1年を何十回も遊ばせて、総合評価の分かれ方を見る（バランス調整用）
//   npx vite-node scripts/balance.ts [回数]
// 遊び方は3通り。「ふつう」は、体調とお金を見ながら満遍なくやる人のつもり
import { createGame, doStage, endEvents, resolveStory, runWeek, type DayAction, type NightAction } from '../src/game/engine'
import { buildEpilogue } from '../src/game/epilogue'
import { STORIES } from '../src/game/events'
import { showcaseCount } from '../src/game/showcase'
import { TUNING } from '../src/game/core'
import { STAT_KEYS, type GameState } from '../src/game/types'

type Grade = 'great' | 'good' | 'miss'
type Policy = (s: GameState, week: number, r: () => number) => [DayAction, NightAction]

// 見せ場の手ごたえ。人が遊ぶとこのくらいに散ると見ておく
function grades(n: number, r: () => number, hit: number): Grade[] {
  return Array.from({ length: n }, () => {
    const x = r()
    return x < hit ? 'great' : x < hit + 0.45 ? 'good' : 'miss'
  })
}

function contact(s: GameState): string | null {
  const c = s.seniors.filter((x) => s.flags[`contact_${x.id}`])
  return c.length ? c[s.turn % c.length].id : null
}

const night = (s: GameState, r: () => number): NightAction => {
  if (s.condition < 45) return { type: 'sleep' }
  if (s.motivation < 40) return { type: 'jikka' }
  const x = r()
  const sr = contact(s)
  if (x < 0.25 && sr) return { type: 'nomi', senior: sr }
  if (x < 0.45 && s.money > 8000) return { type: 'douki' }
  if (x < 0.65) return { type: 'netacho' }
  if (x < 0.75) return { type: 'egosa' }
  return { type: 'sleep' }
}

const POLICIES: Record<string, Policy> = {
  // 体調が落ちたら休み、お金が減ったらバイト。あとは満遍なく
  ふつう: (s, _w, r) => {
    let d: DayAction
    if (s.condition < 30) d = { type: 'rest' }
    else if (s.money < 15000) d = { type: 'baito' }
    else {
      const x = r()
      d = x < 0.22 ? { type: 'neta' } : x < 0.44 ? { type: 'awase' } : x < 0.62 ? { type: 'jishuren' } : x < 0.72 ? { type: 'baito' } : x < 0.82 ? { type: 'jishulive' } : x < 0.9 ? { type: 'kangeki' } : { type: 'tetsudai' }
    }
    return [d, night(s, r)]
  },
  // 練習ばかり。お金と体調はぎりぎりまで見ない
  がんばり: (s, w, r) => {
    const d: DayAction = s.condition < 20 ? { type: 'rest' } : s.money < 8000 ? { type: 'baito' } : [{ type: 'neta' }, { type: 'awase' }, { type: 'jishuren' }, { type: 'jishulive' }][w % 4] as DayAction
    return [d, s.condition < 40 ? { type: 'sleep' } : night(s, r)]
  },
  // 体調を保ちながら、ネタと合わせを中心に、先輩とも飲む人
  うまい: (s, w, r) => {
    let d: DayAction
    if (s.condition < 40) d = { type: 'rest' }
    else if (s.money < 12000) d = { type: 'baito' }
    else d = [{ type: 'neta' }, { type: 'awase' }, { type: 'jishuren' }, { type: 'awase' }, { type: 'jishulive' }, { type: 'kangeki' }][w % 6] as DayAction
    const sr = contact(s)
    const n: NightAction = s.condition < 60 ? { type: 'sleep' } : sr && w % 2 ? { type: 'nomi', senior: sr } : s.motivation < 60 ? { type: 'jikka' } : { type: 'netacho' }
    void r
    return [d, n]
  },
  // なんとなく選ぶ人
  きまぐれ: (s, _w, r) => {
    const all: DayAction['type'][] = ['neta', 'awase', 'jishuren', 'baito', 'jishulive', 'kangeki', 'tetsudai', 'rest']
    const t = s.money < 3000 ? 'baito' : all[Math.floor(r() * all.length)]
    return [{ type: t } as DayAction, night(s, r)]
  },
}

function play(seed: number, policy: Policy, hit: number) {
  let x = seed * 9301 + 49297
  const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  const drain = (s: GameState) => {
    for (let g = 0; s.pending.length && g < 60; g++) {
      const ev = s.pending[0]
      if (ev.type === 'stage') s = doStage(s, grades(showcaseCount(ev.kind), r, hit))
      else {
        const v = STORIES[ev.key].view(s, ev.params ?? {})
        s = resolveStory(s, v.choices.length ? Math.floor(r() * v.choices.length) : 0, v.input ? 'テスト' : undefined)
      }
    }
    return s
  }
  let s = endEvents(drain(createGame({ name: '山田', callName: 'ヤマダ', role: seed % 2 ? 'boke' : 'tsukkomi', style: seed % 3 ? 'manzai' : 'conte', seed })))
  for (let w = 0; s.phase !== 'result' && w < 100; w++) {
    const [d, n] = policy(s, w, r)
    s = drain(endEvents(drain(runWeek(s, d, n))))
  }
  return s
}

const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * q)]
const N = Number(process.argv[2] ?? 40)
if (process.env.GROWTH) TUNING.growth = Number(process.env.GROWTH)
for (const [name, policy] of Object.entries(POLICIES)) {
  for (const hit of [0.3]) {
    const ranks: Record<string, number> = {}
    let total = 0
    const stat: Record<string, number> = {}
    let broke = 0
    let fail = 0
    const totals: number[] = []
    const grads: number[] = []
    for (let i = 1; i <= N; i++) {
      const s = play(i, policy, hit)
      const ep = buildEpilogue(s)
      ranks[ep.rank] = (ranks[ep.rank] ?? 0) + 1
      total += ep.total
      totals.push(ep.total)
      grads.push(s.gradRank ?? 99)
      for (const k of STAT_KEYS) stat[k] = (stat[k] ?? 0) + s.stats[k] / N
      if (s.money < 0) broke++
      if (s.flags.kyusai || (s.counters.rest ?? 0) >= 8) fail++
    }
    const order = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
    console.log(
      `${name}: 平均${Math.round(total / N)}点 ｜ ${order.map((k) => `${k}${ranks[k] ?? 0}`).join(' ')} ｜ ` +
        STAT_KEYS.map((k) => `${k}${Math.round(stat[k])}`).join(' ') +
        ` ｜ 借金${broke} 出席不足${fail}`,
      `\n   点の幅 ${pct(totals, 0.1)}〜${pct(totals, 0.5)}〜${pct(totals, 0.9)} ｜ 卒業大会の順位 ${pct(grads, 0.1)}〜${pct(grads, 0.5)}〜${pct(grads, 0.9)}位`,
    )
  }
}

// 点数の内訳（ふつう）
if (process.argv[3] === 'detail') {
  const parts = { stats: 0, skills: 0, grad: 0, fans: 0, staff: 0, nskills: 0 }
  for (let i = 1; i <= N; i++) {
    const s = play(i, POLICIES['ふつう'], 0.3)
    parts.stats += STAT_KEYS.reduce((a, k) => a + s.stats[k], 0) / N
    const ep = buildEpilogue(s)
    parts.grad += (s.gradRank === 1 ? 40 : s.gradRank && s.gradRank <= 8 ? 20 : s.gradRank && s.gradRank <= 20 ? 8 : 0) / N
    parts.fans += s.fans / 3 / N
    parts.staff += s.staffEval / 4 / N
    parts.nskills += s.skills.length / N
    parts.skills += (ep.total - 0) / N
  }
  parts.skills = parts.skills - parts.stats - parts.grad - parts.fans - parts.staff
  console.log(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 10) / 10])))
}

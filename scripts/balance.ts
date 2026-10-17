// 自動で1年を何十回も遊ばせて、総合評価の分かれ方を見る（バランス調整用）
//   npx vite-node scripts/balance.ts [回数]
// 遊び方は3通り。「ふつう」は、体調とお金を見ながら満遍なくやる人のつもり
import { createGame, doStage, endEvents, resolveStory, runWeek, type DayAction, type NightAction } from '../src/game/engine'
import { buildEpilogue } from '../src/game/epilogue'
import { STORIES } from '../src/game/events'
import { showcaseCount } from '../src/game/showcase'
import { TUNING, gainWatch } from '../src/game/core'
import { STAT_KEYS, STAT_LABEL, type GameState } from '../src/game/types'

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

// 行事の選択肢の選び方。うまい人は、いちばん低い能力が上がる選択肢を選ぶ
type Chooser = (s: GameState, labels: string[], r: () => number) => number
const anyChoice: Chooser = (_s, labels, r) => Math.floor(r() * labels.length)
const lowFirst: Chooser = (s, labels, r) => {
  const order = [...STAT_KEYS].sort((a, b) => s.stats[a] - s.stats[b]).map((k) => STAT_LABEL[k])
  for (const name of order) {
    const i = labels.findIndex((h) => h.includes(name))
    if (i >= 0) return i
  }
  return anyChoice(s, labels, r)
}

// 低い能力を伸ばす昼の行動
const TRAIN: Record<string, DayAction['type']> = { idea: 'neta', word: 'kangeki', expr: 'jishuren', guts: 'jishulive', adlib: 'jishulive', stamina: 'jishuren' }

const smartDay = (s: GameState): DayAction => {
  if (s.condition < 35 && (s.counters.rest ?? 0) < 6) return { type: 'rest' }
  if (s.money < 15000 || (s.turn >= 8 && s.turn < 20 && s.money < 42000)) return { type: 'baito' }
  if (s.neta.polish < 55) return { type: 'awase' }
  const low = [...STAT_KEYS].sort((a, b) => s.stats[a] - s.stats[b])[0]
  return { type: TRAIN[low] } as DayAction
}
const smartNight = (s: GameState, w: number): NightAction => {
  if (s.condition < 65) return { type: 'sleep' }
  if (s.motivation < 65) return { type: 'jikka' }
  const sr = contact(s)
  if (sr && w % 2) return { type: 'nomi', senior: sr }
  return { type: 'netacho' }
}

interface Player {
  plan: Policy
  choose: Chooser
  hit: number // 見せ場で「すごい」を出す割合
}

const POLICIES: Record<string, Player> = {
  // なんとなく選ぶ人
  きまぐれ: {
    plan: (s, _w, r) => {
      const all: DayAction['type'][] = ['neta', 'awase', 'jishuren', 'baito', 'jishulive', 'kangeki', 'tetsudai', 'rest']
      const t = s.money < 3000 ? 'baito' : all[Math.floor(r() * all.length)]
      const nights: NightAction[] = [{ type: 'sleep' }, { type: 'douki' }, { type: 'netacho' }, { type: 'egosa' }, { type: 'jikka' }]
      return [{ type: t } as DayAction, nights[Math.floor(r() * nights.length)]]
    },
    choose: anyChoice,
    hit: 0.2,
  },
  // 体調が落ちたら休み、お金が減ったらバイト。あとは満遍なく
  ふつう: {
    plan: (s, _w, r) => {
      let d: DayAction
      if (s.condition < 30) d = { type: 'rest' }
      else if (s.money < 15000) d = { type: 'baito' }
      else {
        const x = r()
        d = x < 0.22 ? { type: 'neta' } : x < 0.44 ? { type: 'awase' } : x < 0.62 ? { type: 'jishuren' } : x < 0.72 ? { type: 'baito' } : x < 0.82 ? { type: 'jishulive' } : x < 0.9 ? { type: 'kangeki' } : { type: 'tetsudai' }
      }
      return [d, night(s, r)]
    },
    choose: anyChoice,
    hit: 0.3,
  },
  // ふつうとうまいの間。半分くらいは考えて選ぶ
  まあまあ: {
    plan: (s, w, r) => (r() < 0.5 ? [smartDay(s), smartNight(s, w)] : POLICIES.ふつう.plan(s, w, r)),
    choose: (s, n, r) => (r() < 0.5 ? lowFirst(s, n, r) : anyChoice(s, n, r)),
    hit: 0.38,
  },
  // 体調とやる気を保ち、低い能力を狙って伸ばす。合宿費も早めに貯める
  うまい: { plan: (s, w) => [smartDay(s), smartNight(s, w)], choose: lowFirst, hit: 0.45 },
  // うまい人が、見せ場もよく決める
  すごくうまい: { plan: (s, w) => [smartDay(s), smartNight(s, w)], choose: lowFirst, hit: 0.65 },
}

function play(seed: number, p: Player) {
  const policy = p.plan
  const hit = p.hit
  let x = seed * 9301 + 49297
  const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
  const drain = (s: GameState) => {
    for (let g = 0; s.pending.length && g < 60; g++) {
      const ev = s.pending[0]
      if (ev.type === 'stage') s = doStage(s, grades(showcaseCount(ev.kind), r, hit))
      else {
        const v = STORIES[ev.key].view(s, ev.params ?? {})
        s = resolveStory(s, v.choices.length ? p.choose(s, v.choices.map((c) => `${c.label}${c.hint ?? ''}`), r) : 0, v.input ? 'テスト' : undefined)
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
for (const k of ['action', 'event', 'bond', 'stage'] as const) if (process.env[k.toUpperCase()]) TUNING[k] = Number(process.env[k.toUpperCase()])
for (const [name, player] of Object.entries(POLICIES)) {
  {
    const ranks: Record<string, number> = {}
    let total = 0
    const stat: Record<string, number> = {}
    let broke = 0
    let sk = 0
    let bk = 0
    const kw: Record<string, number> = {}
    let fail = 0
    const totals: number[] = []
    const grads: number[] = []
    const sc: Record<string, number[]> = {}
    const lv = [0, 0, 0, 0]
    const pass = [0, 0]
    for (let i = 1; i <= N; i++) {
      const s = play(i, player)
      const ep = buildEpilogue(s)
      ranks[ep.rank] = (ranks[ep.rank] ?? 0) + 1
      total += ep.total
      totals.push(ep.total)
      grads.push(s.gradRank ?? 99)
      for (const h of s.stageHistory) {
        ;(sc[h.kind] ??= []).push(h.score)
        lv[h.level]++
        if (h.passed !== undefined) (pass[h.passed ? 1 : 0] += 1)
      }
      for (const k of STAT_KEYS) stat[k] = (stat[k] ?? 0) + s.stats[k] / N
      sk += s.skills.length / N
      if (s.skills.includes('bakushou')) bk++
      for (const id of ['izumi', 'tatakiage', 'meikonbi', 'kumi']) if (s.skills.includes(id)) kw[id] = (kw[id] ?? 0) + 1
      if (s.money < 0) broke++
      if (s.flags.kyusai || (s.counters.rest ?? 0) >= 8) fail++
    }
    const order = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
    console.log(
      `${name}: 平均${Math.round(total / N)}点 ｜ ${order.map((k) => `${k}${ranks[k] ?? 0}`).join(' ')} ｜ ` +
        STAT_KEYS.map((k) => `${k}${Math.round(stat[k])}`).join(' ') +
        ` ｜ 特殊能力${sk.toFixed(1)}個 ｜ 爆笑請負人${bk} 秘蔵っ子${kw.kumi ?? 0} 泉${kw.izumi ?? 0} 叩き上げ${kw.tatakiage ?? 0} 名コンビ${kw.meikonbi ?? 0} /${N} ｜ 借金${broke} 出席不足${fail}`,
      `\n   点の幅 ${pct(totals, 0.1)}〜${pct(totals, 0.5)}〜${pct(totals, 0.9)} ｜ 卒業大会の順位 ${pct(grads, 0.1)}〜${pct(grads, 0.5)}〜${pct(grads, 0.9)}位`,
      `\n   舞台の出来 スベり${lv[0]} まばら${lv[1]} ウケ${lv[2]} 爆笑${lv[3]} ｜ 賞レース1回戦通過 ${pass[1]}/${pass[0] + pass[1]}`,
      `\n   舞台の点（真ん中） ` + Object.entries(sc).map(([k, v]) => `${k}${pct(v, 0.5)}`).join(' '),
    )
  }
}

// 点数の内訳（ふつう）
if (process.argv[3] === 'detail') {
  const parts = { stats: 0, skills: 0, grad: 0, fans: 0, staff: 0, nskills: 0 }
  for (let i = 1; i <= N; i++) {
    const s = play(i, POLICIES['ふつう'])
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

// 能力がどこで伸びたか（ふつう・うまい）。npx vite-node scripts/balance.ts 40 sources
if (process.argv[3] === 'sources') {
  for (const name of ['ふつう', 'うまい'] as const) {
    const by: Record<string, Record<string, number>> = {}
    gainWatch.on = (key, amount) => {
      const frame = (new Error().stack ?? '').split('\n').slice(2).find((l) => !l.includes('core.ts')) ?? ''
      const m = frame.match(/src\/game\/(\w+)\.ts/)
      const fn = frame.match(/at (\w+)/)?.[1] ?? '?'
      const src = m ? `${m[1]}${m[1] === 'engine' ? '.' + fn : ''}` : 'other'
      ;((by[src] ??= {})[key] = (by[src][key] ?? 0) + amount / N)
    }
    for (let i = 1; i <= N; i++) play(i, POLICIES[name])
    gainWatch.on = undefined
    console.log(`\n${name}：伸びた量の出どころ（1周あたり）`)
    for (const [src, v] of Object.entries(by).sort()) console.log(`  ${src.padEnd(22)} ` + STAT_KEYS.map((k) => `${k}${(v[k] ?? 0).toFixed(1).padStart(6)}`).join(' '))
  }
}


// 遊び方ごとの点の分位（区切りを決める用）
if (process.argv[3] === 'q') {
  for (const [name, player] of Object.entries(POLICIES)) {
    const t: number[] = []
    for (let i = 1; i <= N; i++) t.push(buildEpilogue(play(i, player)).total)
    console.log(name, [0.1, 0.25, 0.5, 0.75, 0.9].map((q) => pct(t, q)).join(' / '))
  }
}

// 極みの条件に使う数の分布（取りやすさを決める用）
if (process.argv[3] === 'kiwami') {
  const BIG = ['tozai', 'grad_prelim', 'grad_final']
  for (const [name, player] of Object.entries(POLICIES)) {
    const rows: Record<string, number[]> = {}
    const put = (k: string, v: number) => (rows[k] ??= []).push(v)
    for (let i = 1; i <= N; i++) {
      const s = play(i, player)
      const c = (k: string) => s.counters[k] ?? 0
      put('大舞台の爆笑', s.stageHistory.filter((h) => BIG.includes(h.kind) && h.level === 3).length)
      put('爆笑', c('level3'))
      put('ネタ作り', c('neta'))
      put('ネタ合わせ', c('awase'))
      put('スベり', c('suberi'))
      put('梅組', c('ume'))
      put('松組', s.classRank === 'matsu' ? 1 : 0)
      put('相方', s.partner?.bond ?? 0)
      put('MVP', c('mvp'))
      put('1回戦通過', c('contestPass'))
      const has = (id: string) => s.skills.includes(id)
      put('叩き上げ(梅1)', has('suberikaeshi') && c('ume') >= 1 && s.classRank === 'matsu' && c('bigLevel3') >= 1 ? 1 : 0)
      put('叩き上げ(梅2)', has('suberikaeshi') && c('ume') >= 2 && s.classRank === 'matsu' && c('bigLevel3') >= 1 ? 1 : 0)
      put('名コンビ(合わせ抜き)', has('aikata') && (s.partner?.bond ?? 0) >= 100 && c('mvp') >= 1 ? 1 : 0)
      put('泉(鬼抜き)', has('ryousan') && c('neta') >= 15 ? 1 : 0)
      for (const id of ['ryousan', 'netacho_oni', 'suberikaeshi', 'aikata', 'honban', 'tsukami', 'kumi', 'bakushou']) put(id, s.skills.includes(id) ? 1 : 0)
    }
    console.log(`\n${name}`)
    for (const [k, v] of Object.entries(rows)) console.log(`  ${k.padEnd(12)} 平均${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)} ｜ ${pct(v, 0.1)}〜${pct(v, 0.5)}〜${pct(v, 0.9)}`)
  }
}

// 卒業した状態を1つ書き出す（画面の確認用）。npx vite-node scripts/balance.ts 種 dump 出力先
if (process.argv[3] === 'dump') {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(process.argv[4], JSON.stringify(play(N, POLICIES['すごくうまい'])))
}

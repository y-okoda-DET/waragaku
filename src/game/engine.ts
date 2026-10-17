import { BACKGROUND_BY_ID, PLAYER_LOOK } from './data/backgrounds'
import { CARDS, STARTER_CARDS } from './data/cards'
import { TOTAL_TURNS, expectedClassmates, turnOf, weekInfo } from './data/calendar'
import { CIRCLE_PARTNER, INITIAL_SENIORS, PARTNER_CANDIDATES } from './data/people'
import { DEV_STORIES, classmatesOf, scheduleBondEvent, seniorDrama, tie } from './bonds'
import { applyKodawari } from './kodawari'
import { TUNING, addSkill, clamp, count, gain, has, push, removeSkill, story, withGainScale, yen } from './core'
import { STORIES } from './events'
import { flavor } from './data/flavor'
import { LUCKY, LUCKY_CHANCE } from './data/lucky'
import { RIVAL_SCHEDULE, rivalOf } from './rivalEvents'
import { Rng } from './rng'
import { STAGES, performStage } from './stage'
import type { ShowcaseGrade } from './showcase'
import { STAT_LABEL, type CardSlot, type Gender, type GameState, type Origin, type Role, type StageResult, type StatKey, type Stats, type Style } from './types'

export interface NewGameInput {
  name: string
  callName: string
  gender?: Gender
  role: Role
  style: Style
  seed?: number
  // ここから下は固定（高校卒業・東京の実家住まい・性別ごとの見た目）。テストと練習モードだけが変える
  background?: string
  origin?: Origin
  hairColor?: string
  outfit?: string
}

export type DayAction =
  | { type: 'neta' }
  // 場所と練習の中身は選ばない（その週ごとにランダム）。テストでは固定できる
  | { type: 'awase'; place?: 'park' | 'karaoke' | 'family' }
  | { type: 'jishuren'; kind?: JishurenKind }
  | { type: 'baito'; kind?: 'izakaya' }
  | { type: 'jishulive' }
  | { type: 'kangeki' }
  | { type: 'tetsudai' }
  | { type: 'rest' }

export type JishurenKind = 'radio' | 'hassei' | 'kintore' | 'dance'

export type NightAction = { type: 'nomi'; senior: string } | { type: 'douki' } | { type: 'netacho' } | { type: 'egosa' } | { type: 'jikka' } | { type: 'sleep' }

const clone = (s: GameState): GameState => structuredClone(s)

function withRng(s: GameState, fn: (rng: Rng) => void): void {
  const rng = new Rng(s.rng)
  fn(rng)
  s.rng = rng.seed
}

export function createGame(raw: NewGameInput): GameState {
  const gender = raw.gender ?? 'male'
  const look = PLAYER_LOOK[gender]
  const input = { ...raw, gender, background: raw.background ?? 'fresh', origin: raw.origin ?? 'local', hairColor: raw.hairColor ?? look.hairColor, outfit: raw.outfit ?? look.outfit }
  const bg = BACKGROUND_BY_ID[input.background]
  const base: Stats = { idea: 15, word: 15, expr: 15, guts: 15, adlib: 15, stamina: 15, ...bg.stats }
  const s: GameState = {
    version: 3,
    rng: (input.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0,
    player: { name: input.name, callName: input.callName, gender, background: input.background, origin: input.origin, role: input.role, style: input.style, hairColor: input.hairColor, outfit: input.outfit },
    stats: base,
    condition: 80,
    motivation: 60,
    money: bg.money,
    skills: [...bg.skills],
    partner: null,
    comboName: '',
    seniors: INITIAL_SENIORS.map((x) => ({ ...x })),
    dokiBond: 20,
    staffEval: 10,
    outsideRep: input.background === 'chika' ? 25 : input.background === 'circle' ? 20 : 5,
    fans: 0,
    safePlay: 0,
    edge: 0,
    risk: 0,
    cards: [...STARTER_CARDS, ...(bg.cards ?? [])],
    neta: { cards: { tsukami: 't_jikoshoukai', tenkai: input.style === 'conte' ? 'k_konbini' : 'k_aruaru', ochi: input.style === 'conte' ? 'o_hanten' : 'o_mouee' }, polish: 15 },
    teacherEval: 20,
    classRank: 'none',
    classmates: 300,
    turn: 0,
    queueChoice: null,
    counters: {},
    flags: {},
    pending: [],
    weekLog: [],
    lastStage: null,
    stageHistory: [],
    contestResults: [],
    gradRank: null,
    phase: 'event',
  }
  // 4人に1人くらい、高校のお笑い大会で賞をとってから入ってくる（乱数の流れを変えないよう、種から別に決める）
  if (new Rng((s.rng ^ 0x9e3779b9) >>> 0).chance(0.25)) {
    s.skills.push('koukou_sho')
    s.stats.guts += 6
    s.stats.idea += 4
    for (const sr of s.seniors) sr.respect = clamp(sr.respect + 5)
  }
  s.flags.intro = true
  s.flags.met_haibara = true // 入学式で会う
  story(s, 'nyugaku')
  if (bg.startsWithPartner) {
    s.partner = { ...CIRCLE_PARTNER, stats: { ...CIRCLE_PARTNER.stats }, skills: [...CIRCLE_PARTNER.skills], bond: 60, role: input.role === 'boke' ? 'tsukkomi' : 'boke' }
    s.comboName = 'ヤマアラシの午後'
    story(s, 'jissai')
  }
  return s
}

// ---- 1週間の行動 ----

// 自主練の中身。プレイヤーが選ぶ。選ばなかったとき（テストなど）は、ワード力・表現力・体力・対応力のうちいちばん低いものを練習する
const JISHUREN_STAT = { radio: 'word', hassei: 'expr', kintore: 'stamina', dance: 'adlib' } as const
export function jishurenKind(s: GameState): keyof typeof JISHUREN_STAT {
  return (Object.keys(JISHUREN_STAT) as (keyof typeof JISHUREN_STAT)[]).reduce((x, y) => (s.stats[JISHUREN_STAT[y]] < s.stats[JISHUREN_STAT[x]] ? y : x))
}
export function jishurenStat(s: GameState): StatKey {
  return JISHUREN_STAT[jishurenKind(s)]
}

function applyDay(s: GameState, a: DayAction, rng: Rng): void {
  const log = s.weekLog
  switch (a.type) {
    case 'neta': {
      gain(s, 'idea', has(s, 'ryousan') ? 3.5 : 2.5)
      s.condition = clamp(s.condition - 8)
      count(s, 'neta')
      log.push(flavor('netazukuri', rng))
      if (rng.chance(has(s, 'netacho_oni') ? 0.7 : 0.4)) {
        const fresh = CARDS.filter((c) => !s.cards.includes(c.id))
        if (fresh.length) {
          // 発想力が高いほど強いカードを引きやすい
          const sorted = [...fresh].sort((x, y) => x.power - y.power)
          const idx = Math.min(sorted.length - 1, Math.floor(rng.next() * sorted.length * (0.4 + s.stats.idea / 120)))
          s.cards.push(sorted[idx].id)
          log.push(flavor('neta_card', rng, { card: sorted[idx].name }))
        }
      }
      break
    }
    case 'awase': {
      if (!s.partner) {
        log.push(flavor('awase_solo', rng))
        s.neta.polish = clamp(s.neta.polish + 5)
        break
      }
      s.neta.polish = clamp(s.neta.polish + (has(s, 'awasema') ? 15 : 10))
      s.partner.bond = clamp(s.partner.bond + 4)
      s.condition = clamp(s.condition - (has(s, 'awasema') ? 3 : 6))
      count(s, 'awase')
      // 場所はその週の都合で決まる。お金はかからない（割り勘の小銭は生活費のうち）
      const place = a.place ?? rng.pick(['park', 'park', 'family', 'karaoke'] as const)
      if (place === 'park') {
        log.push(flavor('awase_park', rng))
        if (rng.chance(0.3)) story(s, 'park')
        else if (weekInfo(s.turn).month >= 6 && weekInfo(s.turn).month <= 9 && rng.chance(0.5)) log.push(flavor('awase_park_summer', rng))
      } else if (place === 'karaoke') log.push(flavor('awase_karaoke', rng))
      else log.push(flavor('awase_family', rng))
      if (rng.chance(0.08)) story(s, 'late_partner')
      break
    }
    case 'jishuren': {
      s.condition = clamp(s.condition - 10)
      // 深夜ラジオ投稿＝ワード力、発声・滑舌＝表現力、筋トレ＝体力、ダンス＝対応力（どれも同じだけ伸びる）
      const kind = a.kind ?? jishurenKind(s)
      if (kind === 'radio') {
        gain(s, 'word', 3.5)
        log.push(flavor('jishuren_radio', rng))
        log.push('言葉を削る力、ワード力が少し鍛えられた気がする。')
      } else if (kind === 'hassei') {
        gain(s, 'expr', 3.5)
        count(s, 'hassei')
        tie(s, 'miyake', 3)
        tie(s, 'kishibe', 2)
        log.push(flavor('jishuren_hassei', rng))
        log.push('声が前に出るようになって、表現力が上がった気がする。')
      } else if (kind === 'kintore') {
        gain(s, 'stamina', 3.5)
        log.push(flavor('jishuren_kintore', rng))
        log.push('体が軽い。体力が付いてきた気がする。')
      } else {
        gain(s, 'adlib', 3.5)
        log.push(flavor('jishuren_dance', rng))
        log.push('体が勝手に動くようになって、対応力が上がった気がする。')
      }
      break
    }
    case 'baito': {
      // バイトは居酒屋だけ。まかないで食費が浮く
      const bonus = has(s, 'kugaku') ? 1.25 : 1
      s.money += Math.round(18000 * bonus)
      count(s, 'baito')
      s.condition = clamp(s.condition - (has(s, 'makanai') ? 4 : 10))
      s.money += has(s, 'makanai') ? 5000 : 2500
      tie(s, 'tencho', 6)
      if (s.flags.met_nakaji) tie(s, 'nakaji', 3)
      log.push(flavor('baito_izakaya', rng))
      // バイト先で先輩芸人のナカジに出会い、何度か一緒に入ると連絡先を交換する
      if (!s.flags.met_nakaji) story(s, 'senpai_nakaji_deai')
      else if (!s.flags.contact_nakaji && (s.counters.baito ?? 0) >= 3) story(s, 'senpai_nakaji_renraku')
      break
    }
    case 'jishulive': {
      s.money -= 2000
      s.condition = clamp(s.condition - 6)
      gain(s, 'guts', 2)
      gain(s, 'adlib', 1.5)
      s.outsideRep = clamp(s.outsideRep + (has(s, 'chika') ? 6 : 3))
      count(s, 'jishulive')
      tie(s, 'nakaji', 3)
      tie(s, 'shihainin', 2)
      const audience = rng.int(3, 18)
      const good = s.stats.adlib + s.stats.guts + s.neta.polish / 2 + rng.int(-20, 20) > 75
      if (good) {
        s.fans += rng.int(1, 3) * (has(s, 'chika') ? 2 : 1)
        log.push(flavor('jishulive_good', rng, { audience: String(audience) }))
      } else log.push(flavor('jishulive_bad', rng, { audience: String(audience) }))
      if (rng.chance(0.1)) log.push(flavor('jishulive_fee', rng))
      break
    }
    case 'kangeki': {
      s.money -= 1500
      gain(s, 'word', 2.5)
      gain(s, 'idea', 1)
      s.motivation = clamp(s.motivation + 6)
      tie(s, 'shihainin', 6)
      log.push(flavor('kangeki', rng))
      break
    }
    case 'tetsudai': {
      // 先輩ライブの裏方。タダ。袖から見られて、知っている先輩には顔を覚えてもらえる
      s.condition = clamp(s.condition - 6)
      gain(s, 'guts', 1)
      gain(s, 'stamina', 1)
      // 認めは少しだけ。知っている先輩がいれば、袖での受け答えで上がったり下がったりする
      for (const sr of s.seniors) if (s.flags[`met_${sr.id}`]) sr.respect = clamp(sr.respect + 1)
      if (s.flags.met_nakaji) tie(s, 'nakaji', 2)
      tie(s, 'haibara', 2)
      count(s, 'tetsudai')
      log.push(flavor('tetsudai', rng))
      const known = s.seniors.filter((sr) => s.flags[`met_${sr.id}`] && sr.id !== 'haibara')
      if (known.length && rng.chance(0.7)) story(s, 'tetsudai_sode', { senior: rng.pick(known).id, v: count(s, 'tetsudai_sode') })
      break
    }
    case 'rest':
      count(s, 'rest')
      s.condition = clamp(s.condition + 30)
      s.motivation = clamp(s.motivation + 5)
      log.push(flavor('rest', rng))
      break
  }
}

function applyNight(s: GameState, a: NightAction, rng: Rng): void {
  const log = s.weekLog
  switch (a.type) {
    case 'nomi': {
      const senior = s.seniors.find((x) => x.id === a.senior)
      if (!senior || !s.flags[`contact_${senior.id}`]) break
      senior.like = clamp(senior.like + (has(s, 'kawaigarare') ? 11 : 7) + (has(s, 'hitorashi') ? 3 : 0))
      s.condition = clamp(s.condition - 10)
      s.money += 2500 // ごちそうになった分、食費が浮く
      s.safePlay += 1
      count(s, 'nomi')
      log.push(flavor('nomi', rng, { senior: senior.name }))
      // 飲みを重ねると、その先輩の話が進む（最後の話で特殊能力を受け継げることがある）
      seniorDrama(s, senior.id)
      if (senior.respect >= 40) {
        s.neta.polish = clamp(s.neta.polish + 5)
        log.push(flavor('nomi_neta', rng, { senior: senior.name }))
      } else if (senior.like >= 50) log.push(flavor('nomi_noneta', rng, { senior: senior.name }))
      if (has(s, 'orei')) {
        senior.like = clamp(senior.like + 3)
        count(s, 'orei')
      } else story(s, 'orei', { senior: senior.id, v: count(s, 'orei_ev') - 1 })
      break
    }
    case 'douki':
      s.money -= 3000
      s.dokiBond = clamp(s.dokiBond + 6)
      for (const id of classmatesOf(s)) tie(s, id, 4)
      s.motivation = clamp(s.motivation + 6)
      s.condition = clamp(s.condition - 5)
      log.push(flavor('douki', rng))
      break
    case 'netacho':
      s.neta.polish = clamp(s.neta.polish + 4)
      gain(s, 'word', 1)
      s.condition = clamp(s.condition - 3)
      log.push(flavor('netacho', rng))
      break
    case 'egosa': {
      if (s.fans < 3) {
        log.push(flavor('egosa_none', rng, { combo: s.comboName || s.player.callName }))
        break
      }
      const delta = rng.int(-8, 8)
      s.motivation = clamp(s.motivation + delta)
      log.push(flavor(delta >= 0 ? 'egosa_good' : 'egosa_bad', rng, { name: s.player.callName, combo: s.comboName || s.player.callName }))
      break
    }
    case 'jikka': {
      s.motivation = clamp(s.motivation + 8)
      // たまに仕送りが届く
      if (rng.chance(0.2)) {
        const amount = rng.pick([10000, 10000, 20000])
        s.money += amount
        log.push(flavor('jikka_shiokuri', rng, { amount: amount.toLocaleString() }))
      } else log.push(flavor('jikka', rng))
      break
    }
    case 'sleep':
      s.condition = clamp(s.condition + 15)
      log.push(flavor('sleep', rng))
      break
  }
}

function weeklyUpkeep(s: GameState): void {
  const rent = s.player.origin === 'tokyo' && !s.flags.isourou ? 10000 : 0
  const food = 5000
  const extra = has(s, 'rouhi') ? 3000 : 0
  s.money -= rent + food + extra
  s.condition = clamp(s.condition - 3 + s.stats.stamina / 40)
  // やる気は少しずつ50に戻る
  s.motivation = clamp(s.motivation + ((has(s, 'homerare') ? 62 : 50) - s.motivation) * 0.08)
}

// その週の行事
function scheduleEvents(s: GameState, rng: Rng): void {
  const { month, week } = weekInfo(s.turn)
  const t = s.turn

  if (t === turnOf(4, 4) && !s.partner) {
    const idx = [0, 1, 2, 3].sort(() => rng.next() - 0.5).slice(0, 3)
    story(s, 'aikata_kai', { c0: idx[0], c1: idx[1], c2: idx[2] })
  }
  // ネタ見せ授業は毎月第2週（5月〜1月）
  if (week === 2 && month !== 4 && month !== 2) {
    story(s, 'queue')
    push(s, { type: 'stage', kind: 'netamise' })
  }
  // ライバル（御堂・真壁）の場面。ライブの週は出番の前に起きる
  for (const r of RIVAL_SCHEDULE) if (r.month === month && r.week === week && (!r.style || r.style === s.player.style) && (!r.when || r.when(s))) story(s, r.key)
  if (week === 4 && [6, 9, 11, 1].includes(month)) push(s, { type: 'stage', kind: 'live' })
  // 1年間の流れ（scenario/1年間の流れ.md）で足した行事
  // 相方の場面（相方ごとに中身が違う）
  if (s.partner && month === 6 && week === 1) story(s, 'aikata_scene', { n: 0 })
  if (s.partner && month === 9 && week === 3) story(s, 'aikata_scene', { n: 1 })
  if (s.partner && month === 2 && week === 1) story(s, 'aikata_scene', { n: 2 })
  if (month === 5 && week === 1) story(s, 'taichou')
  if (month === 5 && week === 2) story(s, 'senpai_ookouchi_deai')
  if (month === 6 && week === 3 && s.flags.met_ookouchi && !s.flags.contact_ookouchi) story(s, 'senpai_ookouchi_renraku')
  // 休むが5回になったら（あと3回で出席不足）、講師から注意される
  if ((s.counters.rest ?? 0) >= 5 && !s.flags.shusseki_warned) story(s, 'shusseki_chui')
  if (month === 5 && week === 1) story(s, 'nazo_jugyo')
  if (month === 5 && week === 3) story(s, 'mendan')
  if (month === 6 && week === 3) story(s, 'ikitteta')
  if (month === 7 && week === 1) story(s, 'taisaku')
  if (month === 8 && week === 1) story(s, 'natsu_jugyo')
  if (month === 10 && week === 1) story(s, 'kiteinai')
  if (month === 10 && week === 3) story(s, 'tokushin')
  if (month === 10 && week === 4) story(s, 'gakuensai')
  if (month === 11 && week === 3) story(s, 'sankou')
  if (month === 11 && week === 4) story(s, 'finalist')
  if (month === 12 && week === 1 && s.kodawari) story(s, 'shiren')
  if (month === 12 && week === 4 && s.partner) story(s, 'jiko')
  if (month === 1 && week === 1) {
    story(s, 'gaisen')
    story(s, 'tozai_home')
  }
  if (month === 1 && week === 3) story(s, 'kougyou')
  if (month === 2 && week === 4) story(s, 'ketsudan')
  // 賞レースは、やりたいネタの大会だけに出る（コントならコント頂、漫才なら漫才天下一）
  if (month === 7 && week === 3 && s.player.style === 'conte') story(s, 'contest_entry', { kind: 'contest_conte' })
  if (month === 8 && week === 3 && s.player.style === 'manzai') story(s, 'contest_entry', { kind: 'contest_manzai' })
  if (month === 9 && week === 1) s.weekLog.push(`もうすぐ9月2週の強化合宿。参加費4万円は、出発の朝に現金で払う。財布の中は${yen(s.money)}。`)
  if (month === 9 && week === 2) story(s, 'gasshuku')
  if (month === 12 && week === 1 && s.player.background === 'circle' && !s.flags.naitei_done) {
    s.flags.naitei_done = true
    story(s, 'naitei')
  }
  if (month === 12 && week === 3) story(s, 'tozai_select')
  if (month === 1 && week === 2) story(s, 'audition')
  if (month === 2 && week === 2) story(s, 'grad_intro')

  // 発展イベントかランダムイベント（週に1つまで）。発展イベントが起きられるなら、そちらを優先しやすい
  const bonded = s.pending.length === 0 && rng.chance(0.7) && scheduleBondEvent(s, rng)
  if (!bonded && s.pending.length === 0 && rng.chance(0.25)) {
    const pool: [string, Record<string, string | number>?][] = []
    if (s.partner) pool.push(['shinneta'], ['loan'])
    // 相方と仲がいいときほど、ささいな喧嘩が起きやすい
    if (s.partner && s.partner.bond >= 50) pool.push(['kenka', { v: rng.int(0, 2) }], ['kenka', { v: rng.int(0, 2) }])
    pool.push(['line_kidoku'], ['barashi'])
    if (s.player.origin === 'tokyo') pool.push(['coin_shower'])
    const friend = s.seniors.find((x) => x.like >= 40)
    if (friend) pool.push(['hikkoshi', { senior: friend.id }])
    if (s.outsideRep >= 30 && !s.flags.chokueigyou_seen && month >= 10) pool.push(['chokueigyou'], ['chokueigyou'])
    const [key, params] = rng.pick(pool)
    story(s, key, params)
  }
  if (s.partner && s.partner.bond < 12 && !s.flags.kaisan_warned) {
    s.flags.kaisan_warned = true
    story(s, 'kaisan')
  }
  if (s.money < 0) story(s, 'debt')
}

// 予定の画面には書いていない、たまに起きる能力アップ
function lucky(s: GameState, key: string, rng: Rng): void {
  const list = LUCKY[key]
  if (!list || !rng.chance(LUCKY_CHANCE)) return
  const l = rng.pick(list)
  gain(s, l.stat, l.amount)
  s.weekLog.push(l.line)
  s.weekLog.push(`${STAT_LABEL[l.stat]}が${l.amount >= 3 ? 'ぐっと' : '少し'}上がった気がする。`)
}

export function runWeek(prev: GameState, day: DayAction, night: NightAction): GameState {
  const s = clone(prev)
  s.weekLog = []
  s.queueChoice = null
  withRng(s, (rng) => {
    withGainScale(TUNING.action, () => {
      applyDay(s, day, rng)
      lucky(s, day.type, rng)
      s.dayLines = s.weekLog.length
      applyNight(s, night, rng)
      lucky(s, night.type, rng)
    })
    weeklyUpkeep(s)
    scheduleEvents(s, rng)
  })
  s.phase = 'event'
  return s
}

// ---- イベント処理 ----

export function resolveStory(prev: GameState, choice: number, text?: string): GameState {
  const s = clone(prev)
  const ev = s.pending.shift()
  if (!ev || ev.type !== 'story') return prev
  s.weekLog = []
  applyKodawari(s, ev.key, choice)
  const k = ev.key in DEV_STORIES ? TUNING.bond : TUNING.event
  withRng(s, (rng) => withGainScale(k, () => STORIES[ev.key].resolve?.(s, choice, rng, ev.params ?? {}, text)))
  return s
}

export function doStage(prev: GameState, showcase: ('great' | 'good' | 'miss')[] = []): GameState {
  const s = clone(prev)
  const ev = s.pending.shift()
  if (!ev || ev.type !== 'stage') return prev
  s.weekLog = []
  withRng(s, (rng) => {
    const r = performStage(s, ev.kind, rng, showcase)
    withGainScale(TUNING.stage, () => applyStageEffects(s, r, rng))
    s.lastStage = r
    s.stageHistory.push(r)
  })
  return s
}

// 見せ場の手ごたえ。うまくいった分だけ担当の能力が伸び、スベった分は度胸だけが残る
const SHOWCASE_GAIN: Record<Role, Record<ShowcaseGrade, [StatKey, number][]>> = {
  boke: { great: [['idea', 2], ['word', 1]], good: [['idea', 1]], miss: [['guts', 0.5]] },
  tsukkomi: { great: [['expr', 2], ['word', 1]], good: [['expr', 1]], miss: [['guts', 0.5]] },
}

function applyShowcaseGains(s: GameState, r: StageResult): void {
  const grades = r.showcase ?? []
  if (!grades.length) return
  const total: Partial<Record<StatKey, number>> = {}
  for (const g of grades) for (const [k, v] of SHOWCASE_GAIN[s.player.role][g]) total[k] = (total[k] ?? 0) + v
  const parts: string[] = []
  for (const [k, v] of Object.entries(total) as [StatKey, number][]) {
    const d = gain(s, k, v)
    if (d > 0) parts.push(`${STAT_LABEL[k]}+${Math.round(d * 10) / 10}`)
  }
  const greats = grades.filter((g) => g === 'great').length
  if (greats && s.partner) {
    s.partner.bond = clamp(s.partner.bond + greats * 2)
    parts.push(`相方との息+${greats * 2}`)
  }
  if (parts.length) r.lines.push(`見せ場の手ごたえ：${parts.join('、')}`)
}

function applyStageEffects(s: GameState, r: GameState['lastStage'] & {}, rng: Rng): void {
  const spec = STAGES[r.kind]
  count(s, `level${r.level}`)
  if (r.level === 0) count(s, 'suberi')
  if (spec.audience === 'general' && r.level >= 2) count(s, 'generalUke')
  if (r.level >= 2 && s.neta.cards.tsukami) count(s, 'tsukamiUke')

  // やる気
  if (r.level === 0) s.motivation = clamp(s.motivation - (has(s, 'hagane') || has(s, 'homerare') ? 3 : 8))
  if (r.level >= 2) s.motivation = clamp(s.motivation + 5)
  // 舞台に立つたびに、度胸と対応力が少し付く
  gain(s, 'guts', 0.1 + r.level * 0.1)
  gain(s, 'adlib', 0.2 + r.level * 0.1)
  applyShowcaseGains(s, r)

  // 見ていた人の評価（認められ度は、ウケたときだけ上がる）
  if (r.level >= 2) for (const sr of s.seniors) sr.respect = clamp(sr.respect + Math.round((r.level === 3 ? 5 : 3) * (has(s, 'mitomesase') ? 1.6 : 1)))

  switch (r.kind) {
    case 'netamise': {
      let d = r.level * 4 - 2
      if (has(s, 'shiagari')) d = Math.round(d / 2)
      if (has(s, 'yomi') && d > 0) d += 2
      s.teacherEval = clamp(s.teacherEval + d)
      // 授業で顔を合わせる人たち
      tie(s, 'tsujido', r.level >= 2 ? 3 : 1)
      tie(s, 'miyake', 3)
      tie(s, 'haibara', s.queueChoice === 'early2' ? 5 : 2)
      tie(s, 'mido', 3)
      tie(s, 'makabe', 3)
      if (r.level <= 1 && has(s, 'kyuushuu')) {
        gain(s, 'idea', 2)
        gain(s, 'word', 1.5)
      }
      if (r.level === 0) count(s, 'dame')
      if (r.level === 3 && has(s, 'shiagari')) removeSkill(s, 'shiagari', '結果を出したら、講師が細かく見てくれるようになった。「仕上がってる扱い」が解けた。')
      break
    }
    case 'live':
      s.fans += r.level * 3 + (r.level === 3 ? 5 : 0)
      s.staffEval = clamp(s.staffEval + r.level * 2)
      if (r.level >= 2) r.lines.push(`作家票・社員票で上位${r.level === 3 ? '1' : '3'}組に入った。`)
      break
    case 'contest_conte':
    case 'contest_manzai': {
      const passed = r.score >= spec.difficulty + 8
      r.passed = passed
      const name = r.kind === 'contest_conte' ? 'コント頂' : '漫才天下一'
      s.contestResults.push({ name, result: passed ? '1回戦通過（2回戦敗退）' : '1回戦敗退' })
      r.lines.push('夜、公式サイトの結果ページを何度も更新した。')
      r.lines.push(passed ? `${s.comboName}の名前があった。` : `${s.comboName}の名前は、なかった。`)
      r.verdict = { head: `${name} 1回戦`, text: passed ? '通過！' : '敗退', good: passed }
      if (passed) {
        s.teacherEval = clamp(s.teacherEval + 10)
        s.staffEval = clamp(s.staffEval + 8)
        count(s, 'contestPass')
      }
      // 同じ大会に出ていたライバルの場面は、結果が出たその夜に起きる
      story(s, r.kind === 'contest_conte' ? 'rival_onaji_kumi' : 'rival_kekka_page')
      break
    }
    case 'gasshuku':
      // 前の晩に止められたネタで、どこまで取り返せたか
      if (r.level >= 2) {
        r.verdict = { head: '強化合宿', text: 'MVP！', good: true }
        r.lines.push('辻堂は、昨日と同じ席で腕を組んだまま、一回だけ頷いた。')
        r.lines.push('閉校式で、合宿MVPに名前を呼ばれた。「MVPは必ず売れる」というジンクスがあるらしい。')
        s.motivation = clamp(s.motivation + 15)
        s.staffEval = clamp(s.staffEval + 10)
        s.teacherEval = clamp(s.teacherEval + 6)
        tie(s, 'tsujido', 6)
        count(s, 'mvp')
      } else if (r.level === 1) {
        r.lines.push('辻堂「……昨日よりはマシや。マシなだけや」')
        r.lines.push('帰りのバスは、一番前ではなかった。それだけで、少しほっとした。')
        s.motivation = clamp(s.motivation + 5)
        tie(s, 'tsujido', 3)
      } else {
        r.lines.push('辻堂は、何も言わずに次の組を呼んだ。')
        r.lines.push('帰りのバスは一番前、辻堂の隣だった。高速を降りるまで、ひとことも話さなかった。')
        tie(s, 'tsujido', 2)
        gain(s, 'guts', 2)
      }
      break
    case 'tozai':
      s.staffEval = clamp(s.staffEval + r.level * 4)
      s.fans += r.level * 4
      break
    case 'grad_prelim': {
      const groups = Math.round(s.classmates / 2)
      const p = 1 / (1 + Math.exp(-(r.score - 100) / 9))
      const rank = Math.max(1, Math.min(groups, Math.round((1 - p) * groups) + rng.int(0, 2)))
      r.rank = rank
      r.lines.push(`予選の順位は${groups}組中${rank}位。`)
      r.verdict = { head: `予選 ${groups}組中`, text: rank <= 8 ? `${rank}位 決勝進出！` : `${rank}位`, good: rank <= 8 }
      if (rank <= 8) {
        r.lines.push('決勝進出。2本目をやる。')
        r.lines.push(rivalOf(s) === 'mido' ? '決勝の名簿に、御堂のコンビの名前もあった。' : '決勝の名簿に、真壁のコンビの名前もあった。')
        push(s, { type: 'stage', kind: 'grad_final' })
      } else {
        s.gradRank = rank
        r.lines.push(
          rivalOf(s) === 'mido'
            ? s.flags.mido_warai
              ? '決勝は客席から観た。御堂のコンビの最後のツッコミの前に、御堂が舞台で吹き出した。0.5秒遅れたツッコミで、会場がその日いちばん沸いた。相方が、いちばん嬉しそうな顔をしていた。'
              : '決勝は客席から観た。御堂のコンビは、台本にない一言で、その日いちばんの笑いを取っていた。'
            : `決勝は客席から観た。真壁は最後までしゃべらなかった。暗転の直前に、ひとことだけ「おはようございます」。夜の劇場に朝の挨拶が響いて、会場がひっくり返った。${s.flags.makabe_promise ? '袖で待つ約束は、守れなかった。' : ''}`,
        )
      }
      break
    }
    case 'grad_final': {
      const p = 1 / (1 + Math.exp(-(r.score - 125) / 10))
      const rank = Math.max(1, Math.min(8, Math.round((1 - p) * 8) + 1))
      r.rank = rank
      s.gradRank = rank
      r.lines.push(rank === 1 ? '優勝。卒業総代に選ばれた。' : `決勝${rank}位。`)
      r.verdict = { head: '卒業大会「門出」決勝', text: rank === 1 ? '優勝！' : `${rank}位`, good: rank <= 3 }
      // ライバルの結果【物語の回収】
      if (rivalOf(s) === 'mido')
        r.lines.push(
          rank === 1
            ? s.flags.mido_warai
              ? '準優勝は御堂のコンビ。最後のツッコミの前に、御堂は舞台で吹き出していた。袖ですれ違ったとき、御堂は「笑っちゃった」とだけ言った。目が赤かった。'
              : s.flags.mido_promise
                ? '準優勝は御堂のコンビ。袖ですれ違ったとき、御堂は「手加減、しなかったね」とだけ言った。目が赤かった。'
                : '準優勝は御堂のコンビ。袖で、御堂が拍手していた。目は笑っていなかった。'
            : rank <= 3
              ? `優勝は御堂のコンビだった。最後のツッコミは、0.5秒遅かった。${s.flags.mido_warai ? '御堂が、舞台の上で笑っていた。' : ''}台本にない間だった。`
              : `御堂のコンビは、自分たちより1つ上だった。${s.flags.mido_warai ? '最後のツッコミの前に、御堂が一度だけ吹き出していた。' : ''}`,
        )
      else
        r.lines.push(
          rank === 1
            ? s.flags.makabe_promise
              ? '準優勝は真壁のコンビ。最後の一言の「おはようございます」は、約束どおり袖まではっきり届いた。真壁はキャップを取って、深く頭を下げた。'
              : '準優勝は真壁のコンビ。最後の一言は「おはようございます」だった。真壁は袖で、メモ帳に何か書いていた。'
            : s.flags.makabe_promise
              ? '優勝は真壁のコンビだった。最後の一言の「おはようございます」は、袖で聞いた。インタビューで真壁は「……どうも」とだけ言った。会場がいちばん笑った。'
              : '優勝は真壁のコンビだった。最後の一言は「おはようございます」。インタビューで真壁は「……どうも」とだけ言った。会場がいちばん笑った。',
        )
      if (rank === 1) s.fans += 30
      break
    }
  }
}

// イベントが全部終わったときに呼ぶ。入学直後のイベントなら1週目を始め、それ以外は次の週へ進める
export function endEvents(prev: GameState): GameState {
  if (prev.phase === 'result') return prev
  if (prev.flags.intro) {
    const s = clone(prev)
    s.flags.intro = false
    s.phase = 'week'
    return s
  }
  return finishWeek(prev)
}

export function finishWeek(prev: GameState): GameState {
  const s = clone(prev)
  s.weekLog = []
  withRng(s, (rng) => {
    checkSkills(s)
    // 月初のクラス更新（10月から）
    const { month, week } = weekInfo(s.turn)
    if (week === 2 && [10, 11, 12, 1].includes(month)) {
      const before = s.classRank
      s.classRank = s.teacherEval >= 55 ? 'matsu' : s.teacherEval >= 35 ? 'take' : 'ume'
      if (s.classRank === 'ume') count(s, 'ume')
      if (month === 10) story(s, 'class_change')
      else if (before !== s.classRank) s.weekLog.push(`クラスが${{ none: '', ume: '梅組', take: '竹組', matsu: '松組' }[s.classRank]}に変わった。`)
    }
    s.turn += 1
    s.classmates = Math.max(90, expectedClassmates(s.turn) + rng.int(-3, 3))
    if (s.turn >= TOTAL_TURNS) {
      s.turn = TOTAL_TURNS
      if ((s.counters.rest ?? 0) >= 8 || has(s, 'chikoku')) story(s, 'kyusai')
      story(s, 'sotsugyo')
    }
  })
  s.lastStage = null
  s.phase = s.pending.length ? 'event' : 'week'
  return s
}

function checkSkills(s: GameState): void {
  const c = (k: string) => s.counters[k] ?? 0
  if (c('tsukamiUke') >= 3) addSkill(s, 'tsukami', '最初の一言でつかむ舞台が、3回続いた。芸風スキル「ツカミ名人」を覚えた。')
  if (c('neta') >= 8) addSkill(s, 'ryousan', 'ネタ作りの日を重ねて、書くのが速くなった。芸風スキル「量産型」を覚えた。')
  if (c('level3') >= 2) addSkill(s, 'honban', '大きくウケた舞台が2回あった。本番の空気が怖くなくなった。芸風スキル「本番に強い」を覚えた。')
  if (c('hassei') >= 4) addSkill(s, 'kamanai', '発声と滑舌の練習を続けて、口が回るようになった。芸風スキル「噛まない」を覚えた。')
  if (c('hassei') >= 8) addSkill(s, 'koega', '発声練習を何度も重ねて、マイクなしでも後ろまで届くようになった。芸風スキル「声がデカい」を覚えた。')
  if (s.player.style === 'conte' && s.stats.expr >= 45) addSkill(s, 'hyoui', '表現力が上がって、コントの役に入りきれるようになった。芸風スキル「憑依型」を覚えた。')
  if (s.player.style === 'manzai' && s.stats.word >= 45) addSkill(s, 'hayakuchi', 'ワード力が上がって、言葉が詰まらずに出てくるようになった。芸風スキル「早口」を覚えた。')
  if (c('contestPass') >= 1) addSkill(s, 'battle', '賞レースの予選を通った。勝ち方が、少し見えた。芸風スキル「バトル脳」を覚えた。')
  if (c('nomi') >= 6) addSkill(s, 'kawaigarare', '先輩と何度も飲みに行くうちに、誘われる側になっていた。芸風スキル「かわいがられ」を覚えた。')
  if (c('orei') >= 4) addSkill(s, 'orei', '翌朝のお礼を欠かさず送っていたら、手が勝手に動くようになった。芸風スキル「お礼が早い」を覚えた。')
  if (c('dame') >= 4) addSkill(s, 'hagane', 'ダメ出しに慣れてきた。芸風スキル「鋼のメンタル」を覚えた。')
  if (c('baito') >= 10) addSkill(s, 'kugaku', 'バイトのシフトを10回こなした。働きながら続けるのが、当たり前になった。芸風スキル「苦学生」を覚えた。')
  if (s.partner && s.partner.bond >= 80) addSkill(s, 'aikata', '相方との関係が、言わなくても通じるところまで来た。芸風スキル「相方思い」を覚えた。')
  if (c('ume') >= 2) addSkill(s, 'zassou', '梅組の空気にも慣れた。芸風スキル「雑草魂」を覚えた。')
  if (c('suberi') >= 3 && s.stats.adlib >= 35) addSkill(s, 'suberikaeshi', 'スベった舞台を何度も経験して、スベったあとの一言が出るようになった。芸風スキル「スベり返し」を覚えた。')
  if (has(s, 'gakusei') && c('generalUke') >= 2 && s.stats.adlib >= 40) {
    removeSkill(s, 'gakusei', '一般のお客さんの笑いどころがつかめてきた。')
    addSkill(s, 'kurouto', '「学生お笑い臭」が化けて、芸風スキル「玄人殺し」になった。')
  }
  if (has(s, 'agari') && s.stats.guts >= 50) removeSkill(s, 'agari', '舞台に慣れて「あがり症」が消えた。')
  if (has(s, 'honban') && has(s, 'tsukami') && c('level3') >= 6 && s.stats.guts >= 65)
    addSkill(s, 'bakushou', '本番に強く、最初の一言でつかめて、爆笑をとった舞台が6回を数えた。どこに出ても笑いを持って帰ってこられる。極み「爆笑請負人」に到達した。')
  const patron = s.seniors.find((x) => x.like >= 75 && x.respect >= 60)
  if (patron && !has(s, 'kumi')) {
    addSkill(s, 'kumi', `${patron.name}さんとすっかり仲良くなり、芸も認めてもらえた。この人が引き上げてくれる。極み「秘蔵っ子」に到達した。`)
    s.flags[`patron_${patron.id}`] = true
  }
}

export function currentEvent(s: GameState) {
  return s.pending[0] ?? null
}

export function nextCandidates(): string[] {
  return PARTNER_CANDIDATES.map((p) => p.name)
}

export function moneyText(s: GameState): string {
  return yen(s.money)
}

// ---- セーブ ----
const SAVE_KEY = 'lough-academy-save-v2'

export function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // 保存できない環境でも遊べるようにする
  }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    return s.version === 3 ? s : null
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // 何もしない
  }
}

// ネタのカードを差し替える。ネタを変えると完成度は少し下がる
export function setNetaCard(prev: GameState, slot: CardSlot, cardId: string): GameState {
  if (prev.neta.cards[slot] === cardId || !prev.cards.includes(cardId)) return prev
  const s = clone(prev)
  s.neta.cards[slot] = cardId
  s.neta.polish = Math.round(s.neta.polish * 0.75)
  return s
}

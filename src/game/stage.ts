import { CARD_BY_ID } from './data/cards'
import { has } from './core'
import type { Rng } from './rng'
import { showcaseLines } from './showcase'
import type { CardSlot, GameState, StageKind, StageResult, StatKey, Tally } from './types'

export type Audience = 'teacher' | 'uchiwa' | 'general' | 'judge'

export interface StageSpec {
  kind: StageKind
  title: string
  venue: string
  audience: Audience
  difficulty: number
  big: boolean
  intro: string[]
}

export const STAGES: Record<StageKind, StageSpec> = {
  netamise: {
    kind: 'netamise',
    title: 'ネタ見せ授業',
    venue: '教室',
    audience: 'teacher',
    difficulty: 55,
    big: false,
    intro: ['体育座りの同期と、無表情の講師。', '「クラス・番号・コンビ名・ネタの種類」を叫んでから始める。声が小さいと怒られる。'],
  },
  live: {
    kind: 'live',
    title: '月イチ寄席「ほやほや」',
    venue: '学院のホール',
    audience: 'uchiwa',
    difficulty: 50,
    big: false,
    intro: ['客席は同期が呼んだ身内が中心。温かい。', 'ネタは2分。2分10秒を超えるとゴング。作家票と社員票で上位3組が発表される。'],
  },
  contest_conte: {
    kind: 'contest_conte',
    title: 'コント頂 1回戦',
    venue: '貸しホール',
    audience: 'judge',
    difficulty: 58,
    big: false,
    intro: ['受付でエントリー料を払い、胸に番号シールを貼る。', '控室は廊下。前の組の声が聞こえる中で、小声のネタ合わせ。'],
  },
  contest_manzai: {
    kind: 'contest_manzai',
    title: '漫才天下一 1回戦',
    venue: '貸しホール',
    audience: 'judge',
    difficulty: 60,
    big: false,
    intro: ['参加料は1人1,000円。売れっ子でも受付で払う。', 'ネタは2分。審査員は主に作家。結果は今夜、公式サイトに出る。'],
  },
  tozai: {
    kind: 'tozai',
    title: '東西寄席合戦',
    venue: '大阪の劇場（アウェイ）',
    audience: 'general',
    difficulty: 64,
    big: true,
    intro: ['選抜された数組だけが出られる、東西の養成所の対抗戦。', 'アウェイの客席は、こっちの名前を誰も知らない。'],
  },
  grad_prelim: {
    kind: 'grad_prelim',
    title: '卒業大会「門出」予選',
    venue: '2,000人入るホール',
    audience: 'general',
    difficulty: 64,
    big: true,
    intro: ['同期全組が1分ネタで競う。', '上位8組だけが決勝で2本目をやれる。'],
  },
  grad_final: {
    kind: 'grad_final',
    title: '卒業大会「門出」決勝',
    venue: '2,000人入るホール',
    audience: 'general',
    difficulty: 74,
    big: true,
    intro: ['残ったのは8組。優勝すれば卒業総代。', '総代になると、卒業後1か月は仕事でスケジュールが埋まるという。'],
  },
}

const STYLE_STATS: Record<'manzai' | 'conte', StatKey[]> = {
  manzai: ['word', 'idea', 'adlib'],
  conte: ['expr', 'idea', 'adlib'],
}

const SLOTS: CardSlot[] = ['tsukami', 'tenkai', 'ochi']

export function netaComplete(state: GameState): boolean {
  return SLOTS.every((s) => state.neta.cards[s])
}

export function cardPower(state: GameState): number {
  return SLOTS.reduce((sum, s) => {
    const id = state.neta.cards[s]
    return sum + (id ? CARD_BY_ID[id].power : 0)
  }, 0)
}

interface Breakdown {
  cards: number
  stats: number
  polish: number
  partner: number
  luck: number
  mods: number
}

// ネタの点数を計算する。lines には客席の反応やスキルの発動を書き足す
export function scoreStage(state: GameState, spec: StageSpec, rng: Rng, lines: string[]): { score: number; b: Breakdown } {
  const style = state.player.style
  const b: Breakdown = { cards: 0, stats: 0, polish: 0, partner: 0, luck: 0, mods: 0 }

  b.cards = cardPower(state)
  if (!netaComplete(state)) {
    b.mods -= 20
    lines.push('ネタが最後までできていない。')
  }

  const keys = STYLE_STATS[style]
  b.stats = (keys.reduce((s, k) => s + state.stats[k], 0) / keys.length) * 0.6
  b.polish = state.neta.polish * 0.25

  if (state.partner) {
    const pk = STYLE_STATS[style]
    b.partner = (pk.reduce((s, k) => s + state.partner!.stats[k], 0) / pk.length) * 0.2 + state.partner.bond * 0.08
  }

  // 本番のブレ。度胸が高いほど上振れしやすい
  let luck = rng.int(-12, 10) + (state.stats.guts - 30) * 0.15
  if (has(state, 'honban')) luck = Math.max(luck, rng.int(-4, 12))
  if (has(state, 'agari')) luck -= 6
  if (state.condition < 30) {
    luck -= 8
    lines.push('体調が悪く、声に張りがない。')
  }
  b.luck = luck

  for (const slot of SLOTS) {
    const id = state.neta.cards[slot]
    if (!id) continue
    const card = CARD_BY_ID[id]
    if (card.style !== 'both' && card.style !== style) b.mods -= 4
    const tags = card.tags ?? []
    if (tags.includes('niche')) {
      if (spec.audience === 'general') b.mods -= 3
      if (spec.audience === 'judge' || spec.audience === 'teacher') b.mods += 2
    }
    if (tags.includes('word') && has(state, 'kotoba')) b.mods += 2
    if (slot === 'tsukami' && has(state, 'tsukami')) b.mods += 3
  }

  if (style === 'conte' && has(state, 'hyoui')) b.mods += 5
  if (style === 'manzai' && has(state, 'hayakuchi')) b.mods += 5
  if (spec.big && has(state, 'koega')) b.mods += 4
  if (spec.big && !has(state, 'koega') && state.stats.expr < 30) {
    b.mods -= 3
    lines.push('広い会場で声が後ろまで届いていない。')
  }
  if ((spec.audience === 'judge' || spec.kind === 'tozai' || spec.kind.startsWith('grad')) && has(state, 'battle')) b.mods += 4
  if ((spec.audience === 'judge' || spec.audience === 'teacher') && has(state, 'kurouto')) b.mods += 6
  if (has(state, 'gakusei')) {
    if (spec.audience === 'general') {
      b.mods -= 8
      lines.push('学生ライブの鉄板ボケが、一般のお客さんには届かない。')
    } else if (spec.audience === 'uchiwa') b.mods += 2
  }
  if (spec.big && has(state, 'bakushou')) b.mods += 8
  if (spec.big && has(state, 'gekidan')) b.mods += 3
  if ((spec.audience === 'judge' || spec.audience === 'teacher') && has(state, 'makezu')) b.mods += 3
  if (spec.audience === 'general' && has(state, 'kaonajimi')) b.mods += 3

  if (spec.kind === 'netamise') {
    const q = state.queueChoice
    if (q === 'early2') b.mods += 3
    if (q === 'early1') b.mods += 1
    if (q === 'late') b.mods -= 2
    if (q === 'last') b.mods -= 5
  }

  const score = Math.round(b.cards + b.stats + b.polish + b.partner + b.luck + b.mods)
  return { score, b }
}

const LEVEL_TEXT = ['スベった', 'まばらな笑い', 'ウケた', '爆笑']

// 講師・作家のダメ出し。一番弱いところを突く【research/02,06】
function pickComment(state: GameState, b: Breakdown, level: number, rng: Rng): string {
  if (!netaComplete(state)) return '「ネタになってない。最後まで作ってから来て」'
  if (level >= 3) return rng.pick(['「……まあ、悪くない」', '「それでええねん。次も持ってきて」', '「今日はこれで終わりでいい」'])
  if (has(state, 'shiagari') && level >= 1) return '「仕上がってるね」（それ以上は何も言われなかった）'
  if (state.neta.polish < 30) return rng.pick(['「言わされてる感がある」', '「練習してないやろ。学芸会ではない」'])
  if (b.cards < 30) return rng.pick(['「おもんない」', '「どっかで見たことある。パクリやろ」', '「なんで面白いと思った？」'])
  if (state.player.style === 'conte' && state.stats.expr < 30) return '「どこで誰が何をやっているのか全くわからない」'
  if (level === 2) return rng.pick(['「ツカミは良かった。後半もたつく」', '「オチ、もう一個先あるやろ」'])
  return rng.pick(['「ただの自己満でしょ」', '「お客さん置いてけぼりやな」', '「わけわからん」'])
}

type Grade = 'great' | 'good' | 'miss'
// 見せ場1つあたりの加点。ドッとシーンで結果が1〜2段階変わるくらいの差をつける
// 見せ場が2つある大舞台は、合計が大きくなりすぎないよう1つあたりを少し割り引く
const GRADE_BONUS: Record<Grade, number> = { great: 24, good: 6, miss: -22 }
const BIG_STAGE_RATE = 0.75

export function showcaseBonus(showcase: Grade[]): number {
  const rate = showcase.length >= 2 ? BIG_STAGE_RATE : 1
  return Math.round(showcase.reduce((sum, g) => sum + GRADE_BONUS[g], 0) * rate)
}

// 本番の事故。セリフ飛び・噛み・段取りミス
type Accident = 'tobi' | 'kami' | 'dandori'
const ACCIDENT_TEXT: Record<Accident, string> = {
  tobi: '途中でセリフが飛んだ。相方がなんとかつないだ。',
  kami: '一番大事なセリフで噛んだ。客席の空気が一瞬止まった。',
  dandori: '段取りを間違えて、くだりの順番が入れ替わった。',
}

// 事故の起きやすさ。体調が悪いほど上がる。噛まないスキルがあれば大きく下がる
export function accidentRate(state: GameState): number {
  const p = state.condition < 30 ? 0.28 : state.condition < 45 ? 0.12 : 0.05
  return has(state, 'kamanai') ? p / 5 : p
}

// 本番前に出す、体調の注意書き。問題なければ null
export function conditionWarning(state: GameState): string | null {
  if (state.condition < 30) return '体調が悪い。セリフが飛びやすい（本番で事故が起きやすい）'
  if (state.condition < 45) return '体調がいまいち。本番で噛みやすい'
  return null
}

// 1本のネタの中で起きたことを数える。見せ場の出来とウケの大きさから決める
function countTally(state: GameState, level: number, showcase: Grade[], accident: Accident | null, rng: Rng): Tally {
  const base = [rng.int(0, 2), rng.int(3, 5), rng.int(6, 8), rng.int(9, 12)][level]
  const great = showcase.filter((g) => g === 'great').length
  const miss = showcase.filter((g) => g === 'miss').length
  // 体調が悪いと、事故にならない程度の噛みも増える
  const tired = state.condition < 30 ? 0.2 : state.condition < 45 ? 0.1 : 0
  const kamiRate = has(state, 'kamanai') ? 0.05 : (state.neta.polish < 40 ? 0.45 : 0.2) + tired
  return {
    warai: Math.max(0, base + great * 2 - miss),
    suberi: Math.max(0, [rng.int(3, 5), rng.int(1, 3), rng.int(0, 1), 0][level] + miss + (accident === 'dandori' ? 1 : 0)),
    kami: (rng.chance(kamiRate) ? rng.int(1, 2) : 0) + (accident === 'kami' ? 1 : 0),
    tobashi: accident === 'tobi' ? 1 : 0,
    hakushu: level >= 3 ? 1 + great : level === 2 && great > 0 ? 1 : 0,
    dokudan: level >= 3 && great === showcase.length && showcase.length > 0,
  }
}

// パワプロの「◯打数◯安打」にあたる、1行の結果文
function summarize(state: GameState, spec: StageSpec, t: Tally, rank: number | null, field: number | null): string {
  const who = state.comboName ?? state.player.callName
  const parts = [`笑い ${t.warai}回`, `スベリ ${t.suberi}回`]
  if (t.hakushu) parts.push(`拍手笑い ${t.hakushu}回`)
  if (t.tobashi) parts.push(`ネタ飛ばし ${t.tobashi}回`)
  const head = rank && field ? `${spec.title}は ${field}組中 ${rank}位。` : `${spec.title}が終わった。`
  const tail = t.dokudan ? '最後は独壇場だった。' : ''
  return `${head}${who}は ${parts.join('、')}。${tail}俺は 噛み ${t.kami}回 でした。`
}

export function performStage(state: GameState, kind: StageKind, rng: Rng, showcase: Grade[] = []): StageResult {
  const spec = STAGES[kind]
  const lines: string[] = []

  if (kind === 'netamise' && state.queueChoice === 'last' && rng.chance(0.35)) {
    return {
      kind,
      title: spec.title,
      score: 0,
      level: 0,
      comment: '授業時間が終わり、見てもらえなかった。',
      lines: ['最後尾に並んだら、順番が回ってこなかった。'],
    }
  }

  const scored = scoreStage(state, spec, rng, lines)
  const b = scored.b
  const score = scored.score + showcaseBonus(showcase)
  // 毎月ある授業と寄席は、1年のうちに客の目も肥えていく（年度末で+20）
  const ramp = kind === 'netamise' || kind === 'live' ? Math.round(state.turn / 2) : 0
  const margin = score - spec.difficulty - ramp
  let level: 0 | 1 | 2 | 3 = margin < 0 ? 0 : margin < 12 ? 1 : margin < 26 ? 2 : 3

  // 見せ場で何が起きたか。結果はここで大きく動く
  lines.push(...showcaseLines(state, kind, showcase))

  // 本番の事故。体調が悪いほど起きやすい
  let accident: Accident | null = null
  if (rng.chance(accidentRate(state))) {
    accident = rng.pick(['tobi', 'tobi', 'kami', 'dandori'] as const)
    if (level > 0) level = (level - 1) as 0 | 1 | 2
    lines.push(state.condition < 45 ? `体調の悪さがたたった。${ACCIDENT_TEXT[accident]}` : ACCIDENT_TEXT[accident])
  }
  if (level === 0 && has(state, 'suberikaeshi') && rng.chance(0.4)) {
    level = 1
    lines.push('とっさに謝ったら、それがウケた。')
  }

  if (level === 0) lines.push('客席が静まりかえる。自分の声だけが響く。')
  if (level === 1) lines.push('笑いはあった。ただ、まばらだった。')
  if (level === 2) lines.push('ちゃんと笑いが返ってきた。')
  if (level === 3) lines.push('笑い声で次のセリフが聞こえない。')

  // 見せ場の出来と、全体の結果のつながりを一言で
  if (showcase.length) {
    const allGreat = showcase.every((g) => g === 'great')
    const allMiss = showcase.every((g) => g === 'miss')
    if (allGreat) lines.push(level >= 2 ? '見せ場で掴んだ流れのまま、最後まで走り切った。' : '見せ場はドッと来た。ただ、ほかが追いつかなかった。')
    if (allMiss) lines.push(level <= 1 ? '見せ場で冷えた空気を、最後まで取り戻せなかった。' : '見せ場は外したが、ネタの地力で取り返した。')
  }

  const tally = countTally(state, level, showcase, accident, rng)
  // 授業と寄席は組数と順位を出す。大会の合否はイベント側で書く
  const field = kind === 'netamise' ? 12 : kind === 'live' ? 20 : null
  const rank = field ? Math.max(1, Math.min(field, Math.round(field * (0.55 - margin / 60)))) : null

  return {
    kind,
    title: spec.title,
    score,
    level,
    comment: spec.audience === 'teacher' ? pickComment(state, b, level, rng) : `${LEVEL_TEXT[level]}。`,
    lines,
    showcase,
    tally,
    summary: summarize(state, spec, tally, rank, field),
  }
}

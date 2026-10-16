// ネタ見せの「見せ場」。ネタ全体は見せず、1〜2か所だけをミニゲームにする
import { CARD_BY_ID } from './data/cards'
import { STAGES, type Audience } from './stage'
import type { GameState, StageKind } from './types'

export type ShowcaseGrade = 'great' | 'good' | 'miss'
export type ShowcaseKind = 'word' | 'tsukkomi'

// ボケの芸風の寄り。どちらが正解かは、自分の芸風と客層の組み合わせで決まる
export type Lean = 'shuru' | 'oudou'
export const LEAN_LABEL: Record<Lean, string> = { shuru: 'シュール寄り', oudou: '王道寄り' }

// ワード選び（ボケ担当）: 相方のフリに3択で返す
// 選択肢はシュール・王道・平凡の3つ。平凡はいつ選んでもスベる
export interface WordScene {
  kind: 'word'
  furi: string
  options: { text: string; flavor: Lean | 'flat'; react: string }[]
}

// ツッコミのタイミング（ツッコミ担当）: 相方のボケのあと、間を見てツッコむ
// center はちょうどいい間の位置。短いボケは早め、溜めるボケは遅め
export interface TsukkomiScene {
  kind: 'tsukkomi'
  boke: string
  tsukkomi: string
  center: number
}

export type Scene = WordScene | TsukkomiScene

export const WORD_SCENES: WordScene[] = [
  {
    kind: 'word',
    furi: '将来の夢は？',
    options: [
      { text: '定年退職', flavor: 'shuru', react: '「ゴールが早すぎるやろ！」' },
      { text: '総理大臣になって、祝日を全部月曜にする', flavor: 'oudou', react: '「三連休作りたいだけやん！」' },
      { text: 'お笑い芸人', flavor: 'flat', react: '「……今なってるやん」' },
    ],
  },
  {
    kind: 'word',
    furi: 'コンビニのバイトで、何が大変やった？',
    options: [
      { text: 'レジ打ち', flavor: 'flat', react: '「普通やな」' },
      { text: '客に「ポイントカードありますか」って聞かれる', flavor: 'shuru', react: '「お前が聞く側や！」' },
      { text: 'おでんの卵を数え間違えて、店長と朝まで数え直した', flavor: 'oudou', react: '「どんだけ卵あんねん！」' },
    ],
  },
  {
    kind: 'word',
    furi: '好きな食べ物は？',
    options: [
      { text: 'カレー', flavor: 'flat', react: '「……うん」' },
      { text: '母が作ったカップラーメン', flavor: 'oudou', react: '「お湯入れただけや！」' },
      { text: '消費期限', flavor: 'shuru', react: '「食べ物ちゃうわ！」' },
    ],
  },
  {
    kind: 'word',
    furi: '最近ハマってることある？',
    options: [
      { text: '知らない人の結婚式の二次会', flavor: 'shuru', react: '「誰やねんお前！」' },
      { text: 'エレベーターの「閉」を連打して、自分が挟まる', flavor: 'oudou', react: '「せっかちの末路や！」' },
      { text: 'サウナ', flavor: 'flat', react: '「流行ってるな」' },
    ],
  },
  {
    kind: 'word',
    furi: '休みの日は何してるん？',
    options: [
      { text: '寝てる', flavor: 'flat', react: '「まあ、せやな」' },
      { text: '休みを探してる', flavor: 'shuru', react: '「もう見つかってるやん」' },
      { text: '平日のことを考えて、胃が痛くなってる', flavor: 'oudou', react: '「休めてへんやないか！」' },
    ],
  },
  {
    kind: 'word',
    furi: '初めて買ったCDは？',
    options: [
      { text: 'CD-R', flavor: 'shuru', react: '「何も入ってへん！」' },
      { text: 'お経', flavor: 'oudou', react: '「渋すぎるやろ」' },
      { text: 'アニメの主題歌', flavor: 'flat', react: '「かわいいな」' },
    ],
  },
]

export const TSUKKOMI_SCENES: TsukkomiScene[] = [
  { kind: 'tsukkomi', boke: '僕、高所恐怖症なんで、2階建てバスの1階にしか乗れないんですよ', tsukkomi: '1階はただのバスや！', center: 0.5 },
  { kind: 'tsukkomi', boke: '早起きするために、毎晩夜ふかししてるんですよ', tsukkomi: '順番おかしいやろ！', center: 0.38 },
  { kind: 'tsukkomi', boke: '本番で緊張しないように、さっき楽屋で緊張しておきました', tsukkomi: '先払いすな！', center: 0.62 },
  { kind: 'tsukkomi', boke: 'お会計は……思い出で、お願いします', tsukkomi: '払えるか！', center: 0.72 },
  { kind: 'tsukkomi', boke: '趣味は貯金です。残高は今、7円です', tsukkomi: '向いてへんで！', center: 0.66 },
  { kind: 'tsukkomi', boke: 'うちの実家、太いんですよ。柱が', tsukkomi: '建物の話すな！', center: 0.44 },
]

// 担当で見せ場の種類が決まる。タイプの仕組みが入るまでの仮
export function showcaseKind(state: GameState): ShowcaseKind {
  return state.player.role === 'boke' ? 'word' : 'tsukkomi'
}

export function showcaseCount(kind: StageKind): number {
  return STAGES[kind].big ? 2 : 1
}

// 同じ週に同じ見せ場が出ないよう、ターンと舞台の回数から決める
export function pickScenes(state: GameState, kind: StageKind): Scene[] {
  const sk = showcaseKind(state)
  const pool: Scene[] = sk === 'word' ? WORD_SCENES : TSUKKOMI_SCENES
  const n = showcaseCount(kind)
  const start = (state.turn * 7 + state.stageHistory.length * 3) % pool.length
  return Array.from({ length: n }, (_, i) => pool[(start + i * 2) % pool.length])
}

// 選択肢の並びは毎回変える。位置で覚えられないように
export function shuffledOptions(scene: WordScene, seed: number): WordScene['options'] {
  const order = [0, 1, 2]
  let x = (seed * 2654435761) >>> 0
  for (let i = order.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) >>> 0
    const j = x % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.map((i) => scene.options[i])
}

// 芸風の寄り。ネタ帳のマニアックな札、玄人向けのスキル、発想と表現の差で決まる
export function playerLean(state: GameState): Lean {
  let p = 0
  for (const id of Object.values(state.neta.cards)) if (id && CARD_BY_ID[id]?.tags?.includes('niche')) p++
  if (state.skills.includes('gakusei') || state.skills.includes('kurouto')) p++
  if (state.stats.idea - state.stats.expr >= 10) p++
  return p >= 1 ? 'shuru' : 'oudou'
}

// 客層ごとの好み。講師と一般客は王道、審査員と身内客はシュールを買う
export const AUDIENCE_TASTE: Record<Audience, { lean: Lean; label: string }> = {
  teacher: { lean: 'oudou', label: '講師は、型ができているかを見ている' },
  uchiwa: { lean: 'shuru', label: '客席はほぼ芸人仲間。ひねったボケが好き' },
  judge: { lean: 'shuru', label: '審査員は、見たことのないボケを探している' },
  general: { lean: 'oudou', label: '一般のお客さん。わかりやすい笑いが好き' },
}

// 芸風と客層の両方に合えばドッ、片方ならクスッ、平凡なら必ずシーン
export function gradeWord(state: GameState, kind: StageKind, flavor: Lean | 'flat'): ShowcaseGrade {
  if (flavor === 'flat') return 'miss'
  const mine = flavor === playerLean(state)
  const crowd = flavor === AUDIENCE_TASTE[STAGES[kind].audience].lean
  if (mine && crowd) return 'great'
  return mine || crowd ? 'good' : 'miss'
}

// ツッコミの「間」のゲージ（0〜1）。狭いドッ帯の両側に、広めのクスッ帯がある
// 表現力とワード力で帯が広がる。大きい舞台ほど帯は狭く、針は速く、度胸が低いと針がブレる
export interface TsukkomiZones {
  great: { from: number; to: number }
  good: { from: number; to: number }
}

export function stagePressure(kind: StageKind): number {
  if (kind === 'grad_final') return 2
  if (STAGES[kind].big) return 1.5
  if (STAGES[kind].audience === 'judge') return 1
  return 0
}

export function tsukkomiZones(state: GameState, scene: TsukkomiScene, kind: StageKind): TsukkomiZones {
  const skill = (state.stats.expr + state.stats.word) / 2
  const shrink = 1 - stagePressure(kind) * 0.15
  const great = Math.min(0.11, 0.035 + skill * 0.0011) * shrink
  const good = Math.min(0.3, 0.14 + skill * 0.0022) * shrink
  const c = scene.center
  return {
    great: { from: c - great / 2, to: c + great / 2 },
    good: { from: c - good / 2, to: c + good / 2 },
  }
}

// 針が端まで行く時間（ミリ秒）
export function maDuration(kind: StageKind): number {
  return 1500 - stagePressure(kind) * 200
}

// 針のブレ幅。大きい舞台で度胸が低いほど大きい
export function needleShake(state: GameState, kind: StageKind): number {
  return stagePressure(kind) * Math.max(0, 60 - state.stats.guts) * 0.0006
}

// 発想力が高いと、一番いいボケが「ピンとくる」
export function wordHint(state: GameState): boolean {
  return state.stats.idea >= 45
}

export function gradeTsukkomi(state: GameState, scene: TsukkomiScene, kind: StageKind, at: number | null): { grade: ShowcaseGrade; label: string } {
  if (at === null) return { grade: 'miss', label: 'ツッコミ忘れ' }
  const z = tsukkomiZones(state, scene, kind)
  if (at >= z.great.from && at <= z.great.to) return { grade: 'great', label: 'ドンピシャ' }
  if (at < z.great.from) return at >= z.good.from ? { grade: 'good', label: '少し食い気味' } : { grade: 'miss', label: '食い気味' }
  return at <= z.good.to ? { grade: 'good', label: '少し間延び' } : { grade: 'miss', label: '間延び' }
}

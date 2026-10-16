// ネタ見せの「見せ場」。ネタ全体は見せず、1〜2か所だけをミニゲームにする
import { STAGES } from './stage'
import type { GameState, StageKind } from './types'

export type ShowcaseGrade = 'great' | 'good' | 'miss'
export type ShowcaseKind = 'word' | 'tsukkomi'

// ワード選び（ボケ担当）: 相方のフリに3択で返す
export interface WordScene {
  kind: 'word'
  furi: string
  options: { text: string; grade: ShowcaseGrade; react: string }[]
}

// ツッコミのタイミング（ツッコミ担当）: 相方のボケのあと、間を見てツッコむ
export interface TsukkomiScene {
  kind: 'tsukkomi'
  boke: string
  tsukkomi: string
}

export type Scene = WordScene | TsukkomiScene

export const WORD_SCENES: WordScene[] = [
  {
    kind: 'word',
    furi: '将来の夢は？',
    options: [
      { text: '定年退職', grade: 'great', react: '「ゴールが早すぎるやろ！」' },
      { text: '宇宙飛行士', grade: 'good', react: '「急に壮大やな」' },
      { text: 'お笑い芸人', grade: 'miss', react: '「……今なってるやん」' },
    ],
  },
  {
    kind: 'word',
    furi: 'コンビニのバイトで、何が大変やった？',
    options: [
      { text: 'おでんの汁の量', grade: 'good', react: '「それは確かにムズいけど」' },
      { text: 'レジ打ち', grade: 'miss', react: '「普通やな」' },
      { text: '客に「ポイントカードありますか」って聞かれる', grade: 'great', react: '「お前が聞く側や！」' },
    ],
  },
  {
    kind: 'word',
    furi: '好きな食べ物は？',
    options: [
      { text: 'カレー', grade: 'miss', react: '「……うん」' },
      { text: '母が作ったカップラーメン', grade: 'great', react: '「お湯入れただけや！」' },
      { text: '味のしないガム', grade: 'good', react: '「捨てえや」' },
    ],
  },
  {
    kind: 'word',
    furi: '最近ハマってることある？',
    options: [
      { text: '知らない人の結婚式の二次会', grade: 'great', react: '「誰やねんお前！」' },
      { text: 'エレベーターの「閉」連打', grade: 'good', react: '「せっかちか」' },
      { text: 'サウナ', grade: 'miss', react: '「流行ってるな」' },
    ],
  },
  {
    kind: 'word',
    furi: '休みの日は何してるん？',
    options: [
      { text: '寝てる', grade: 'miss', react: '「まあ、せやな」' },
      { text: '休みを探してる', grade: 'good', react: '「もう見つかってるやん」' },
      { text: '平日のことを考えてる', grade: 'great', react: '「休めてへんやないか！」' },
    ],
  },
  {
    kind: 'word',
    furi: '初めて買ったCDは？',
    options: [
      { text: 'CD-R', grade: 'great', react: '「何も入ってへん！」' },
      { text: 'お経', grade: 'good', react: '「渋すぎるやろ」' },
      { text: 'アニメの主題歌', grade: 'miss', react: '「かわいいな」' },
    ],
  },
]

export const TSUKKOMI_SCENES: TsukkomiScene[] = [
  { kind: 'tsukkomi', boke: '僕、高所恐怖症なんで、2階建てバスの1階にしか乗れないんですよ', tsukkomi: '1階はただのバスや！' },
  { kind: 'tsukkomi', boke: '早起きするために、毎晩夜ふかししてるんですよ', tsukkomi: '順番おかしいやろ！' },
  { kind: 'tsukkomi', boke: '本番で緊張しないように、さっき楽屋で緊張しておきました', tsukkomi: '先払いすな！' },
  { kind: 'tsukkomi', boke: 'お会計は、思い出でお願いします', tsukkomi: '払えるか！' },
  { kind: 'tsukkomi', boke: '趣味は貯金です。残高は今、7円です', tsukkomi: '向いてへんで！' },
  { kind: 'tsukkomi', boke: 'うちの実家、太いんですよ。柱が', tsukkomi: '建物の話すな！' },
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

// ツッコミの「間」のゲージ（0〜1）。狭いドッ帯の両側に、広めのクスッ帯がある
// 表現力とワード力で、どちらの帯も広がる
export interface TsukkomiZones {
  great: { from: number; to: number }
  good: { from: number; to: number }
}

export function tsukkomiZones(state: GameState): TsukkomiZones {
  const skill = (state.stats.expr + state.stats.word) / 2
  const center = 0.62
  const great = Math.min(0.16, 0.05 + skill * 0.0016)
  const good = Math.min(0.42, 0.2 + skill * 0.003)
  return {
    great: { from: center - great / 2, to: center + great / 2 },
    good: { from: center - good / 2, to: center + good / 2 },
  }
}

// 発想力が高いと、一番いいボケが「ピンとくる」
export function wordHint(state: GameState): boolean {
  return state.stats.idea >= 45
}

export function gradeTsukkomi(state: GameState, at: number | null): { grade: ShowcaseGrade; label: string } {
  if (at === null) return { grade: 'miss', label: 'ツッコミ忘れ' }
  const z = tsukkomiZones(state)
  if (at >= z.great.from && at <= z.great.to) return { grade: 'great', label: 'ドンピシャ' }
  if (at < z.great.from) return at >= z.good.from ? { grade: 'good', label: '少し食い気味' } : { grade: 'miss', label: '食い気味' }
  return at <= z.good.to ? { grade: 'good', label: '少し間延び' } : { grade: 'miss', label: '間延び' }
}

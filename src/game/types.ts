export type StatKey = 'idea' | 'word' | 'expr' | 'guts' | 'adlib' | 'stamina'
export type Stats = Record<StatKey, number>

export const STAT_LABEL: Record<StatKey, string> = {
  idea: '発想力',
  word: 'ワード力',
  expr: '表現力',
  guts: '度胸',
  adlib: '対応力',
  stamina: '体力',
}
export const STAT_KEYS: StatKey[] = ['idea', 'word', 'expr', 'guts', 'adlib', 'stamina']

export type Role = 'boke' | 'tsukkomi'
export type Style = 'manzai' | 'conte'
export type Origin = 'local' | 'tokyo'
export type Gender = 'male' | 'female'
// 主人公の譲れないもの（5月の面談で決まる）
export type Kodawari = 'sainou' | 'kane' | 'kyaku' | 'nantonaku'
export type ClassRank = 'none' | 'ume' | 'take' | 'matsu'
export type CardSlot = 'tsukami' | 'tenkai' | 'ochi'

export interface Card {
  id: string
  name: string
  slot: CardSlot
  power: number
  style: Style | 'both'
  // 学生お笑い臭の判定などに使う
  tags?: ('niche' | 'body' | 'word' | 'jiji')[]
}

export interface Neta {
  cards: Record<CardSlot, string | null>
  polish: number // 完成度 0-100
}

export interface Partner {
  name: string
  role: Role
  blurb: string
  stats: Stats
  skills: string[]
  bond: number // 関係値 0-100
}

export interface Senior {
  id: string
  name: string
  title: string
  like: number // 仲の良さ 0-100
  respect: number // 認められ度 0-100
}

export interface PlayerProfile {
  name: string
  callName: string
  background: string
  origin: Origin
  gender?: Gender // 古いセーブにはない（男性扱い）
  role: Role
  style: Style
  hairColor: string
  outfit: string
}

export type StageKind = 'netamise' | 'live' | 'contest_conte' | 'contest_manzai' | 'tozai' | 'grad_prelim' | 'grad_final'

export interface StageResult {
  kind: StageKind
  title: string
  score: number
  level: 0 | 1 | 2 | 3 // スベり・まばら・ウケ・爆笑
  comment: string
  lines: string[]
  passed?: boolean
  rank?: number
  // 見せ場と結果文（古いセーブにはない）
  showcase?: ('great' | 'good' | 'miss')[]
  tally?: Tally
  summary?: string
}

// 結果文で数えるもの
export interface Tally {
  warai: number // 笑い
  suberi: number // スベリ
  kami: number // 噛み
  tobashi: number // ネタ飛ばし
  hakushu: number // 拍手笑い
  dokudan: boolean // 独壇場
}

// セーブできるよう、イベントはキーと引数だけを持つ。中身は events.ts の定義から作る
export type PendingEvent =
  | { type: 'story'; key: string; params?: Record<string, string | number> }
  | { type: 'stage'; kind: StageKind }

export interface GameState {
  version: 3
  rng: number
  player: PlayerProfile
  stats: Stats
  condition: number // 体調 0-100
  motivation: number // やる気 0-100
  money: number
  skills: string[]
  partner: Partner | null
  comboName: string
  seniors: Senior[]
  dokiBond: number // 同期の結束
  staffEval: number // 作家・社員の評価
  outsideRep: number // 外の縁（自主ライブ界隈）
  fans: number
  safePlay: number // 気を遣った回数（多いと「無難」扱い）
  edge: number // 尖り
  risk: number // 業界リスク（隠し）
  cards: string[]
  neta: Neta
  teacherEval: number
  classRank: ClassRank
  classmates: number
  turn: number // 0..TOTAL_TURNS-1、卒業後は TOTAL_TURNS
  queueChoice: 'early2' | 'early1' | 'late' | 'last' | null
  counters: Record<string, number>
  flags: Record<string, boolean>
  pending: PendingEvent[]
  weekLog: string[]
  lastStage: StageResult | null
  stageHistory: StageResult[]
  contestResults: { name: string; result: string }[]
  gradRank: number | null
  // 友好度（画面には出さない）。相方候補・ライバル・講師・街の人。相方は bond、先輩は like を使う
  ties?: Record<string, number>
  kodawari?: Kodawari
  // 発展イベントで受け継いだ特殊能力 → 誰から
  gifts?: Record<string, string>
  dayLines?: number // 今週のできごとのうち、昼の予定の行数（背景を昼の絵にするため）
  phase: 'week' | 'event' | 'ending' | 'result'
}

import { SKILL_BY_ID } from './data/skills'
import { has } from './core'
import { KODAWARI } from './kodawari'
import { STAT_KEYS, STAT_LABEL, type GameState, type StatKey } from './types'

// 卒業時の通信簿。能力ごとのS〜G評価、称号、講師の寸評、卒業式で隣にいた人

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

const GRADE_MIN: [number, Grade][] = [
  [85, 'S'],
  [75, 'A'],
  [65, 'B'],
  [55, 'C'],
  [45, 'D'],
  [35, 'E'],
  [25, 'F'],
  [0, 'G'],
]

export function gradeOf(v: number): Grade {
  return GRADE_MIN.find(([min]) => v >= min)?.[1] ?? 'G'
}

// シェア用の短い名前
const SHORT: Record<StatKey, string> = { idea: '発想', word: 'ワード', expr: '表現', guts: '度胸', adlib: '対応', stamina: '体力' }

// 一番高い能力で決まる称号の前半
const TITLE_HEAD: Record<StatKey, string> = {
  idea: '奇想天外な',
  word: '一言で刺す',
  expr: '顔で笑わす',
  guts: '心臓に毛が生えた',
  adlib: '転んでもタダでは起きない',
  stamina: '倒れない',
}

// 講師（辻堂）の寸評。いちばん高い能力をほめて、いちばん低い能力を刺す
const PRAISE: Record<StatKey, string> = {
  idea: '発想は同期で一番やった。誰も行かんところから入ってくる。',
  word: '言葉の選び方がええ。一言で空気を変えられる。',
  expr: '顔と体で笑いが取れる。台本以上のことができる。',
  guts: '舞台で物怖じせえへん。度胸は教えられへんからな。',
  adlib: '何が起きても拾える。事故を笑いに変えられるのは才能や。',
  stamina: 'とにかく倒れへん。最後に残るのは、こういうやつや。',
}
const STING: Record<StatKey, string> = {
  idea: 'ただ、ネタがどこかで見た形になる時がある。',
  word: 'ただ、言葉が雑。一言で損してる。',
  expr: 'ただ、声が後ろの席まで届いてへん。',
  guts: 'ただ、本番で目が泳ぐ。',
  adlib: 'ただ、台本から外れたら固まる。',
  stamina: 'ただ、すぐ体調崩す。体は資本やで。',
}

export interface Review {
  grades: { key: StatKey; label: string; value: number; grade: Grade }[]
  title: string
  comment: string // 寸評（2〜3文）
  oneLine: string // シェア用の一言
  neighbor: string // 卒業式で隣にいた人
  gifts: { name: string; from: string }[]
  kodawari?: string // 譲れないもの（守り通したかどうかつき）
  gradeLine: string
}

export function buildReview(s: GameState, rank: string): Review {
  const grades = STAT_KEYS.map((key) => ({ key, label: STAT_LABEL[key], value: Math.round(s.stats[key]), grade: gradeOf(s.stats[key]) }))
  const sorted = [...grades].sort((a, b) => b.value - a.value)
  const top = sorted[0].key
  const low = sorted[sorted.length - 1].key

  const tail = has(s, 'bakushou')
    ? '爆笑請負人'
    : has(s, 'kumi')
      ? '秘蔵っ子'
      : s.gradRank === 1
        ? '卒業総代'
        : s.flags.pin
          ? 'ピン芸人'
          : Object.keys(s.gifts ?? {}).length >= 3
          ? '人に恵まれた芸人'
          : (s.counters.kaisan ?? 0) >= 1
            ? '組み直した芸人'
            : s.classRank === 'matsu'
              ? '松組のエース'
              : s.classRank === 'ume'
                ? '梅組の雑草'
                : s.player.role === 'boke'
                  ? 'ボケ'
                  : 'ツッコミ'
  const title = `${TITLE_HEAD[top]}${tail}`

  const close =
    s.gradRank === 1
      ? '総代おめでとう。でも劇場では、また一番下からや。'
      : rank === 'S' || rank === 'A'
        ? '来年テレビで見かけても、驚かんわ。'
        : rank === 'B' || rank === 'C'
          ? '売れるかどうかは、ここからの1年次第や。'
          : rank === 'D' || rank === 'E'
            ? '正直、まだ何者でもない。でも辞めへんかったら、分からんで。'
            : 'おもんない。……けど、最後まで残ったのはお前や。'
  const k = s.kodawari ? KODAWARI[s.kodawari].label : undefined
  const keep = s.counters.kodawari_keep ?? 0
  const bend = s.counters.kodawari_bend ?? 0
  const promise = k ? (keep >= bend ? `面談で「${k}」言うてたな。最後まで曲げへんかった。` : `面談で「${k}」言うてたな。何回か曲げたやろ。それも芸人や。`) : ''
  const comment = `${PRAISE[top]}${top === low ? '' : STING[low]}${promise}${close}`

  const neighbor = s.partner ? `${s.partner.name}${(s.counters.kaisan ?? 0) >= 1 ? '（組み直した相方）' : ''}` : s.flags.pin ? '空席（ピンで卒業）' : '空席'

  const gifts = Object.entries(s.gifts ?? {})
    .filter(([id]) => has(s, id))
    .map(([id, from]) => ({ name: SKILL_BY_ID[id]?.name ?? id, from }))

  const gradeLine = grades.map((g) => `${SHORT[g.key]}${g.grade}`).join(' ')

  return { grades, title, comment, oneLine: close, neighbor, gifts, gradeLine, kodawari: k ? `${k}（${keep >= bend ? '守り通した' : '何度か曲げた'}）` : undefined }
}

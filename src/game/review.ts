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

// 講師（辻堂）の寸評。いちばん高い能力をほめて、いちばん低い能力を刺す。
// 毎回同じにならないよう数種から選ぶ（同じセーブなら同じ寸評になるよう、乱数ではなく状態から決める）
export const PRAISE: Record<StatKey, string[]> = {
  idea: [
    '発想は同期で一番やった。誰も行かんところから入ってくる。',
    'ネタの入口が毎回ちゃうねん。どこで拾てくるんか知らんけど。',
    '設定だけで笑わせられる。それ、なかなかおらんで。',
    '変なこと考える頭は本物や。褒めてんで、一応。',
    'ネタ見せで「なんやそれ」て言わせたんは、お前が一番多い。',
  ],
  word: [
    '言葉の選び方がええ。一言で空気を変えられる。',
    'ワードが強い。三文字で客を持っていける。',
    'ツッコミの一言が的確や。言い過ぎへんのがええ。',
    '言葉の置き場所が分かってる。教えてできることちゃう。',
    '台本の一行一行に無駄がない。そこは認める。',
  ],
  expr: [
    '顔と体で笑いが取れる。台本以上のことができる。',
    '出てきただけで空気が変わる。それは武器や。',
    '表情がうるさい。ええ意味でな。',
    '同じセリフでも、お前が言うとウケる。ずるいわ。',
    '後ろの席からでも何してるか分かる。舞台向きの体や。',
  ],
  guts: [
    '舞台で物怖じせえへん。度胸は教えられへんからな。',
    'スベっても顔に出さへん。それが一番大事や。',
    '大きい舞台ほど落ち着いとる。腹が据わっとる。',
    '客が冷えてても、引かへんかった。そこは買うてる。',
    '緊張せえへんのか、しとるのに見せへんのか。どっちでもええ、強い。',
  ],
  adlib: [
    '何が起きても拾える。事故を笑いに変えられるのは才能や。',
    '噛んでも飛んでも、そっから笑い取ってくる。しぶとい。',
    '客の反応見て、その場で変えられる。それができるやつは少ない。',
    '台本にないとこが一番おもろかった。それも実力や。',
    'マイクが倒れた時のあれ、まだ覚えてるわ。',
  ],
  stamina: [
    'とにかく倒れへん。最後に残るのは、こういうやつや。',
    'バイト明けでも声が出とる。体だけは心配いらん。',
    '一年、一回も休まんかったな。地味やけど、それが一番難しい。',
    '何本ネタ合わせしても顔色変わらへん。羨ましいわ。',
    '体力は全部の土台や。お前はそこが分厚い。',
  ],
}
export const STING: Record<StatKey, string[]> = {
  idea: [
    'ただ、ネタがどこかで見た形になる時がある。',
    'ただ、設定がいつも無難。もっとアホなこと考え。',
    'ただ、ネタの入口が毎回一緒や。客は二回目で飽きる。',
    'ただ、「こういうのウケるやろ」が透けて見える。',
    'ただ、新ネタが出てこん。ネタ帳、白いやろ。',
  ],
  word: [
    'ただ、言葉が雑。一言で損してる。',
    'ただ、説明が長い。笑いは短い方に起きる。',
    'ただ、ツッコミが「なんでやねん」しかない。',
    'ただ、ええボケを言い方で潰しとる。',
    'ただ、ワードが弱い。辞書でも読み。',
  ],
  expr: [
    'ただ、声が後ろの席まで届いてへん。',
    'ただ、顔が死んどる。笑わす側が先に楽しそうにせな。',
    'ただ、棒立ちや。舞台は体も使うんやで。',
    'ただ、表情が一個しかない。',
    'ただ、ネタ中ずっと床見とる。客は床にはおらん。',
  ],
  guts: [
    'ただ、本番で目が泳ぐ。',
    'ただ、スベった瞬間に顔に出る。客はそれ見て冷める。',
    'ただ、出囃子で震えとるの、客席から見えとるで。',
    'ただ、大事な時ほど声が小さなる。逆や逆。',
    'ただ、ウケへんかったら早口になる。悪い癖や。',
  ],
  adlib: [
    'ただ、台本から外れたら固まる。',
    'ただ、噛んだ後の三秒、毎回固まっとる。',
    'ただ、客がざわついたら黙ってまう。',
    'ただ、想定外に弱い。舞台は想定外しか起きへん。',
    'ただ、台本通りにしかできへんのは、録音と一緒や。',
  ],
  stamina: [
    'ただ、すぐ体調崩す。体は資本やで。',
    'ただ、ネタ見せの日に限って熱出すな。',
    'ただ、二本目で息切れしとる。走れ。',
    'ただ、顔色悪いねん。ちゃんと食うてるか。',
    'ただ、バイトとネタの両立で毎回へばっとる。',
  ],
}

// 寸評の締め。ランク帯ごとに数種
const CLOSE: Record<'top' | 'high' | 'mid' | 'low' | 'bottom', string[]> = {
  top: [
    '総代おめでとう。でも劇場では、また一番下からや。',
    '総代や。……明日からは誰も褒めてくれへんで。',
    '一番で卒業したやつほど、一年後に消える。お前は消えるなよ。',
    '総代おめでとう。答辞、ちょっとスベってたけどな。',
  ],
  high: [
    '来年テレビで見かけても、驚かんわ。',
    '売れたら、ここの講師やったこと自慢させてもらうわ。',
    'あとは運だけや。運も実力のうちやけどな。',
    '売れても、学費の分割はちゃんと払えよ。',
  ],
  mid: [
    '売れるかどうかは、ここからの1年次第や。',
    '悪くない。けど、悪くないやつは毎年100人おる。',
    '伸びしろはある。伸ばすかどうかは知らん。',
    'まあ、続けたらええ。続けるのが一番難しいけどな。',
  ],
  low: [
    '正直、まだ何者でもない。でも辞めへんかったら、分からんで。',
    '今のままやと厳しい。今のままでおるつもりはないやろ。',
    'まだ下手や。下手なうちに、ようけ舞台出とけ。',
    '何者でもないうちは、何にでもなれる。……と、言うとくわ。',
  ],
  bottom: [
    'おもんない。……けど、最後まで残ったのはお前や。',
    'はっきり言うて、一番心配や。けど、一番覚えとるのもお前や。',
    'おもんなかった。一年でちょっとだけ、おもんなくなくなった。',
    '向いてへんかもしれん。向いてへんやつが売れるのも、この世界や。',
  ],
}

// 状態から決まる小さなハッシュ（FNV-1a）。同じセーブなら同じ寸評になる
function hashOf(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function pickBy<T>(items: readonly T[], seed: string): T {
  return items[hashOf(seed) % items.length]
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

  const tier =
    s.gradRank === 1 ? 'top' : rank === 'S' || rank === 'A' ? 'high' : rank === 'B' || rank === 'C' ? 'mid' : rank === 'D' || rank === 'E' ? 'low' : 'bottom'
  const key = `${s.player.name}|${s.player.callName}|${s.rng}|${s.turn}`
  const close = pickBy(CLOSE[tier], `${key}|close`)
  const k = s.kodawari ? KODAWARI[s.kodawari].label : undefined
  const keep = s.counters.kodawari_keep ?? 0
  const bend = s.counters.kodawari_bend ?? 0
  const promise = k ? (keep >= bend ? `面談で「${k}」言うてたな。最後まで曲げへんかった。` : `面談で「${k}」言うてたな。何回か曲げたやろ。それも芸人や。`) : ''
  const comment = `${pickBy(PRAISE[top], `${key}|praise`)}${top === low ? '' : pickBy(STING[low], `${key}|sting`)}${promise}${close}`

  const neighbor = s.partner ? `${s.partner.name}${(s.counters.kaisan ?? 0) >= 1 ? '（組み直した相方）' : ''}` : s.flags.pin ? '空席（ピンで卒業）' : '空席'

  const gifts = Object.entries(s.gifts ?? {})
    .filter(([id]) => has(s, id))
    .map(([id, from]) => ({ name: SKILL_BY_ID[id]?.name ?? id, from }))

  const gradeLine = grades.map((g) => `${SHORT[g.key]}${g.grade}`).join(' ')

  return { grades, title, comment, oneLine: close, neighbor, gifts, gradeLine, kodawari: k ? `${k}（${keep >= bend ? '守り通した' : '何度か曲げた'}）` : undefined }
}

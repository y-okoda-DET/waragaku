import type { Partner, Senior } from '../types'

// 先輩（人脈）。仲の良さと認められ度の2軸で持つ【research/05】
export const INITIAL_SENIORS: Senior[] = [
  { id: 'haibara', name: '灰原', title: '助手先輩（1期上）', like: 10, respect: 10 },
  { id: 'ookouchi', name: '大河内', title: 'お目付け役（芸歴18年）', like: 5, respect: 5 },
  { id: 'nakaji', name: 'ナカジ', title: 'バイト先の先輩芸人（自主ライブの顔）', like: 15, respect: 10 },
]

// 相方候補。相方見つけ会で出会う【research/02】
export const PARTNER_CANDIDATES: Omit<Partner, 'bond' | 'role'>[] = [
  {
    name: '向井',
    blurb: '入学式の夜の飲み会で向かいに座っていた。人懐っこい。',
    stats: { idea: 16, word: 18, expr: 20, guts: 18, adlib: 22, stamina: 20 },
    skills: ['kawaigarare'],
  },
  {
    name: '堂島',
    blurb: '同じ授業で一番スベっていた。でもネタ帳は分厚い。',
    stats: { idea: 28, word: 16, expr: 12, guts: 10, adlib: 12, stamina: 16 },
    skills: ['ryousan', 'agari'],
  },
  {
    name: '岸辺',
    blurb: '元劇団員。芝居がうまい。少しプライドが高い。',
    stats: { idea: 14, word: 14, expr: 28, guts: 20, adlib: 14, stamina: 18 },
    skills: ['hyoui'],
  },
  {
    name: '早瀬',
    blurb: '口が回る。同じ風呂なしアパートの隣の部屋に住んでいる。',
    stats: { idea: 14, word: 24, expr: 16, guts: 16, adlib: 18, stamina: 18 },
    skills: ['hayakuchi'],
  },
]

// 大学お笑いサークル出身のときの相方
export const CIRCLE_PARTNER: Omit<Partner, 'bond' | 'role'> = {
  name: '佐倉',
  blurb: 'サークルで4年組んできた相方。ネタの感性はぴったり。就職活動もしていたらしい。',
  stats: { idea: 26, word: 28, expr: 14, guts: 20, adlib: 20, stamina: 16 },
  skills: ['kotoba', 'gakusei'],
}

import type { Gender, Stats } from '../types'

// 主人公の見た目は性別ごとに固定（上画面の絵を性別ごとに1人ぶん用意するため）
export const PLAYER_LOOK: Record<Gender, { hairColor: string; outfit: string }> = {
  male: { hairColor: '#2b2b2b', outfit: 'parka' },
  female: { hairColor: '#6b4a2e', outfit: 'shirt' },
}

export interface Background {
  id: string
  name: string
  blurb: string
  stats: Partial<Stats>
  money: number
  skills: string[]
  cards?: string[]
  // サークル時代の相方と組んだまま入学する
  startsWithPartner?: boolean
  // 1週ごとの成長ボーナス（伸びしろ）
  growth?: number
}

// 設定書 v1 の経歴10種類。根拠は research/02, 04, 05, 06
export const BACKGROUNDS: Background[] = [
  {
    id: 'circle',
    name: '大学お笑いサークル出身',
    blurb: '22歳。大学のお笑いサークルで4年、相方の佐倉と学生ライブに出てきた。学生の大会は準決勝まで。佐倉と組んだまま入学する。仕上がってるけど、一般のお客さんは知らない。',
    stats: { idea: 34, word: 32, expr: 14, guts: 26, adlib: 24, stamina: 18 },
    money: 60000,
    skills: ['kotoba', 'gakusei', 'shiagari'],
    cards: ['k_intelli', 'o_meta'],
    startsWithPartner: true,
  },
  {
    id: 'highschool',
    name: '高校生お笑い大会の経験者',
    blurb: '高校で大会に出た。勢いと度胸はある。入学金免除の特待。',
    stats: { idea: 18, word: 16, expr: 18, guts: 30, adlib: 18, stamina: 28 },
    money: 50000,
    skills: ['battle'],
    cards: ['t_ippatsu'],
    growth: 1,
  },
  {
    id: 'chika',
    name: '自主ライブ上がり',
    blurb: 'エントリー料を払って地下ライブに出てきた。客を読む力はあるが、貯金はゼロ。',
    stats: { idea: 22, word: 20, expr: 18, guts: 28, adlib: 26, stamina: 20 },
    money: 15000,
    skills: ['honban'],
    cards: ['t_kyakuijiri'],
  },
  {
    id: 'student',
    name: 'お笑い未経験の大学生',
    blurb: '大学に通いながら入学。言葉は立つが、体力と時間が足りない。',
    stats: { idea: 20, word: 22, expr: 12, guts: 12, adlib: 14, stamina: 14 },
    money: 70000,
    skills: [],
  },
  {
    id: 'fresh',
    name: '高校卒業',
    blurb: '18歳。東京生まれ東京育ちで、実家から通う。高校を出てそのまま入学した。何も知らないけど、伸びしろだけはある。',
    stats: { idea: 14, word: 12, expr: 14, guts: 18, adlib: 14, stamina: 30 },
    money: 40000,
    skills: [],
    growth: 2,
  },
  {
    id: 'salaryman',
    name: '元会社員',
    blurb: '28歳。営業を6年やって、会社を辞めて来た。貯金と社会性はある。同期はほとんど年下で、つい敬語が出る。',
    stats: { idea: 18, word: 20, expr: 14, guts: 16, adlib: 22, stamina: 18 },
    money: 400000,
    skills: ['kawaigarare'],
  },
  {
    id: 'band',
    name: '元バンドマン',
    blurb: 'ステージ慣れはしている。お金にはルーズ。',
    stats: { idea: 16, word: 12, expr: 20, guts: 30, adlib: 16, stamina: 20 },
    money: 30000,
    skills: ['koega', 'rouhi'],
  },
  {
    id: 'athlete',
    name: '元体育会',
    blurb: '上下関係には慣れている。体力は誰にも負けない。表現はカタい。',
    stats: { idea: 12, word: 12, expr: 10, guts: 22, adlib: 14, stamina: 38 },
    money: 50000,
    skills: ['kawaigarare'],
    cards: ['o_taiatari'],
  },
  {
    id: 'freeter',
    name: 'フリーター',
    blurb: 'バイトのプロ。遅刻癖あり。',
    stats: { idea: 16, word: 14, expr: 16, guts: 18, adlib: 22, stamina: 24 },
    money: 80000,
    skills: ['kugaku', 'chikoku'],
  },
  {
    id: 'forty',
    name: '40歳の社会人',
    blurb: '最年長。ダメ出しには動じない。体力は正直キツい。',
    stats: { idea: 20, word: 20, expr: 14, guts: 22, adlib: 20, stamina: 10 },
    money: 300000,
    skills: ['hagane'],
  },
]

export const BACKGROUND_BY_ID: Record<string, Background> = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]))

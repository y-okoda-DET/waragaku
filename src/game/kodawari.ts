import { clamp, count } from './core'
import type { GameState, Kodawari } from './types'

// 主人公の「譲れないもの」。5月の面談で決まり、1年を通して試される
// 守る選択をすると、やる気が上がる。曲げると下がる。卒業時に講師の寸評で触れられる

export const KODAWARI: Record<Kodawari, { label: string; answer: string }> = {
  jisaku: { label: '自分で書いたネタで笑わせる', answer: '「自分で書いたネタで、笑わせたいからです」' },
  aikata: { label: '相方と2人で売れる', answer: '「相方と2人で、売れたいからです」' },
  kyaku: { label: '目の前のお客さんを笑わせる', answer: '「目の前のお客さんを、笑わせたいからです」' },
  nokoru: { label: '最後まで残る', answer: '「……最後まで、残りたいからです」' },
}

export const KODAWARI_KEYS: Kodawari[] = ['jisaku', 'aikata', 'kyaku', 'nokoru']

// どのイベントの何番目の選択肢が、譲れないものを守る／曲げるか
type Hook = Partial<Record<Kodawari, { keep?: number[]; bend?: number[] }>>
const HOOKS: Record<string, Hook> = {
  jiko: { kyaku: { keep: [0, 1, 3], bend: [2] }, aikata: { keep: [0], bend: [3] } },
  jiko_yoru: { aikata: { keep: [0], bend: [1] } },
  ketsudan: { aikata: { keep: [0], bend: [1, 2] } },
  kougyou: { jisaku: { keep: [2], bend: [1] }, kyaku: { keep: [1] } },
  gakuensai: { kyaku: { keep: [1] } },
  natsu_jugyo: { kyaku: { keep: [0] } },
  dev_dojima_2: { jisaku: { bend: [1] } },
  dev_mido_2: { jisaku: { bend: [1] } },
  shinneta: { jisaku: { keep: [0] } },
  late_partner: { aikata: { keep: [0] } },
  naitei: { aikata: { keep: [0], bend: [1] } },
  kaisan: { aikata: { keep: [0], bend: [1] }, nokoru: { keep: [0] } },
  chokueigyou: { nokoru: { keep: [1], bend: [0] }, kyaku: { bend: [0] } },
  debt: {},
  ikitteta: { nokoru: { keep: [1] } },
  tokushin: { nokoru: { keep: [0] } },
}

export function kodawariOf(s: GameState, key: string, choice: number): 'keep' | 'bend' | undefined {
  const k = s.kodawari
  const h = k ? HOOKS[key]?.[k] : undefined
  if (!h) return undefined
  if (h.keep?.includes(choice)) return 'keep'
  if (h.bend?.includes(choice)) return 'bend'
  return undefined
}

export function applyKodawari(s: GameState, key: string, choice: number): void {
  const r = kodawariOf(s, key, choice)
  if (r === 'keep') {
    count(s, 'kodawari_keep')
    s.motivation = clamp(s.motivation + 6)
  } else if (r === 'bend') {
    count(s, 'kodawari_bend')
    s.motivation = clamp(s.motivation - 6)
  }
}

// 山場で思い出す一行
export function recall(s: GameState): string[] {
  return s.kodawari ? [`ナレーション：面談で言った「${KODAWARI[s.kodawari].label}」が、頭の中で鳴った。`] : []
}

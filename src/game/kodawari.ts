import { clamp, count } from './core'
import type { GameState, Kodawari } from './types'

// 主人公の「譲れないもの」。5月の面談で決まり、1年を通して試される
// 守る選択をすると、やる気が上がる。曲げると下がる。卒業時に講師の寸評で触れられる

export const KODAWARI: Record<Kodawari, { label: string; answer: string }> = {
  sainou: { label: '自分の才能を試す', answer: '「自分の才能を、試したいからです」' },
  kane: { label: '売れて金持ちになる', answer: '「売れて、金持ちになりたいからです」' },
  kyaku: { label: '目の前のお客さんを笑わせる', answer: '「目の前のお客さんを、笑わせたいからです」' },
  nantonaku: { label: 'なんとなく', answer: '「……なんとなくです」' },
}

export const KODAWARI_KEYS: Kodawari[] = ['sainou', 'kane', 'kyaku', 'nantonaku']

// どのイベントの何番目の選択肢が、譲れないものを守る／曲げるか
type Hook = Partial<Record<Kodawari, { keep?: number[]; bend?: number[] }>>
const HOOKS: Record<string, Hook> = {
  shiren: { sainou: { keep: [1], bend: [0] }, kane: { keep: [1], bend: [0] }, kyaku: { keep: [1], bend: [0] }, nantonaku: { keep: [1], bend: [0] } },
  jiko: { kyaku: { keep: [0, 1, 3], bend: [2] } },
  kougyou: { sainou: { keep: [2], bend: [1] }, kyaku: { keep: [1] } },
  gakuensai: { kyaku: { keep: [1] } },
  natsu_jugyo: { kyaku: { keep: [0] } },
  dev_dojima_2: { sainou: { bend: [1] } },
  dev_mido_2: { sainou: { bend: [1] } },
  shinneta: { sainou: { keep: [0] } },
  kaisan: { nantonaku: { keep: [0] } },
  chokueigyou: { nantonaku: { keep: [1], bend: [0] }, kane: { bend: [0] }, kyaku: { bend: [0] } },
  debt: {},
  ikitteta: { nantonaku: { keep: [1] } },
  tokushin: { nantonaku: { keep: [0] } },
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

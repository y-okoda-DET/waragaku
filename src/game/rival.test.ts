import { describe, expect, it } from 'vitest'
import { affinity } from './bonds'
import { createGame } from './engine'
import { RIVAL_SCHEDULE, RIVAL_STORIES } from './rivalEvents'
import { Rng } from './rng'

const FACES = ['ふつう', '笑い', '爆笑', '驚き', '落ち込み', '怒り', '考え中', '照れ']
const LINE = /^(ナレーション：.+|[^（）「」]+（([^）]+)）「.+」)$/

function base() {
  const s = createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style: 'manzai', seed: 1 })
  s.comboName = 'テスト'
  return s
}

describe('ライバルのイベント', () => {
  it('予定はすべて定義があり、キーは rival_ で始まる', () => {
    for (const r of RIVAL_SCHEDULE) {
      expect(r.key.startsWith('rival_')).toBe(true)
      expect(RIVAL_STORIES[r.key]).toBeDefined()
    }
    expect(Object.keys(RIVAL_STORIES).length).toBe(RIVAL_SCHEDULE.length)
  })

  it('台本の形で書かれ、選択肢にはすべて reply がある', () => {
    const variants = [base(), Object.assign(base(), { gradRank: 1, flags: { mido_rival: true, mido_open: true, makabe_judge: true, makabe_seen: true, makabe_rival: true, jiko_saved: true, tokushin: true } })]
    for (const s of variants) {
      for (const [key, def] of Object.entries(RIVAL_STORIES)) {
        const v = def.view(s, {})
        const all = [...v.lines, ...v.choices.flatMap((c) => (Array.isArray(c.reply) ? c.reply : [c.reply ?? '']))]
        for (const l of all) {
          const m = l.match(LINE)
          expect(m, `${key}: ${l}`).not.toBeNull()
          if (m?.[2]) expect(FACES, `${key}: ${l}`).toContain(m[2])
        }
        expect(v.choices.length).toBeGreaterThanOrEqual(2)
        for (const c of v.choices) expect(c.reply, key).toBeTruthy()
      }
    }
  })

  it('選ぶとライバルとの仲が動く', () => {
    for (const def of Object.values(RIVAL_STORIES)) {
      for (let c = 0; c < 3; c++) {
        const s = base()
        const before = affinity(s, 'mido') + affinity(s, 'makabe')
        def.resolve?.(s, c, new Rng(1), {})
        expect(affinity(s, 'mido') + affinity(s, 'makabe')).toBeGreaterThan(before)
      }
    }
  })
})

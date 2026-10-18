import { describe, expect, it } from 'vitest'
import { DEV_STORIES, affinity } from './bonds'
import { createGame } from './engine'
import { RIVAL_VARIANT_KEYS, rivalVariant } from './rivalCareers'
import { RIVAL_SCHEDULE, RIVAL_STORIES } from './rivalEvents'
import type { Style } from './types'
import { Rng } from './rng'

const FACES = ['ふつう', '笑い', '爆笑', '驚き', '落ち込み', '怒り', '考え中', '照れ', '素顔']
const LINE = /^(ナレーション：.+|[^（）「」]+（([^）]+)）「.+」)$/

function base() {
  const s = createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style: 'manzai', seed: 1 })
  s.comboName = 'テスト'
  return s
}

// 漫才だけ・コントだけの場面
const STYLE_OF: Record<string, Style | undefined> = { rival_onaji_kumi: 'conte', rival_kekka_page: 'manzai' }
for (const r of RIVAL_SCHEDULE) STYLE_OF[r.key] ??= r.style

describe('ライバルのイベント', () => {
  it('予定はすべて定義があり、キーは rival_ で始まる', () => {
    for (const r of RIVAL_SCHEDULE) {
      expect(r.key.startsWith('rival_')).toBe(true)
      expect(RIVAL_STORIES[r.key]).toBeDefined()
    }
    // 予定にないのは、賞レースの夜に起きる2つだけ
    const scheduled = new Set(RIVAL_SCHEDULE.map((r) => r.key))
    expect(Object.keys(RIVAL_STORIES).filter((k) => !scheduled.has(k)).sort()).toEqual(['rival_kekka_page', 'rival_onaji_kumi'])
  })

  it('台本の形で書かれ、選択肢にはすべて reply がある', () => {
    const flags = { mido_rival: true, mido_open: true, mido_promise: true, makabe_judge: true, makabe_seen: true, makabe_rival: true, makabe_promise: true, jiko_saved: true, tokushin: true }
    const conte = () => Object.assign(base(), { player: { ...base().player, style: 'conte' as const } })
    const variants = [base(), Object.assign(base(), { gradRank: 1, flags }), conte(), Object.assign(conte(), { gradRank: 3, flags })]
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

  it('選ぶとその年のライバルとの仲が動き、もう1人は動かない', () => {
    const styleOf = STYLE_OF
    for (const [key, def] of Object.entries(RIVAL_STORIES)) {
      for (const style of ['manzai', 'conte'] as const) {
        if (styleOf[key] && styleOf[key] !== style) continue
        const [mine, other] = style === 'manzai' ? (['mido', 'makabe'] as const) : (['makabe', 'mido'] as const)
        for (let c = 0; c < 3; c++) {
          const s = Object.assign(base(), { player: { ...base().player, style } })
          const before = affinity(s, mine)
          const otherBefore = affinity(s, other)
          def.resolve?.(s, c, new Rng(1), {})
          expect(affinity(s, mine), `${key} ${style} ${c}`).toBeGreaterThan(before)
          expect(affinity(s, other), `${key} ${style} ${c}`).toBe(otherBefore)
        }
      }
    }
  })

  it('大学お笑い・元会社員の書き分けも台本の形で、選択肢の数が元と同じ', () => {
    const flags = { mido_rival: true, mido_open: true, mido_promise: true, mido_warai: true, makabe_judge: true, makabe_seen: true, makabe_rival: true, makabe_promise: true, jiko_saved: true, nyugaku_ohayo: true }
    for (const bg of ['circle', 'salaryman', 'fresh'] as const)
      for (const style of ['manzai', 'conte'] as const)
        for (const f of [{}, flags]) {
          const s = Object.assign(base(), { gradRank: 2, flags: { ...f }, player: { ...base().player, style, background: bg } })
          const other = style === 'manzai' ? '真壁' : '御堂'
          for (const [key, def] of [...Object.entries(RIVAL_STORIES), ...Object.entries(DEV_STORIES).filter(([k]) => /dev_(mido|makabe)_/.test(k))]) {
            if (key.startsWith('dev_') && !key.includes(style === 'manzai' ? 'mido' : 'makabe')) continue
            if (STYLE_OF[key] && STYLE_OF[key] !== style) continue
            const v = def.view(s, {})
            const all = [...v.lines, ...v.choices.flatMap((c) => (Array.isArray(c.reply) ? c.reply : [c.reply ?? '']))]
            for (const l of all) {
              const m = l.match(LINE)
              expect(m, `${bg} ${key}: ${l}`).not.toBeNull()
              if (m?.[2]) expect(FACES, `${bg} ${key}: ${l}`).toContain(m[2])
            }
            // 漫才の年に真壁、コントの年に御堂は、セリフでは出てこない
            for (const l of all) expect(l.startsWith(`${other}（`), `${bg} ${style} ${key}: ${l}`).toBe(false)
            for (const c of v.choices) expect(c.reply, key).toBeTruthy()
          }
        }
  })

  it('書き分けの選択肢の数は、元の場面と同じ', () => {
    for (const key of RIVAL_VARIANT_KEYS) {
      const [k, r] = key.split(':')
      const style: Style = (r ?? (k.includes('makabe') ? 'makabe' : 'mido')) === 'makabe' ? 'conte' : 'manzai'
      const def = RIVAL_STORIES[k] ?? DEV_STORIES[k]
      expect(def, key).toBeDefined()
      for (const bg of ['circle', 'salaryman'] as const) {
        const s = Object.assign(base(), { player: { ...base().player, style, background: bg } })
        const fresh = Object.assign(base(), { player: { ...base().player, style, background: 'fresh' } })
        expect(rivalVariant(s, key)?.choices.length, `${bg} ${key}`).toBe(def.view(fresh, {}).choices.length)
      }
    }
  })
})

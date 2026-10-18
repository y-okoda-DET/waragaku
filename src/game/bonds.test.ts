import { describe, expect, it } from 'vitest'
import { BOND_CHARS, DEV_COUNT, DEV_STORIES, affinity, scheduleBondEvent, tie } from './bonds'
import { turnOf } from './data/calendar'
import { SKILL_BY_ID } from './data/skills'
import { createGame, resolveStory } from './engine'
import { STORIES } from './events'
import { buildReview, gradeOf, PRAISE, STING } from './review'
import { Rng } from './rng'

const fresh = () => createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style: 'manzai', seed: 7 })

describe('友好度と発展イベント', () => {
  it('全員に発展イベントがあり、受け継げる特殊能力が定義されている', () => {
    expect(DEV_COUNT).toBe(Object.keys(DEV_STORIES).length)
    for (const c of BOND_CHARS) {
      expect(SKILL_BY_ID[c.skill]?.kind).toBe('gift')
      expect(STORIES[`dev_${c.id}_0`]).toBeDefined()
    }
  })

  it('友好度が足りて時期が来たら、その人のイベントが順に起き、最後に特殊能力を受け継げる', () => {
    let s = fresh()
    s.pending = []
    s.turn = turnOf(10, 1)
    tie(s, 'tencho', 80)
    expect(affinity(s, 'tencho')).toBeGreaterThanOrEqual(55)
    for (let step = 0; step < 2; step++) {
      s.counters.devAt_tencho = -99
      for (const c of BOND_CHARS) if (c.id !== 'tencho') s.counters[`dev_${c.id}`] = 9
      expect(scheduleBondEvent(s, new Rng(1))).toBe(true)
      expect(s.pending[s.pending.length - 1]).toEqual({ type: 'story', key: `dev_tencho_${step}`, params: undefined })
      s.phase = 'event'
      s = resolveStory(s, 0)
    }
    expect(s.skills).toContain('makanai')
    expect(s.gifts?.makanai).toBe('店長')
  })

  it('友好度が低いうちは起きない', () => {
    const s = fresh()
    s.pending = []
    s.turn = turnOf(10, 1)
    for (const c of BOND_CHARS) if (c.id !== 'mido') s.counters[`dev_${c.id}`] = 9
    expect(scheduleBondEvent(s, new Rng(1))).toBe(false)
  })
})

describe('通信簿', () => {
  it('能力をS〜Gで評価し、称号と寸評をつける', () => {
    expect(gradeOf(90)).toBe('S')
    expect(gradeOf(60)).toBe('C')
    expect(gradeOf(10)).toBe('G')
    const s = fresh()
    s.stats = { idea: 88, word: 20, expr: 50, guts: 40, adlib: 40, stamina: 40 }
    const r = buildReview(s, 'B')
    expect(r.title.startsWith('奇想天外な')).toBe(true)
    expect(PRAISE.idea.some((l) => r.comment.includes(l))).toBe(true)
    expect(STING.word.some((l) => r.comment.includes(l))).toBe(true)
    expect(r.gradeLine).toBe('発想S ワードG 表現D 度胸E 対応E 体力E')
    expect(r.neighbor).toBe('空席')
  })
})

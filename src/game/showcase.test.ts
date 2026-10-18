import { describe, expect, it } from 'vitest'
import { createGame, doStage, endEvents } from './engine'
import { Rng } from './rng'
import { CONTE_SCENES, TSUKKOMI_SCENES, WORD_SCENES, gradeConte, gradeRole, gradeWord, pickScenes, rememberPicks, type Scene, type WordScene } from './showcase'
import { accidentRate, conditionWarning, performStage } from './stage'
import type { GameState, Role, StageResult, Style } from './types'

function base(role: Role = 'boke', style: Style = 'manzai'): GameState {
  const s = endEvents(createGame({ name: 'a', callName: 'a', background: 'salaryman', origin: 'local', role, style, hairColor: '#000', outfit: 'suit', seed: 3 }))
  return { ...s, pending: [], phase: 'event' }
}

// 舞台を1つこなしたことにする
const played = (s: GameState, n: number): GameState => ({ ...s, stageHistory: [...s.stageHistory, ...Array.from({ length: n }, () => ({ kind: 'netamise', showcase: ['good'] }) as StageResult)] })

describe('見せ場の中身', () => {
  it('どの山も24本以上あり、選択肢は シュール・王道・平凡 が1つずつ', () => {
    for (const pool of [WORD_SCENES, TSUKKOMI_SCENES, CONTE_SCENES]) expect(pool.length).toBeGreaterThanOrEqual(24)
    for (const sc of WORD_SCENES) expect(sc.options.map((o) => o.flavor).sort()).toEqual(['flat', 'oudou', 'shuru'])
    for (const sc of CONTE_SCENES) expect(sc.open.map((o) => o.flavor).sort()).toEqual(['flat', 'oudou', 'shuru'])
    for (const sc of [...WORD_SCENES, ...TSUKKOMI_SCENES]) expect(sc.conte).toBeUndefined()
  })

  it('コントの主人公には、担当によらずコントの見せ場（入り・役・暗転）が出る', () => {
    expect(pickScenes(base('boke', 'conte'), 'netamise')[0]).toMatchObject({ kind: 'conte' })
    expect(pickScenes(base('tsukkomi', 'conte'), 'netamise')[0]).toMatchObject({ kind: 'conte' })
    expect(pickScenes(base('boke', 'manzai'), 'netamise')[0].conte).toBeUndefined()
  })

  it('山を一周するまで同じ見せ場は出ない', () => {
    for (const role of ['boke', 'tsukkomi'] as const)
      for (const style of ['manzai', 'conte'] as const) {
        const s = base(role, style)
        const seen = new Set<Scene>()
        for (let i = 0; i < 24; i++) seen.add(pickScenes(played(s, i), 'netamise')[0])
        expect(seen.size).toBe(24)
        // 大舞台の2つも別物
        const [a, b] = pickScenes(s, 'grad_final')
        expect(a).not.toBe(b)
      }
  })
})

describe('見せ場と結果のつながり', () => {
  const stage = (s: GameState, grades: ('great' | 'good' | 'miss')[], seed: number) => performStage(s, 'netamise', new Rng(seed), grades)

  it('ドッとシーンで、結果が平均1段階以上変わる', () => {
    // 能力と仕上がりの違う3人で比べる
    for (const v of [40, 55, 70]) {
      const s = { ...base(), neta: { ...base().neta, polish: v }, stats: { ...base().stats, word: v, idea: v, adlib: v, guts: v } }
      let diff = 0
      for (let seed = 1; seed <= 200; seed++) diff += stage(s, ['great'], seed).level - stage(s, ['miss'], seed).level
      expect(diff / 200).toBeGreaterThan(1)
    }
  })

  it('結果文で、見せ場で言った言葉を引用する', () => {
    const s = base()
    const scene = pickScenes(s, 'netamise')[0] as WordScene
    const best = scene.options.find((o) => gradeWord(s, 'netamise', o.flavor) === 'great')!
    rememberPicks(s, 'netamise', [{ grade: 'great', said: best.text }])
    const r = stage(s, ['great'], 1)
    expect(r.lines.some((l) => l.includes(`「${best.text}」`) && l.includes('客席が揺れた'))).toBe(true)
    // 覚えていなくても、見せ場の行は出る
    const m = stage(s, ['miss'], 1)
    expect(m.lines.some((l) => l.startsWith('見せ場'))).toBe(true)
  })

  it('ツッコミが遅れたら、遅れたと書かれる', () => {
    const s = base('tsukkomi')
    rememberPicks(s, 'netamise', [{ grade: 'miss', label: '間延び' }])
    const r = stage(s, ['miss'], 1)
    expect(r.lines.some((l) => l.includes('遅れて、笑いが死んだ'))).toBe(true)
  })

  it('doStage 経由でも見せ場の行が結果に残る', () => {
    const s = { ...base(), pending: [{ type: 'stage' as const, kind: 'netamise' as const }] }
    const r = doStage(s, ['great']).lastStage!
    expect(r.lines.some((l) => l.startsWith('見せ場'))).toBe(true)
  })
})

describe('体調と本番の事故', () => {
  it('体調が悪いほど事故が起きやすく、注意書きが出る', () => {
    const s = base()
    const good = { ...s, condition: 80 }
    const meh = { ...s, condition: 40 }
    const bad = { ...s, condition: 20 }
    expect(accidentRate(meh)).toBeGreaterThan(accidentRate(good))
    expect(accidentRate(bad)).toBeGreaterThan(accidentRate(meh))
    expect(conditionWarning(good)).toBeNull()
    expect(conditionWarning(meh)).toContain('体調')
    expect(conditionWarning(bad)).toContain('セリフが飛び')
  })

  it('体調のせいの事故は、結果文にそう書かれる', () => {
    const bad = { ...base(), condition: 20 }
    let hit = 0
    for (let seed = 1; seed <= 100; seed++) if (performStage(bad, 'netamise', new Rng(seed)).lines.some((l) => l.startsWith('体調の悪さがたたった'))) hit++
    expect(hit).toBeGreaterThan(10)
  })
})

describe('コントの見せ場', () => {
  it('入り・役・暗転の3つの山を合わせて出来が決まる', () => {
    expect(gradeConte(['great', 'great', 'good'])).toBe('great')
    expect(gradeConte(['great', 'miss', 'good'])).toBe('good')
    expect(gradeConte(['miss', 'good', 'miss'])).toBe('miss')
  })

  it('役のゲージは、外れた向きで「素が出た」か「やりすぎた」かが変わる', () => {
    expect(gradeRole(0.8, 0.1, 0.1).grade).toBe('great')
    expect(gradeRole(0.5, 0.4, 0.1).label).toBe('少し素が出た')
    expect(gradeRole(0.2, 0.1, 0.7).label).toBe('やりすぎた')
  })
})

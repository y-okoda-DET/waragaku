import { describe, expect, it } from 'vitest'
import { BACKGROUNDS } from './data/backgrounds'
import { TOTAL_TURNS, turnOf, weekInfo } from './data/calendar'
import { createGame, doStage, endEvents, resolveStory, runWeek, type DayAction, type NightAction } from './engine'
import { buildEpilogue } from './epilogue'
import { STORIES } from './events'
import { TSUKKOMI_SCENES, gradeTsukkomi, gradeWord, pickScenes, playerLean, tsukkomiZones } from './showcase'
import type { GameState } from './types'

// 簡単なボット。ネタ作り・ネタ合わせ・バイトを状況に応じて回す
function botWeek(s: GameState, i: number): [DayAction, NightAction] {
  let day: DayAction
  if (s.money < 20000) day = { type: 'baito', kind: 'izakaya' }
  else if (s.condition < 35) day = { type: 'rest' }
  else day = ([{ type: 'neta' }, { type: 'awase', place: 'family' }, { type: 'jishuren', kind: 'hassei' }, { type: 'jishulive' }] as DayAction[])[i % 4]
  const night: NightAction = s.condition < 45 ? { type: 'sleep' } : i % 3 === 0 ? { type: 'nomi', senior: 'nakaji' } : { type: 'netacho' }
  return [day, night]
}

function drainEvents(s: GameState): GameState {
  let guard = 0
  while (s.pending.length && guard++ < 50) {
    const ev = s.pending[0]
    if (ev.type === 'stage') s = doStage(s)
    else {
      const view = STORIES[ev.key].view(s, ev.params ?? {})
      s = resolveStory(s, 0, view.input ? 'テストコンビ' : undefined)
    }
  }
  return s
}

function playThrough(background: string, seed: number): GameState {
  let s = createGame({ name: '山田太郎', callName: 'ヤマダ', background, origin: 'tokyo', role: 'boke', style: 'manzai', hairColor: '#333', outfit: 'parka', seed })
  s = drainEvents(s)
  s = endEvents(s)
  let i = 0
  while (s.phase !== 'result' && i < 100) {
    const [d, n] = botWeek(s, i++)
    s = runWeek(s, d, n)
    s = drainEvents(s)
    s = endEvents(s)
    s = drainEvents(s)
  }
  return s
}

describe('カレンダー', () => {
  it('4月第3週から2月第4週まで42ターン', () => {
    expect(weekInfo(0)).toEqual({ month: 4, week: 3 })
    expect(weekInfo(TOTAL_TURNS - 1)).toEqual({ month: 2, week: 4 })
    expect(turnOf(9, 2)).toBe(2 + 4 * 4 + 1)
  })
})

describe('通しプレイ', () => {
  it.each(BACKGROUNDS.map((b) => b.id))('%s で卒業までたどり着ける', (bg) => {
    const s = playThrough(bg, 1234)
    expect(s.phase).toBe('result')
    expect(s.turn).toBe(TOTAL_TURNS)
    expect(s.partner).not.toBeNull()
    expect(s.comboName.length).toBeGreaterThan(0)
    expect(s.gradRank).not.toBeNull()
    expect(s.classmates).toBeLessThan(140)
    const ep = buildEpilogue(s)
    expect(ep.months.length).toBeGreaterThanOrEqual(7)
    expect(ep.shareText).toContain('総合ランク')
  })

  it('同じシードなら同じ結果になる', () => {
    const a = playThrough('fresh', 42)
    const b = playThrough('fresh', 42)
    expect(a.stats).toEqual(b.stats)
    expect(a.gradRank).toBe(b.gradRank)
  })

  it('人脈：仲が良いだけでは秘蔵っ子にならない', () => {
    let s = createGame({ name: 'a', callName: 'a', background: 'salaryman', origin: 'local', role: 'boke', style: 'manzai', hairColor: '#000', outfit: 'suit', seed: 7 })
    s = endEvents(drainEvents(s))
    s.seniors[0].like = 90
    s.seniors[0].respect = 10
    s = runWeek(s, { type: 'rest' }, { type: 'sleep' })
    s = endEvents(drainEvents(s))
    expect(s.skills).not.toContain('kumi')
    s.seniors[0].respect = 70
    s = runWeek(s, { type: 'rest' }, { type: 'sleep' })
    s = endEvents(drainEvents(s))
    expect(s.skills).toContain('kumi')
  })
})

describe('バランスの目安', () => {
  it('結果がばらける（全員が同じランクにならない）', () => {
    const ranks = new Set<string>()
    const grads: number[] = []
    let entries = 0
    let passes = 0
    for (let seed = 1; seed <= 30; seed++) {
      const bg = BACKGROUNDS[seed % BACKGROUNDS.length].id
      const s = playThrough(bg, seed)
      ranks.add(buildEpilogue(s).rank)
      grads.push(s.gradRank ?? 99)
      entries += s.contestResults.length
      passes += s.contestResults.filter((c) => c.result.includes('通過')).length
    }
    // 在学中の予選は大半が1回戦敗退。ただし通過する組もいる【research/03】
    expect(passes).toBeGreaterThan(0)
    expect(passes / entries).toBeLessThan(0.5)
    expect(ranks.size).toBeGreaterThanOrEqual(2)
    // 総代は簡単には取れない
    expect(grads.filter((g) => g === 1).length).toBeLessThan(10)
  })
})

describe('ネタ見せの見せ場', () => {
  const base = () => {
    let s = createGame({ name: 'a', callName: 'a', background: 'salaryman', origin: 'local', role: 'boke', style: 'manzai', hairColor: '#000', outfit: 'suit', seed: 3 })
    s = endEvents(drainEvents(s))
    return { ...s, phase: 'event' as const, pending: [{ type: 'stage' as const, kind: 'netamise' as const }] }
  }

  it('見せ場の出来が点数と結果文に効く', () => {
    const s = base()
    const great = doStage(s, ['great']).lastStage!
    const miss = doStage(s, ['miss']).lastStage!
    expect(great.score).toBeGreaterThan(miss.score)
    expect(great.showcase).toEqual(['great'])
    expect(great.summary).toMatch(/笑い \d+回/)
    expect(great.tally).toBeDefined()
  })

  it('ボケ担当はワード選び、普段の舞台は見せ場1つ', () => {
    const scenes = pickScenes(base(), 'netamise')
    expect(scenes).toHaveLength(1)
    expect(scenes[0].kind).toBe('word')
  })

  it('ボケの評価は芸風と客層で変わる', () => {
    const s = base()
    const lean = playerLean(s)
    const other = lean === 'shuru' ? 'oudou' : 'shuru'
    expect(gradeWord(s, 'netamise', 'flat')).toBe('miss')
    // 講師は王道、審査員はシュールを買う
    const teacherBest = gradeWord(s, 'netamise', 'oudou')
    const judgeBest = gradeWord(s, 'contest_manzai', 'shuru')
    expect(lean === 'oudou' ? teacherBest : judgeBest).toBe('great')
    expect(gradeWord(s, lean === 'oudou' ? 'contest_manzai' : 'netamise', other)).toBe('good')
  })

  it('ツッコミの間はボケごとに位置が違い、大舞台ほど狭い', () => {
    const s = base()
    const [a, b] = TSUKKOMI_SCENES
    const za = tsukkomiZones(s, a, 'netamise')
    expect(za.great.to - za.great.from).toBeLessThan(za.good.to - za.good.from)
    expect(tsukkomiZones(s, b, 'netamise').great.from).not.toBe(za.great.from)
    const zf = tsukkomiZones(s, a, 'grad_final')
    expect(zf.great.to - zf.great.from).toBeLessThan(za.great.to - za.great.from)
    expect(gradeTsukkomi(s, a, 'netamise', (za.great.from + za.great.to) / 2).grade).toBe('great')
    expect(gradeTsukkomi(s, a, 'netamise', (za.good.from + za.great.from) / 2).grade).toBe('good')
    expect(gradeTsukkomi(s, a, 'netamise', 0).grade).toBe('miss')
    expect(gradeTsukkomi(s, a, 'netamise', null).label).toBe('ツッコミ忘れ')
  })
})

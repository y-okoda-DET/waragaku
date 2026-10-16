import type { GameState, PendingEvent, StatKey } from './types'
import { BACKGROUND_BY_ID } from './data/backgrounds'

export const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v))

export function has(state: GameState, skill: string): boolean {
  return state.skills.includes(skill)
}

export function addSkill(state: GameState, skill: string, log: string): void {
  if (has(state, skill)) return
  state.skills.push(skill)
  state.weekLog.push(log)
}

export function removeSkill(state: GameState, skill: string, log: string): void {
  if (!has(state, skill)) return
  state.skills = state.skills.filter((s) => s !== skill)
  state.weekLog.push(log)
}

// やる気・体調・クラスで伸び方が変わる
export function growthMultiplier(state: GameState): number {
  let m = 0.6 + state.motivation / 125
  if (state.condition < 30) m *= 0.5
  if (state.classRank === 'ume' && has(state, 'zassou')) m *= 1.3
  return m
}

export function gain(state: GameState, key: StatKey, base: number): number {
  const before = state.stats[key]
  let amount = base * growthMultiplier(state)
  if (before >= 70) amount *= 0.5
  const growth = BACKGROUND_BY_ID[state.player.background]?.growth ?? 0
  amount += growth * 0.3
  state.stats[key] = clamp(Math.round((before + amount) * 10) / 10)
  return state.stats[key] - before
}

export function count(state: GameState, key: string, by = 1): number {
  state.counters[key] = (state.counters[key] ?? 0) + by
  return state.counters[key]
}

export function push(state: GameState, ev: PendingEvent): void {
  state.pending.push(ev)
}

export function story(state: GameState, key: string, params?: Record<string, string | number>): void {
  state.pending.push({ type: 'story', key, params })
}

export function yen(n: number): string {
  return `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('ja-JP')}円`
}

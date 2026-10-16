import { describe, expect, it } from 'vitest'
import { createGame, doStage, endEvents, resolveStory, runWeek } from './engine'
import { STORIES } from './events'
import { buildReview } from './review'
import type { GameState } from './types'

function play(seed: number, pick: (key: string, n: number) => number) {
  const seen: string[] = []
  const drain = (s: GameState) => {
    let g = 0
    while (s.pending.length && g++ < 60) {
      const ev = s.pending[0]
      if (ev.type === 'stage') s = doStage(s)
      else {
        seen.push(ev.key)
        const v = STORIES[ev.key].view(s, ev.params ?? {})
        s = resolveStory(s, v.choices.length ? pick(ev.key, v.choices.length) : 0, v.input ? 'テスト' : undefined)
      }
    }
    return s
  }
  let s = endEvents(drain(createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style: 'manzai', seed })))
  for (let i = 0; s.phase !== 'result' && i < 100; i++) {
    s = runWeek(s, s.money < 20000 ? { type: 'baito', kind: 'izakaya' } : { type: 'awase', place: 'family' }, { type: 'douki' })
    s = drain(endEvents(drain(s)))
  }
  return { s, seen }
}

describe('1年間の流れ', () => {
  it('足した行事が1年のうちに全部起きる', () => {
    const { s, seen } = play(5, () => 0)
    expect(s.phase).toBe('result')
    for (const key of ['aikata_kekka', 'nazo_jugyo', 'mendan', 'ikitteta', 'taisaku', 'natsu_jugyo', 'kiteinai', 'tokushin', 'gakuensai', 'sankou', 'finalist', 'jiko', 'jiko_yoru', 'tozai_home', 'gaisen', 'kougyou', 'ketsudan', 'sotsugyo'])
      expect(seen).toContain(key)
  })

  it('最後の決断でピンを選ぶと、卒業式の隣は空席になる', () => {
    // 決断では最後の選択肢（ピン）を選ぶ
    const { s } = play(5, (key, n) => (key === 'ketsudan' ? n - 1 : 0))
    expect(s.partner).toBeNull()
    expect(s.flags.pin).toBe(true)
    expect(buildReview(s, 'C').neighbor).toBe('空席（ピンで卒業）')
  })

  it('台本の表情は決まった言葉だけを使う', () => {
    const lines: string[] = []
    const s = createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style: 'manzai', seed: 1 })
    s.partner = { name: '向井', role: 'tsukkomi', blurb: '', stats: s.stats, skills: [], bond: 50 }
    for (const [key, def] of Object.entries(STORIES)) {
      if (key === 'aikata_kai' || key === 'aikata_kekka' || key === 'orei' || key === 'hikkoshi' || key === 'contest_entry') continue
      lines.push(...def.view(s, {}).lines)
    }
    const used = lines.flatMap((l) => [...l.matchAll(/^[^「（、。]{1,12}（([^）]+)）「/g)].map((m) => m[1]))
    expect(used.length).toBeGreaterThan(100)
    for (const e of used) expect(['ふつう', '笑い', '爆笑', '驚き', '落ち込み', '怒り', '考え中', '照れ']).toContain(e)
  })
})

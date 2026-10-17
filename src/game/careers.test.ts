import { describe, expect, it } from 'vitest'
import { CAREER_SCHEDULE, CAREER_STORIES, CAREERS, unlockedCareers } from './careers'
import { createGame } from './engine'
import { STORIES } from './events'
import { RIVAL_STORIES } from './rivalEvents'
import { YEAR_STORIES } from './yearEvents'
import { buildEpilogue } from './epilogue'
import type { Style } from './types'

const FACES = ['ふつう', '笑い', '爆笑', '驚き', '落ち込み', '怒り', '考え中', '照れ', '素顔']
const LINE = /^(ナレーション：.+|[^（）「」]+（([^）]+)）「.+」)$/

const game = (background: string, style: Style = 'manzai') => {
  const s = createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style, seed: 1, background })
  s.comboName = 'テスト'
  return s
}

describe('経歴ごとのシナリオ', () => {
  it('卒業した回数だけ、先頭から経歴が開く', () => {
    expect(unlockedCareers(0)).toEqual(['fresh'])
    expect(unlockedCareers(1)).toEqual(['fresh', 'circle'])
    expect(unlockedCareers(5)).toEqual(CAREERS.map((c) => c.id))
  })

  it('出来事は経歴ごとに3つずつあり、どれも台本の形で書かれている', () => {
    for (const c of ['circle', 'salaryman']) expect(CAREER_SCHEDULE.filter((e) => e.career === c)).toHaveLength(3)
    for (const e of CAREER_SCHEDULE) {
      expect(STORIES[e.key]).toBe(CAREER_STORIES[e.key])
      const v = CAREER_STORIES[e.key].view(game(e.career), {})
      const all = [...v.lines, ...v.choices.flatMap((c) => (Array.isArray(c.reply) ? c.reply : [c.reply ?? '']))]
      for (const l of all) {
        const m = l.match(LINE)
        expect(m, `${e.key}: ${l}`).not.toBeNull()
        if (m?.[2]) expect(FACES, `${e.key}: ${l}`).toContain(m[2])
      }
    }
  })

  it('入学式・街灯の下・2月の夜・卒業式・1年目の締めに、その経歴の行が入る', () => {
    const text = (bg: string, style: Style) => {
      const s = game(bg, style)
      s.gradRank = 3
      return [STORIES.nyugaku, RIVAL_STORIES.rival_kouen, RIVAL_STORIES.rival_yoru, YEAR_STORIES.sotsugyo].map((d) => d.view(s, {}).lines.join('\n')).join('\n') + buildEpilogue(s).months.map((m) => m.text).join('\n')
    }
    expect(text('circle', 'manzai')).toContain('3年前の準決勝')
    expect(text('circle', 'conte')).toContain('学祭')
    expect(text('circle', 'manzai')).toContain('5年目の隣')
    expect(text('salaryman', 'manzai')).toContain('さん、ですよね')
    expect(text('salaryman', 'conte')).toContain('会社の朝礼')
    expect(text('salaryman', 'manzai')).toContain('結婚式の余興')
    const fresh = text('fresh', 'manzai')
    expect(fresh).not.toContain('準決勝')
    expect(fresh).not.toContain('スーツで来たのは')
  })

  it('大学お笑いは佐倉と組んだまま入学し、高校の賞は高校卒業にだけつく', () => {
    const s = game('circle')
    expect(s.partner?.name).toBe('佐倉')
    for (let seed = 0; seed < 40; seed++) {
      const g = createGame({ name: 'a', callName: 'a', role: 'boke', style: 'manzai', seed, background: 'salaryman' })
      expect(g.skills).not.toContain('koukou_sho')
    }
  })
})

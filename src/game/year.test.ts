import { describe, expect, it } from 'vitest'
import { createGame, doStage, endEvents, resolveStory, runWeek } from './engine'
import { STORIES } from './events'
import { buildReview } from './review'
import type { GameState } from './types'

function play(seed: number, pick: (key: string, n: number) => number, style: 'manzai' | 'conte' = 'manzai') {
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
  let s = endEvents(drain(createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style, seed })))
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
    for (const key of ['senpai_ookouchi_deai', 'senpai_ookouchi_renraku', 'senpai_nakaji_deai', 'senpai_nakaji_renraku', 'taichou', 'aikata_kekka', 'nazo_jugyo', 'mendan', 'ikitteta', 'taisaku', 'natsu_jugyo', 'kiteinai', 'tokushin', 'gakuensai', 'sankou', 'finalist', 'jiko', 'jiko_yoru', 'tozai_home', 'gaisen', 'kougyou', 'ketsudan', 'sotsugyo'])
      expect(seen).toContain(key)
  })

  it('相方がいれば、門出の予選の前に袖の場面があり、賭けに乗ると予選の結果に相方の1行が入る', () => {
    const { s, seen } = play(5, () => 0)
    expect(seen).toContain('aikata_yama')
    expect(seen.indexOf('aikata_yama')).toBeGreaterThan(seen.indexOf('grad_intro'))
    expect(s.flags.aikata_yama).toBe(true)
  })

  it('漫才なら御堂、コントなら真壁の場面が1年のうちに起きる', () => {
    const manzai = play(5, () => 0).seen
    for (const key of ['rival_kouen', 'rival_sode_mido', 'rival_kekka_page', 'rival_bus', 'rival_waku', 'rival_jiko_ato', 'rival_yoru', 'rival_kadode_ato']) expect(manzai).toContain(key)
    for (const key of ['rival_sode', 'rival_onaji_kumi', 'rival_jiko_ato_makabe']) expect(manzai).not.toContain(key)
    const conte = play(5, () => 0, 'conte').seen
    for (const key of ['rival_kouen', 'rival_sode', 'rival_onaji_kumi', 'rival_bus', 'rival_waku', 'rival_jiko_ato_makabe', 'rival_yoru', 'rival_kadode_ato']) expect(conte).toContain(key)
    for (const key of ['rival_sode_mido', 'rival_kekka_page', 'rival_jiko_ato']) expect(conte).not.toContain(key)
  })

  it('面談で譲れないものが決まり、山場で守ると寸評に出る', () => {
    // 面談で「売れて、金持ちになりたい」（2番目）を選び、12月の試練では守る方（2番目）を選ぶ。ほかは最初の選択肢
    const { s, seen } = play(5, (key) => (key === 'mendan' || key === 'shiren' ? 1 : 0))
    expect(s.kodawari).toBe('kane')
    expect(s.counters.kodawari_keep ?? 0).toBeGreaterThan(0)
    expect(seen.filter((k) => k === 'aikata_scene').length).toBe(3)
    const r = buildReview(s, 'B')
    expect(r.comment).toContain('売れて金持ちになる')
    expect(r.kodawari).toContain('守り通した')
  })

  it('最後の決断でピンを選ぶと、卒業式の隣は空席になる', () => {
    // 決断では最後の選択肢（ピン）を選ぶ
    const { s } = play(5, (key, n) => (key === 'ketsudan' ? n - 1 : 0))
    expect(s.partner).toBeNull()
    expect(s.flags.pin).toBe(true)
    expect(buildReview(s, 'C').neighbor).toBe('空席（ピンで卒業）')
  })

  it('台本の表情は決まった言葉だけを使い、選択肢には反応がある', () => {
    const lines: string[] = []
    const missing: string[] = []
    const s = createGame({ name: '山田', callName: 'ヤマダ', role: 'boke', style: 'manzai', seed: 1 })
    s.partner = { name: '向井', role: 'tsukkomi', blurb: '', stats: s.stats, skills: [], bond: 50 }
    for (const [key, def] of Object.entries(STORIES)) {
      if (key === 'aikata_kai' || key === 'aikata_kekka' || key === 'orei' || key === 'hikkoshi' || key === 'contest_entry') continue
      const v = def.view(s, {})
      lines.push(...v.lines)
      // 選択肢には、選んだあとの相手の反応が必ずある
      for (const c of v.choices) {
        if (!c.reply) missing.push(`${key}「${c.label}」`)
        lines.push(...(Array.isArray(c.reply) ? c.reply : [c.reply ?? '']))
      }
    }
    const used = lines.flatMap((l) => [...l.matchAll(/^[^「（、。]{1,12}（([^）]+)）「/g)].map((m) => m[1]))
    expect(missing).toEqual([])
    expect(used.length).toBeGreaterThan(100)
    for (const e of used) expect(['ふつう', '笑い', '爆笑', '驚き', '落ち込み', '怒り', '考え中', '照れ']).toContain(e)
  })
})

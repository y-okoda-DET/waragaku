import { describe, expect, it } from 'vitest'
import { shotsOf } from './scene'

const names = ['しずく', '灰原', '向井']

describe('shotsOf', () => {
  it('shows nobody on narration without names, and only the named person otherwise', () => {
    const shots = shotsOf(['大笑芸能学院、入学式。同期は300人。', '壇上に助手先輩が並ぶ。灰原という先輩がマイクを持った。'], names)
    expect(shots[0].cast).toEqual([])
    expect(shots[1].cast).toEqual(['灰原'])
  })
  it('keeps the speaker on a following speech-only line', () => {
    const shots = shotsOf(['灰原が言った。「よろしく」', '「マジで今、両隣の人いなくなるから」'], names)
    expect(shots[1]).toEqual({ cast: ['灰原'], speaker: '灰原' })
  })
  it('marks the person named before the quote as the speaker', () => {
    const shots = shotsOf(['しずくを見て、向井が笑った。「組もうや」'], names)
    expect(shots[0]).toEqual({ cast: ['しずく', '向井'], speaker: '向井' })
  })
  it('does not show a role word used only as a topic', () => {
    expect(shotsOf(['講師の都合で休講になった。', '講師が名簿を見た。'], ['講師'])[0].cast).toEqual([])
    expect(shotsOf(['講師が名簿を見た。'], ['講師'])[0].cast).toEqual(['講師'])
  })
  it('maps 相方 to the partner', () => {
    expect(shotsOf(['相方が来ない。'], names, { 相方: '向井' })[0].cast).toEqual(['向井'])
  })
})

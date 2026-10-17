import { describe, expect, it } from 'vitest'
import { lineKey } from './seen'

describe('読んだ行の目印', () => {
  it('主人公や相方の名前が違っても、同じ行は同じ目印になる', () => {
    expect(lineKey('ヤマダ（笑い）「佐倉、行くで」', ['ヤマダ', '佐倉'])).toBe(lineKey('スズキ（笑い）「中島、行くで」', ['スズキ', '中島']))
    expect(lineKey('ナレーション：雨が降っていた。', [])).not.toBe(lineKey('ナレーション：雪が降っていた。', []))
  })
})

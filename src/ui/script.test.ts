import { describe, expect, it } from 'vitest'
import { parseLine } from './script'

describe('台本の読み取り', () => {
  it('名前（表情）「セリフ」から話し手と表情を取り出す', () => {
    expect(parseLine('向井（笑い）「組もうや、絶対おもろいって」')).toEqual({ text: '「組もうや、絶対おもろいって」', speaker: '向井', expr: 'smile', stage: '向井「組もうや、絶対おもろいって」' })
  })
  it('ナレーション：を外す', () => {
    expect(parseLine('ナレーション：教室に100人近くが集まる。').text).toBe('教室に100人近くが集まる。')
  })
  it('古い書き方の地の文や、途中にカギ括弧がある文はそのまま', () => {
    expect(parseLine('前に出た人に、司会が「手を挙げて！」と聞く').speaker).toBeUndefined()
    expect(parseLine('「おはようございます」').speaker).toBeUndefined()
  })
})

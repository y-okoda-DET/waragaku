import type { Expr } from './art'

// 台本の1行を読む
// ・名前（表情）「セリフ」 → 話し手と表情を取り出し、画面には「セリフ」だけ出す（名前は名札に出す）
// ・ナレーション：地の文 → 「ナレーション：」を外す
// ・それ以外（古い書き方）はそのまま

const EXPR_JA: Record<string, Expr> = {
  ふつう: 'normal',
  普通: 'normal',
  笑い: 'smile',
  笑顔: 'smile',
  爆笑: 'laugh',
  驚き: 'surprise',
  落ち込み: 'down',
  怒り: 'angry',
  考え中: 'think',
  考え: 'think',
  照れ: 'shy',
}

export interface ScriptLine {
  text: string // 画面に出す文
  speaker?: string
  expr?: Expr
  stage: string // 誰を映すかを決めるための文（名前＋セリフ）
}

const SPEECH = /^([^「（\s、。：]{1,12})(?:（([^）]+)）)?(「.*)$/s

export function parseLine(raw: string): ScriptLine {
  if (raw.startsWith('ナレーション：')) {
    const text = raw.slice('ナレーション：'.length)
    return { text, stage: text }
  }
  const m = SPEECH.exec(raw)
  if (!m) return { text: raw, stage: raw }
  const [, speaker, ex, speech] = m
  // 表情のない書き方で、カギ括弧のあとに文が続くもの（「レシートの裏に「…」と書いた。」など）は地の文
  if (!ex && !speech.endsWith('」')) return { text: raw, stage: raw }
  return { text: speech, speaker, expr: ex ? EXPR_JA[ex] : undefined, stage: speaker + speech }
}

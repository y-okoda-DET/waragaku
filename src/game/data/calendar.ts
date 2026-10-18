// 1ターン＝1週。4月は第3・4週の2ターン、5月〜2月は各4ターン。3月は卒業イベントだけ。
export const TOTAL_TURNS = 42

export interface WeekInfo {
  month: number // 4..12, 1, 2
  week: number // 1..4
}

const MONTHS = [5, 6, 7, 8, 9, 10, 11, 12, 1, 2]

export function weekInfo(turn: number): WeekInfo {
  if (turn <= 1) return { month: 4, week: turn + 3 }
  const i = turn - 2
  return { month: MONTHS[Math.floor(i / 4)], week: (i % 4) + 1 }
}

export function turnOf(month: number, week: number): number {
  if (month === 4) return week - 3
  return 2 + MONTHS.indexOf(month) * 4 + (week - 1)
}

export function weekLabel(turn: number): string {
  const { month, week } = weekInfo(turn)
  return `${month}月 第${week}週`
}

// 画面の日付の札。最後の週のあと（卒業式）は「3月」とだけ出す
export const dateLabel = (turn: number): string => (turn >= TOTAL_TURNS ? '3月' : weekLabel(turn))

// 在籍者数の目安。入学時300人、夏に半分、卒業時は100人前後【research/01,02,06】
export function expectedClassmates(turn: number): number {
  const points: [number, number][] = [
    [0, 300],
    [turnOf(6, 4), 250],
    [turnOf(9, 2), 160],
    [turnOf(12, 1), 125],
    [TOTAL_TURNS - 1, 105],
  ]
  for (let i = 1; i < points.length; i++) {
    const [t0, v0] = points[i - 1]
    const [t1, v1] = points[i]
    if (turn <= t1) return Math.round(v0 + ((v1 - v0) * (turn - t0)) / (t1 - t0))
  }
  return 105
}

// 再現できる乱数（mulberry32）。状態は GameState.rng に数値で持ち、セーブに含める。

export function nextRandom(seed: number): [number, number] {
  const t = (seed + 0x6d2b79f5) >>> 0
  let r = Math.imul(t ^ (t >>> 15), t | 1)
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296
  return [value, t]
}

// エンジン内で使う乱数ラッパー。使い終わったら state.rng に seed を書き戻す。
export class Rng {
  seed: number
  constructor(seed: number) {
    this.seed = seed >>> 0
  }
  next(): number {
    const [v, s] = nextRandom(this.seed)
    this.seed = s
    return v
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }
}

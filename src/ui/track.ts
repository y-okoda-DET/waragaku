// アクセス解析への記録。公開ページに GoatCounter か Google アナリティクスのタグが入っているときだけ送り、なければ何もしない。
// どの月まで遊ばれたか・どの経歴で始めたか・シェアが押されたかを見るため。同じ名前は1回の読み込みで1度だけ送る
type Counter = {
  goatcounter?: { count?: (o: { path: string; title?: string; event?: boolean }) => void }
  gtag?: (...args: unknown[]) => void
}

const sent = new Set<string>()

export function track(name: string): void {
  if (sent.has(name)) return
  sent.add(name)
  const w = window as unknown as Counter
  try {
    w.goatcounter?.count?.({ path: name, title: name, event: true })
    w.gtag?.('event', name)
  } catch {
    // 解析が失敗してもゲームは止めない
  }
}

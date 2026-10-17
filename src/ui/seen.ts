// 読んだことのある行（周回をまたいで覚えておく）。スキップで、読んだ行だけを飛ばすのに使う
// 名前は周回ごとに変わるので、主人公・相方・コンビ名を伏せてから覚える
const KEY = 'waragaku_seen_v1'
let store: Set<number> | null = null

function load(): Set<number> {
  if (store) return store
  store = new Set()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) for (const h of raw.split(',')) store.add(parseInt(h, 36))
  } catch {
    // 保存できない環境では、遊んでいる間だけ覚える
  }
  return store
}

let timer: ReturnType<typeof setTimeout> | undefined
function save() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, [...load()].map((h) => h.toString(36)).join(','))
    } catch {
      // 同上
    }
  }, 500)
}

export function lineKey(text: string, names: string[]): number {
  let t = text
  for (const n of names) if (n) t = t.split(n).join('＊')
  let h = 0x811c9dc5
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0
  return h
}

export const isSeen = (key: number) => load().has(key)

export function markSeen(key: number) {
  const s = load()
  if (s.has(key)) return
  s.add(key)
  save()
}

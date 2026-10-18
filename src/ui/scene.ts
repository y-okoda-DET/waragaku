// 会話画面で、各行に誰を映すかを決める
// ・その行に名前が出てくる人だけを映す（出てきた順、最大3人）
// ・名前の出ないセリフだけの行（「…」で始まる行）は、前の行の顔ぶれと話し手を引き継ぐ
// ・名前の出ない地の文は誰も映さない（背景だけ）
// ・「講師の都合」のような肩書き＋「の」は話題に出ているだけなので映さない
// ・話し手は、カギ括弧の直前に名前が出てくる人。2人以上映っているときは、話し手以外を暗くする

// 肩書きで呼ばれる人は「講師の都合」「講師の評価」のように話題に出るだけのことが多いので、その形は映さない
const ROLE_WORDS = ['講師', '店長', '支配人']

export type Shot = { cast: string[]; speaker?: string }

export function shotsOf(lines: string[], names: string[], aliases: Record<string, string> = {}): Shot[] {
  const shots: Shot[] = []
  let prev: Shot = { cast: [] }
  for (const line of lines) {
    const hits: { name: string; at: number }[] = []
    for (const n of names) {
      const at = line.indexOf(n)
      if (at < 0) continue
      if (ROLE_WORDS.includes(n) && line[at + n.length] === 'の') continue
      hits.push({ name: n, at })
    }
    for (const [word, name] of Object.entries(aliases)) {
      const at = line.indexOf(word)
      if (at >= 0 && !hits.some((h) => h.name === name)) hits.push({ name, at })
    }
    // 「向井」と「向井さん」のように名前が重なる場合に備えて、同じ位置の短い方を除く
    const found = hits
      .filter((h) => !hits.some((o) => o !== h && o.at <= h.at && o.at + o.name.length >= h.at + h.name.length && o.name.length > h.name.length))
      .sort((a, b) => a.at - b.at)
    const q = line.trimStart().startsWith('「') ? 0 : line.indexOf('「')
    let shot: Shot
    if (!found.length) {
      shot = q === 0 ? prev : { cast: [] }
    } else {
      const cast = [...new Set(found.map((h) => h.name))].slice(0, 3)
      const before = q > 0 ? found.filter((h) => h.at < q) : []
      shot = { cast, speaker: before.length ? before[before.length - 1].name : undefined }
    }
    shots.push(shot)
    prev = shot
  }
  return shots
}

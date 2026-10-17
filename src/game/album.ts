// 卒業アルバム。周をまたいで残る記録（セーブとは別に保存する）
import { SKILLS, type SkillKind } from './data/skills'
import { RANKS, buildEpilogue } from './epilogue'
import { rivalOf } from './rivalEvents'
import { CAREERS, CAREER_SCENES, MOCK_ALL_OPEN, careerLabel, pickFlag } from './careers'
import type { GameState } from './types'

export interface Album {
  runs: number
  bestRank?: string
  bestScore?: number
  bestGrad?: number
  skills: string[]
  routes: string[]
  rivals: string[]
  // 卒業したことのある経歴（選べる経歴は、卒業した回数で決まる）
  careers: string[]
  // 経歴ごとの場面で選んだ選択肢（「場面:番号」）
  careerPicks: string[]
  // 同じ卒業を二度数えないための印（新しい順に少しだけ持つ）
  keys: string[]
}

export const ROUTES = ['総代ルート', 'テレビルート', '秘蔵っ子ルート', 'SNSルート', '地道ルート（つぼみ組入り）', '地道ルート']

// 同期の結末。見ていないものは、名前を伏せて数だけ見せる
export const RIVAL_ENDINGS: { id: string; rival: 'mido' | 'makabe'; name: string }[] = [
  { id: 'mido_promise', rival: 'mido', name: '手加減しない約束' },
  { id: 'mido_warai', rival: 'mido', name: '舞台の上で笑った' },
  { id: 'mido_win', rival: 'mido', name: '決勝で御堂を上回った' },
  { id: 'makabe_sugao', rival: 'makabe', name: '素顔のおはよう' },
  { id: 'makabe_promise', rival: 'makabe', name: '袖で待つ約束' },
  { id: 'makabe_win', rival: 'makabe', name: '決勝で真壁を上回った' },
]

// 取っていない極みは、次の周の目当てになるよう道筋だけ見せる
export const KIWAMI_HINT: Record<string, string> = {
  bakushou: '賞レースでも、大舞台でも爆笑をとる',
  kumi: 'ある先輩と仲良くなり、芸も認めてもらう',
  izumi: 'ネタ帳を手放さない同期に学んで、ひたすら書く',
  tatakiage: '梅組から這い上がる',
  meikonbi: '相方とネタを合わせ続けて、合宿で結果を出す',
}

export const KIND_ORDER: { kind: SkillKind; label: string }[] = [
  { kind: 'kiwami', label: '★極み' },
  { kind: 'buki', label: '●武器' },
  { kind: 'gift', label: '◆受け継いだ能力' },
  { kind: 'kuse', label: '▲クセ' },
]

const KEY = 'lough-academy-album-v1'
const empty = (): Album => ({ runs: 0, skills: [], routes: [], rivals: [], careers: [], careerPicks: [], keys: [] })

export function loadAlbum(): Album {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<Album>) } : empty()
  } catch {
    return empty()
  }
}

function saveAlbum(a: Album): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    // 保存できない環境でも遊べるようにする
  }
}

const rankIndex = (r?: string) => (r ? RANKS.findIndex(([, x]) => x === r) : 99)

// この周で手に入れたもの
export function runEntries(s: GameState) {
  const ep = buildEpilogue(s)
  const got = SKILLS.filter((d) => s.skills.includes(d.id) || s.counters[`got_${d.id}`]).map((d) => d.id)
  const r = rivalOf(s)
  const rivals = RIVAL_ENDINGS.filter((e) => e.rival === r && (e.id.endsWith('_win') ? s.gradRank === 1 : s.flags[e.id])).map((e) => e.id)
  const picks = CAREER_SCENES.flatMap((c) => Array.from({ length: c.choices }, (_, i) => i).filter((i) => s.flags[pickFlag(c.key, i)]).map((i) => `${c.key}:${i}`))
  return { key: `${s.player.name}|${s.rng}|${ep.total}`, rank: ep.rank, total: ep.total, route: ep.route, skills: got, rivals, picks }
}

// 卒業を書き込む。新しく増えたものを返す（もう書いた卒業なら何も足さない）
const recorded = new Map<string, string[]>()
export function recordRun(s: GameState): { album: Album; fresh: string[] } {
  const a = loadAlbum()
  const e = runEntries(s)
  // 画面を開き直しても、この起動中に書いたぶんは同じものを返す
  if (a.keys.includes(e.key)) return { album: a, fresh: recorded.get(e.key) ?? [] }
  const fresh: string[] = []
  const add = (list: string[], v: string, label: string) => {
    if (list.includes(v)) return
    list.push(v)
    fresh.push(label)
  }
  // 点数を持っていない古い記録は、評価だけで比べる
  const better = a.bestScore !== undefined ? e.total > a.bestScore : rankIndex(e.rank) <= rankIndex(a.bestRank)
  if (better) {
    if (a.bestRank) fresh.push(`いちばん良い評価：${e.rank}（${e.total}点）`)
    a.bestRank = e.rank
    a.bestScore = e.total
  }
  if (s.gradRank && (!a.bestGrad || s.gradRank < a.bestGrad)) a.bestGrad = s.gradRank
  add(a.routes, e.route, `芸人1年目「${e.route}」`)
  if (!a.careers.includes(s.player.background)) a.careers.push(s.player.background)
  const newPicks = e.picks.filter((p) => !a.careerPicks.includes(p))
  a.careerPicks.push(...newPicks)
  if (newPicks.length) fresh.push(`${careerLabel(s.player.background)}の場面：まだ選んでいなかった道を${newPicks.length}つ見た`)
  for (const id of e.rivals) add(a.rivals, id, `同期の結末「${RIVAL_ENDINGS.find((x) => x.id === id)?.name}」`)
  // 特殊能力は数が多いので、1行にまとめる
  const newSkills = e.skills.filter((id) => !a.skills.includes(id))
  a.skills.push(...newSkills)
  if (newSkills.length) fresh.push(`特殊能力：${newSkills.map((id) => SKILLS.find((x) => x.id === id)?.name).join('、')}`)
  a.runs += 1
  a.keys = [e.key, ...a.keys].slice(0, 20)
  saveAlbum(a)
  // 卒業するたびに、次の経歴で入学できるようになる
  const opened = !MOCK_ALL_OPEN && CAREERS[a.runs] ? [`新しいキャラクター「${careerLabel(CAREERS[a.runs].id)}」で入学できるようになった`] : []
  const shown = [...(a.runs === 1 ? ['はじめての卒業。この1年を、卒業アルバムに残した'] : fresh), ...opened]
  recorded.set(e.key, shown)
  return { album: a, fresh: shown }
}

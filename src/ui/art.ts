import type { GameState, Gender } from '../game/types'

// ChatGPTで描いた絵（src/assets/art）。元画像は共有フォルダの art/raw にある
// ファイル名は「キャラ_表情.webp」と「bg_場所.webp」

const FILES = import.meta.glob('../assets/art/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>
const ART: Record<string, string> = {}
for (const [path, url] of Object.entries(FILES)) ART[path.slice(path.lastIndexOf('/') + 1, -'.webp'.length)] = url

export type Expr = 'normal' | 'smile' | 'laugh' | 'surprise' | 'down' | 'angry' | 'think' | 'shy'

// 名前 → 絵のキー。まだ絵がない人は出てこない（仮の似顔絵になる）
const CHARA_BY_NAME: Record<string, string> = {
  向井: 'mukai',
  堂島: 'dojima',
  岸辺: 'kishibe',
  早瀬: 'hayase',
  灰原: 'haibara',
  大河内: 'ookouchi',
  ナカジ: 'nakaji',
  講師: 'tsujido',
  辻堂: 'tsujido',
  三宅: 'miyake',
  店長: 'tencho',
  支配人: 'shihainin',
}

export function heroKey(gender: Gender | undefined): string {
  return gender === 'female' ? 'hero_f' : 'hero_m'
}

export function charaKey(state: GameState, name: string): string | undefined {
  if (name === state.player.callName) return heroKey(state.player.gender)
  return CHARA_BY_NAME[name]
}

export function portrait(key: string | undefined, expr: Expr): string | undefined {
  if (!key) return undefined
  return ART[`${key}_${expr}`] ?? ART[`${key}_normal`]
}

// イベント名 → 場所。背景がまだない場所は従来の色背景のまま
const PLACE_BY_TITLE: Record<string, string> = {
  入学式: 'koudou',
  '「実質、芸歴9年やろ」': 'kyoushitsu',
  相方見つけ会: 'kyoushitsu',
  コンビ名を決める: 'famires',
  ネタ見せの順番: 'rouka',
  ごちそうさまでした: 'izakaya',
  コント頂のエントリー: 'livehouse',
  漫才天下一のエントリー: 'livehouse',
  夏の強化合宿: 'rouka',
  コンプライアンス講習: 'kyoushitsu',
  クラス替え: 'rouka',
  光と影: 'rouka',
  東西寄席合戦の選考: 'kyoushitsu',
  卒業公演のオーディション: 'kyoushitsu',
  '卒業大会「門出」': 'butai',
  夜の公園: 'kouen',
  相方が来ない: 'ekimae',
  '「新ネタやろう！」': 'gakuya',
  貸した金: 'famires',
  同期LINE: 'heya',
  バラシ: 'heya',
  風呂なしアパート: 'heya',
  先輩の引っ越し: 'heya',
  知り合いの知り合いからの仕事: 'baito',
  相方の内定: 'famires',
  解散の危機: 'sodeura',
  お金が尽きた: 'heya',
  '3月 卒業': 'koudou',
}

export function background(title: string): string | undefined {
  const place = PLACE_BY_TITLE[title] ?? (title.includes('授業') || title.includes('ネタ見せ') ? 'kyoushitsu' : undefined)
  return place ? ART[`bg_${place}`] : undefined
}

// セリフの言葉から表情をざっくり決める。上から順に先に当たったもの
const EXPR_RULES: [RegExp, Expr][] = [
  [/爆笑|大笑い|腹を抱え|大ウケ|ドッ/, 'laugh'],
  [/怒|キレ|ふざけ|なめて|帰れ|声が小さい/, 'angry'],
  [/！？|まさか|えっ|え？|驚/, 'surprise'],
  [/照れ|ありがと|うれし|嬉し/, 'shy'],
  [/ため息|落ち込|ごめん|すみません|スベ|無理|しんど/, 'down'],
  [/うーん|考え|どうする|どうしよう|かな/, 'think'],
  [/笑|ウケ|いいね|ええやん|よろしく/, 'smile'],
]

export function exprOf(line: string): Expr {
  for (const [re, e] of EXPR_RULES) if (re.test(line)) return e
  return 'normal'
}

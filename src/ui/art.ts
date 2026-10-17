import type { GameState, Gender } from '../game/types'

// ChatGPTで描いた絵（src/assets/art）。元画像は共有フォルダの art/raw にある
// ファイル名は「キャラ_表情.webp」と「bg_場所.webp」

const FILES = import.meta.glob('../assets/art/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>
const ART: Record<string, string> = {}
for (const [path, url] of Object.entries(FILES)) ART[path.slice(path.lastIndexOf('/') + 1, -'.webp'.length)] = url

// bare は真壁がキャップを取った顔（一度だけ使う）
export type Expr = 'normal' | 'smile' | 'laugh' | 'surprise' | 'down' | 'angry' | 'think' | 'shy' | 'bare'

// 名前 → 絵のキー。まだ絵がない人は出てこない（仮の似顔絵になる）
const CHARA_BY_NAME: Record<string, string> = {
  向井: 'mukai',
  堂島: 'dojima',
  岸辺: 'kishibe',
  早瀬: 'hayase',
  灰原: 'haibara',
  大河内: 'ookouchi',
  ナカジ: 'nakaji',
  辻堂: 'tsujido',
  三宅: 'miyake',
  店長: 'tencho',
  支配人: 'shihainin',
  御堂: 'rival1',
  社員: 'shain',
  真壁: 'rival2',
  佐倉: 'sakura',
}

// 主人公の絵は経歴ごと（hero_m_circle など）。その経歴の絵がまだなければ、高校卒業の絵を使う
export function heroKey(gender: Gender | undefined, career?: string): string {
  const base = gender === 'female' ? 'hero_f' : 'hero_m'
  const k = career && career !== 'fresh' ? `${base}_${career}` : base
  return ART[`${k}_normal`] ? k : base
}

export function charaKey(state: GameState, name: string): string | undefined {
  if (name === state.player.callName) return heroKey(state.player.gender, state.player.background)
  return CHARA_BY_NAME[name]
}

export function portrait(key: string | undefined, expr: Expr): string | undefined {
  if (!key) return undefined
  return ART[`${key}_${expr}`] ?? ART[`${key}_normal`]
}

export function background(place: string): string | undefined {
  return ART[`bg_${place}`]
}

// イベント名 → 場所。背景がまだない場所は従来の色背景のまま
const PLACE_BY_TITLE: Record<string, string> = {
  入学式: 'koudou',
  '「実質、芸歴9年やろ」': 'kyoushitsu',
  相方見つけ会: 'kyoushitsu',
  コンビ名を決める: 'famires',
  ネタ見せの順番: 'rouka',
  ごちそうさまでした: 'heya',
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

// 「今週のできごと」のように場所が決まっていない画面は、その行の言葉から場所を選ぶ。上から順に先に当たったもの
const PLACE_BY_WORD: [RegExp, string][] = [
  [/バイト|まかない|店長/, 'baito'],
  [/飲み|ごちそう|ご馳走|居酒屋/, 'izakaya'],
  [/ファミレス/, 'famires'],
  [/カラオケ/, 'karaoke'],
  [/公園/, 'kouen'],
  [/楽屋/, 'gakuya'],
  [/ライブ/, 'livehouse'],
  [/寄席|劇場|舞台|大会/, 'butai'],
  [/事務所|社員/, 'jimusho'],
  [/授業|ネタ見せ|講師|教室|発声|練習/, 'kyoushitsu'],
  [/同期|掲示|選抜|クラス/, 'rouka'],
  [/駅|終電/, 'ekimae'],
  [/部屋|家賃|寝|ネタ帳|ネタの種|ネタを書|休/, 'heya'],
]

// その行の背景。イベントが場所を指定していればそれ、イベントごとに決まった場所があればそれ、なければ行の言葉、それもなければ前の行の場所を引き継ぐ
// dayLines: 先頭から何行が昼のできごとか。昼の行では、夜の絵を昼の絵（bg_◯◯_day）に差し替える
export function backgrounds(title: string, lines: string[], at?: string, dayLines = 0): (string | undefined)[] {
  const fixed = at ?? PLACE_BY_TITLE[title]
  let place = fixed ?? (title.includes('授業') || title.includes('ネタ見せ') ? 'kyoushitsu' : undefined)
  return lines.map((line, i) => {
    if (!fixed) place = PLACE_BY_WORD.find(([re]) => re.test(line))?.[1] ?? place ?? 'rouka'
    if (!place) return undefined
    // 文に「夜」「終電」とあれば、昼の予定でも夜の絵のまま
    return (i < dayLines && !/夜|終電/.test(line) && ART[`bg_${place}_day`]) || ART[`bg_${place}`]
  })
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

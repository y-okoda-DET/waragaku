import { SKILL_BY_ID } from './data/skills'
import { affinity } from './bonds'
import { has } from './core'
import { buildReview, type Review } from './review'
import { Rng } from './rng'
import { STAT_KEYS, type GameState } from './types'

export interface ResultSummary {
  rank: string
  total: number
  gradText: string
  route: string
  months: { label: string; text: string }[]
  shareText: string
  review: Review
}

// ふつうに遊ぶとCに落ち着くように置く（scripts/balance.ts の「ふつう」の真ん中がCの中ほど）
const RANKS: [number, string][] = [
  [470, 'S'],
  [445, 'A'],
  [425, 'B'],
  [395, 'C'],
  [365, 'D'],
  [335, 'E'],
  [300, 'F'],
  [0, 'G'],
]

export function totalScore(s: GameState): number {
  const stats = STAT_KEYS.reduce((sum, k) => sum + s.stats[k], 0)
  const skills = s.skills.reduce((sum, id) => {
    const k = SKILL_BY_ID[id]?.kind
    return sum + (k === 'kiwami' ? 25 : k === 'gift' ? 10 : k === 'buki' ? 8 : -6)
  }, 0)
  const grad = s.gradRank === 1 ? 40 : s.gradRank && s.gradRank <= 8 ? 20 : s.gradRank && s.gradRank <= 20 ? 8 : 0
  return Math.round(stats + skills + grad + s.fans / 3 + s.staffEval / 4)
}

export function rankOf(total: number): string {
  return RANKS.find(([min]) => total >= min)?.[1] ?? 'G'
}

// 卒業後1年目のダイジェスト。根拠は research/03（劇場・賞レース・収入）と 05（人脈）
export function buildEpilogue(s: GameState): ResultSummary {
  const rng = new Rng(s.rng ^ 0x5eed)
  const total = totalScore(s)
  const rank = rankOf(total)
  const power = total / 5 + rng.int(-8, 8) // おおむね 30〜100
  const patron = s.seniors.find((x) => s.flags[`patron_${x.id}`])
  const friendOnly = s.seniors.find((x) => x.like >= 60 && x.respect < 40)
  const so = s.gradRank === 1
  const pin = !!s.flags.pin
  const months: { label: string; text: string }[] = []

  months.push({
    label: '4月',
    text: so
      ? `大笑興業に${pin ? 'ピン芸人として' : ''}所属。卒業総代として、4月のスケジュールが全部仕事で埋まった。`
      : `大笑興業に${pin ? 'ピン芸人として' : ''}所属。坂上劇場の「のぼりざかライブ」への挑戦が始まった。バイトは続ける。`,
  })

  // 劇場オーディション（隔月・数百組）
  let passes = so ? 1 : 0
  for (let i = 0; i < 6; i++) if (rng.next() < Math.max(0.03, (power - 40) / 90)) passes++
  if (patron) passes++
  if (has(s, 'kaonajimi')) passes++
  const tsubomi = passes >= 2

  months.push({
    label: '5月',
    text: s.risk >= 50 ? '事務所を通さない仕事をしていたことが発覚。2か月の謹慎になった。' : `のぼりざかライブ。数百組の中で${passes > 0 ? '一つ勝ち上がった' : '勝ち上がれなかった'}。`,
  })

  if (patron) months.push({ label: '6月', text: `${patron.name}さんの営業にバーターで呼ばれた。移動の車の中でネタを見てもらった。` })
  else if (friendOnly) months.push({ label: '6月', text: `${friendOnly.name}さんからは飲みには誘われる。でも、ライブには呼ばれない。` })
  else months.push({ label: '6月', text: '同期と自主ライブを打った。客席は11人。打ち上げの方が盛り上がった。' })

  // 賞レース
  const contest = (bonus: number) => {
    const v = power + bonus + rng.int(-15, 15)
    if (v >= 105) return '決勝進出'
    if (v >= 92) return '準決勝進出'
    if (v >= 80) return '準々決勝敗退'
    if (v >= 68) return '3回戦敗退'
    if (v >= 55) return '2回戦敗退'
    return '1回戦敗退'
  }
  const conte = contest(s.player.style === 'conte' ? 5 : -8)
  const manzai = contest(s.player.style === 'manzai' ? 5 : -8)
  if (pin) {
    months.push({ label: '7月', text: 'コント頂も漫才天下一も、ひとりでは出られない。同期の予選を、客席から観た。' })
    months.push({ label: '11月', text: `ひとり芸王座：${conte}。${conte === '1回戦敗退' ? '受付で「お一人ですか」と聞かれた。' : '袖で、ひとりで小さくガッツポーズをした。'}` })
  } else {
    months.push({ label: '7月', text: `コント頂：${conte}。${conte === '1回戦敗退' ? '結果ページに名前はなかった。' : ''}` })
    months.push({
      label: '9月',
      text: `漫才天下一：${manzai}。${manzai.includes('3回戦') || manzai.includes('準') ? '3回戦の動画を見たお笑いファンに「青田買い」された。' : '1回戦の受付で2,000円を払い、胸に番号シールを貼った。'}`,
    })
  }

  const tv = so || power >= 75 || manzai.includes('決勝') || conte.includes('決勝')
  const buzz = s.fans >= 40 && rng.chance(0.5)
  months.push({
    label: '11月',
    text: tv
      ? pin
        ? 'テレビの深夜番組に初出演。ギャラは全部自分のもの。……少なすぎて、割る気にもならない額だった。'
        : 'テレビの深夜番組に初出演。ギャラは2人で割って、事務所の取り分を引いた。'
      : buzz
        ? 'ライブの切り抜き動画が少しだけバズった。出待ちのファンが2人できた。'
        : '劇場の出番は月1回、60秒。ギャラは1回数百円で、交通費の方が高い。',
  })

  months.push({
    label: '1月',
    text:
      (tsubomi ? '入れ替え戦を勝ち抜いて、坂上劇場の「つぼみ組」に入った。' : 'のぼりざかライブで、また入れ替え戦の一歩手前で負けた。') +
      (affinity(s, 'mido') >= 35 ? '同じ入れ替え戦に、御堂のコンビもいた。' : affinity(s, 'makabe') >= 35 ? '真壁のコンビが先につぼみ組に上がった。報告のLINEは「上がった」の4文字だった。' : ''),
  })
  if (s.kodawari) {
    const kept = (s.counters.kodawari_keep ?? 0) >= (s.counters.kodawari_bend ?? 0)
    const p = s.partner?.name
    months.push({
      label: '2月',
      text: {
        jisaku: kept ? 'ネタ帳は、この1年で3冊増えた。全部、自分の字だ。' : '人にもらったネタで、劇場の出番を1回増やした。ウケた。少しだけ、悔しかった。',
        aikata: p ? (kept ? `${p}とは、まだ同じファミレスの同じ席でネタを合わせている。` : `${p}とは、劇場の楽屋でしか話さなくなった。ネタ合わせは、LINEの通話になった。`) : '「相方と2人で」と言った面談を、ときどき思い出す。今は、ひとりで舞台に立っている。',
        kyaku: kept ? '劇場の出待ちが、2人になった。2人とも、名前を覚えてくれていた。' : '審査員ウケのネタで、予選をひとつ上がった。客席の後ろの方は、静かだった。',
        nokoru: kept ? '同期は、また何人か辞めた。それでも、まだ残っている。' : 'バイトのシフトが週5になった。舞台の日より、厨房の日の方が多い。',
      }[s.kodawari],
    })
  }
  months.push({
    label: '3月',
    text:
      s.money < 30000
        ? '次の期が卒業して、初めて後輩ができた。奢る側に回った。財布が空になった。'
        : '次の期が卒業して、初めて後輩ができた。「ごちそうさまです」と言われる側になった。',
  })

  const route = so
    ? '総代ルート'
    : manzai === '決勝進出' || conte === '決勝進出'
      ? '大当たりルート'
      : tv
        ? 'テレビルート'
        : patron
          ? '秘蔵っ子ルート'
          : buzz
            ? 'SNSルート'
            : tsubomi
              ? '地道ルート（つぼみ組入り）'
              : '地道ルート'

  const gradText = s.gradRank ? (s.gradRank === 1 ? '優勝（卒業総代）' : `${s.gradRank}位`) : '-'
  const review = buildReview(s, rank)
  const shareText = [
    `【ワラガク！卒業】${s.player.name}${s.comboName ? `（${s.comboName}）` : ''}`,
    `称号：${review.title}`,
    `総合${rank}｜${review.gradeLine}`,
    ...(review.kodawari ? [`譲れないもの：${review.kodawari}`] : []),
    `卒業式の隣：${review.neighbor}｜同期300人→${s.classmates}人`,
    `講師の寸評「${review.oneLine}」`,
    `芸人1年目：${route}`,
    '#ワラガク',
  ].join('\n')

  return { rank, total, gradText, route, months, shareText, review }
}

export function hasKiwami(s: GameState): boolean {
  return has(s, 'bakushou') || has(s, 'kumi')
}

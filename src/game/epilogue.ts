import { SKILL_BY_ID } from './data/skills'
import { rivalOf } from './rivalEvents'
import { has } from './core'
import { buildReview, type Review } from './review'
import { Rng } from './rng'
import { STAT_KEYS, STAT_LABEL, type GameState } from './types'

export interface ResultSummary {
  rank: string
  total: number
  gradText: string
  route: string
  months: { label: string; text: string }[]
  shareText: string
  review: Review
}

// 遊び方で評価が分かれるように置く（scripts/balance.ts の q で分位を見る）。
// なんとなく遊ぶとE〜G、ふつうに遊ぶとD〜E、半分くらい考えて遊ぶとB〜C、考えて遊ぶとA〜B、見せ場もよく決めるとA。Sはその中の一握り
export const RANKS: [number, string][] = [
  [700, 'S'],
  [650, 'A'],
  [595, 'B'],
  [545, 'C'],
  [495, 'D'],
  [450, 'E'],
  [405, 'F'],
  [0, 'G'],
]

export const statPoint = (v: number) => (v <= 60 ? v : 60 + (v - 60) * 0.5)

// 総合評価の内訳。通信簿に出す
export function scoreParts(s: GameState): { label: string; value: number }[] {
  // 能力は60を超えると、点の伸びが半分になる（上手な人どうしの差を詰め、少し考えるだけでAに届かないように）
  const stats = STAT_KEYS.reduce((sum, k) => sum + statPoint(s.stats[k]), 0)
  const skills = s.skills.reduce((sum, id) => {
    const k = SKILL_BY_ID[id]?.kind
    return sum + (k === 'kiwami' ? 40 : k === 'gift' ? 15 : k === 'buki' ? 12 : -8)
  }, 0)
  const grad = s.gradRank === 1 ? 40 : s.gradRank && s.gradRank <= 8 ? 20 : s.gradRank && s.gradRank <= 20 ? 8 : 0
  return [
    { label: '能力', value: Math.round(stats) },
    { label: '特殊能力', value: skills },
    { label: '卒業大会', value: grad },
    { label: 'ファン', value: Math.round(s.fans / 3) },
    { label: '業界の評価', value: Math.round(s.staffEval / 4) },
  ]
}

export function totalScore(s: GameState): number {
  return scoreParts(s).reduce((sum, p) => sum + p.value, 0)
}

// 次の評価まであと何点か、と、点を取りやすかったところ（結果画面で次の1周の目標にする）
export function nextGoal(s: GameState, total: number): { rank: string; need: number; tips: string[] } | null {
  const i = RANKS.findIndex(([min]) => total >= min)
  if (i <= 0) return null
  const [min, rank] = RANKS[i - 1]
  const tips: string[] = []
  const low = STAT_KEYS.reduce((a, b) => (s.stats[b] < s.stats[a] ? b : a))
  if (s.stats[low] < 60) tips.push(`いちばん低い${STAT_LABEL[low]}を伸ばす（60までは、上げた分がそのまま点になる）`)
  if (!(s.gradRank && s.gradRank <= 8)) tips.push('卒業大会で決勝に残る（＋20点）')
  else if (s.gradRank !== 1) tips.push('卒業大会で優勝する（決勝進出より＋20点）')
  if (!s.skills.some((id) => SKILL_BY_ID[id]?.kind === 'kiwami')) tips.push('極みに到達する（＋40点）')
  if (s.skills.some((id) => SKILL_BY_ID[id]?.kind === 'kuse')) tips.push('クセを消す（1つにつき＋8点）')
  return { rank, need: min - total, tips: tips.slice(0, 2) }
}

export function rankOf(total: number): string {
  return RANKS.find(([min]) => total >= min)?.[1] ?? 'G'
}

// 卒業後1年目のダイジェスト。根拠は research/03（劇場・賞レース・収入）と 05（人脈）
export function buildEpilogue(s: GameState): ResultSummary {
  const rng = new Rng(s.rng ^ 0x5eed)
  const total = totalScore(s)
  const rank = rankOf(total)
  // 卒業後の1年の強さは、能力の伸びを詰める前の点で決める（評価の区切りを変えても、その後の話が変わらないように）
  const raw = total + STAT_KEYS.reduce((sum, k) => sum + s.stats[k] - statPoint(s.stats[k]), 0)
  const power = raw / 5 + rng.int(-8, 8) // おおむね 30〜100
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

  // 賞レース。芸歴1年目なので、どんなに良くても準々決勝まで（決勝は何年も先の話）
  const contest = (bonus: number) => {
    const v = power + bonus + rng.int(-15, 15)
    if (v >= 98) return '準々決勝敗退'
    if (v >= 82) return '3回戦敗退'
    if (v >= 64) return '2回戦敗退'
    return '1回戦敗退'
  }
  const conte = contest(s.player.style === 'conte' ? 5 : -8)
  const manzai = contest(s.player.style === 'manzai' ? 5 : -8)
  if (pin) {
    months.push({ label: '7月', text: 'コント頂も漫才天下一も、ひとりでは出られない。同期の予選を、客席から観た。' })
    months.push({ label: '11月', text: `ひとり芸王座：${conte}。${conte === '1回戦敗退' ? '受付で「お一人ですか」と聞かれた。' : '袖で、ひとりで小さくガッツポーズをした。'}` })
  } else {
    // 1年目も、やりたいネタの大会に出る
    if (s.player.style === 'conte') months.push({ label: '7月', text: `コント頂：${conte}。${conte === '1回戦敗退' ? '結果ページに名前はなかった。' : ''}` })
    else
      months.push({
        label: '9月',
        text: `漫才天下一：${manzai}。${manzai.includes('3回戦') || manzai.includes('準') ? '3回戦の動画を見たお笑いファンに「青田買い」された。' : '1回戦の受付で2,000円を払い、胸に番号シールを貼った。'}`,
      })
  }

  const tv = so || power >= 88
  const buzz = s.fans >= 40 && rng.chance(0.5)
  months.push({
    label: '11月',
    text: tv
      ? pin
        ? '深夜番組の「若手ネタ見せ」コーナーに、1回だけ呼ばれた。放送は30秒に切られていた。ギャラは、交通費とあまり変わらなかった。'
        : '深夜番組の「若手ネタ見せ」コーナーに、1回だけ呼ばれた。放送は30秒に切られていた。ギャラは2人で割って、事務所の取り分を引いた。'
      : buzz
        ? 'ライブの切り抜き動画が少しだけバズった。出待ちのファンが2人できた。'
        : '劇場の出番は月1回、60秒。ギャラは1回数百円で、交通費の方が高い。',
  })

  months.push({
    label: '1月',
    text:
      (tsubomi ? '入れ替え戦を勝ち抜いて、坂上劇場の「つぼみ組」に入った。' : 'のぼりざかライブで、また入れ替え戦の一歩手前で負けた。') +
      (rivalOf(s) === 'mido' ? '同じ入れ替え戦に、御堂のコンビもいた。' : '真壁のコンビが先につぼみ組に上がった。報告のLINEは「上がった」の4文字だった。'),
  })
  if (s.kodawari) {
    const kept = (s.counters.kodawari_keep ?? 0) >= (s.counters.kodawari_bend ?? 0)
    months.push({
      label: '2月',
      text: {
        sainou: kept ? 'ネタ帳は、この1年で3冊増えた。全部、自分の字だ。' : '人にもらったネタで、劇場の出番を1回増やした。ウケた。少しだけ、悔しかった。',
        kane: kept ? 'バイトは週3のまま。舞台のギャラは、まだ交通費で消える。それでも、正社員の話は断った。' : 'バイトのシフトが週5になった。舞台の日より、厨房の日の方が多い。',
        kyaku: kept ? '劇場の出待ちが、2人になった。2人とも、名前を覚えてくれていた。' : '審査員ウケのネタで、予選をひとつ上がった。客席の後ろの方は、静かだった。',
        nantonaku: kept ? '同期は、また何人か辞めた。理由は今も「なんとなく」のまま。それでも、まだ残っている。' : '辞めた同期の送別会で、自分も辞めると言いかけた。言わなかったが、言いかけたことは覚えている。',
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
    `同期300人→${s.classmates}人`,
    `講師の寸評「${review.oneLine}」`,
    `芸人1年目：${route}`,
    '#ワラガク',
  ].join('\n')

  return { rank, total, gradText, route, months, shareText, review }
}

export function hasKiwami(s: GameState): boolean {
  return s.skills.some((id) => SKILL_BY_ID[id]?.kind === 'kiwami')
}

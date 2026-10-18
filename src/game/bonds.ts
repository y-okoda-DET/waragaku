import { turnOf } from './data/calendar'
import { SKILL_BY_ID } from './data/skills'
import { addSkill, clamp, gain, has, story } from './core'
import type { StoryDef } from './events'
import type { Rng } from './rng'
import type { GameState } from './types'

// 友好度と発展イベント（パワプロの「イベントキャラ」にあたる）
// ・友好度は画面に出さない。相方は bond、先輩は like、それ以外は ties に持つ
// ・友好度が上がると、その人の発展イベントが順に起きる。最後の選択肢で、その人の特殊能力を受け継げることがある
// ・中身は research/02〜06 の体験談とあるあるから作っている

export type BondGroup = 'douki' | 'senior' | 'teacher' | 'rival' | 'town'

export interface BondChar {
  id: string
  name: string
  group: BondGroup
  skill: string // 受け継げる特殊能力
}

export const BOND_CHARS: BondChar[] = [
  { id: 'mukai', name: '向井', group: 'douki', skill: 'hitorashi' },
  { id: 'dojima', name: '堂島', group: 'douki', skill: 'netacho_oni' },
  { id: 'kishibe', name: '岸辺', group: 'douki', skill: 'gekidan' },
  { id: 'hayase', name: '早瀬', group: 'douki', skill: 'awasema' },
  { id: 'haibara', name: '灰原', group: 'senior', skill: 'yomi' },
  { id: 'ookouchi', name: '大河内', group: 'senior', skill: 'mitomesase' },
  { id: 'nakaji', name: 'ナカジ', group: 'senior', skill: 'chika' },
  { id: 'tsujido', name: '辻堂', group: 'teacher', skill: 'kyuushuu' },
  { id: 'miyake', name: '三宅', group: 'teacher', skill: 'homerare' },
  { id: 'mido', name: '御堂', group: 'rival', skill: 'makezu' },
  { id: 'makabe', name: '真壁', group: 'rival', skill: 'kansatsu' },
  { id: 'tencho', name: '店長', group: 'town', skill: 'makanai' },
  { id: 'shihainin', name: '支配人', group: 'town', skill: 'kaonajimi' },
]

export const BOND_BY_ID: Record<string, BondChar> = Object.fromEntries(BOND_CHARS.map((c) => [c.id, c]))

const START: Record<BondGroup, number> = { douki: 10, senior: 10, teacher: 10, rival: 5, town: 10 }

// 何段目の発展イベントが、友好度いくつ・いつから起きるか
const STEP_NEED = [15, 35, 55]
const STEP_FROM = [turnOf(5, 1), turnOf(7, 1), turnOf(10, 1)]
const GAP = 3 // 同じ人のイベントは3週あける

export function isPartner(s: GameState, id: string): boolean {
  return !!s.partner && s.partner.name === BOND_BY_ID[id]?.name
}

export function affinity(s: GameState, id: string): number {
  const c = BOND_BY_ID[id]
  if (!c) return 0
  if (isPartner(s, id)) return s.partner!.bond
  if (c.group === 'senior') return s.seniors.find((x) => x.id === id)?.like ?? 0
  return s.ties?.[id] ?? START[c.group]
}

// 友好度を動かす。人たらしは、同期と先輩との仲が深まりやすい
export function tie(s: GameState, id: string, n: number): void {
  const c = BOND_BY_ID[id]
  if (!c) return
  const amount = n > 0 && has(s, 'hitorashi') && (c.group === 'douki' || c.group === 'senior' || c.group === 'rival') ? Math.round(n * 1.5) : n
  if (isPartner(s, id)) {
    s.partner!.bond = clamp(s.partner!.bond + amount)
    return
  }
  if (c.group === 'senior') {
    const sr = s.seniors.find((x) => x.id === id)
    if (sr) sr.like = clamp(sr.like + amount)
    return
  }
  s.ties ??= {}
  s.ties[id] = clamp((s.ties[id] ?? START[c.group]) + amount)
}

// 同期（相方以外の相方候補とライバル）
export function classmatesOf(s: GameState): string[] {
  return BOND_CHARS.filter((c) => (c.group === 'douki' || c.group === 'rival') && !isPartner(s, c.id)).map((c) => c.id)
}

// 先輩の特殊能力は、仲（like）と認め（respect）が両方とも基準を超えていないともらえない。足りなければ、次の飲みでもう一度その話になる
export const GIFT_LIKE = 55
export const GIFT_RESPECT = 35
const GIFT_MISS: Record<string, { like: string; respect: string }> = {
  haibara: { like: '灰原は戻ってくるなりノートを閉じて、「……今のは見んかったことにして」と言った。まだ、そこまでの仲ではないらしい。', respect: '灰原はノートを取り返して、「まだ早いわ。ネタ見せで一回ウケてから、もう一回見せたる」と笑った。' },
  ookouchi: { like: '大河内は「……ええネタや。けど、まだお前のこと、よう知らん」と言って、ジョッキを空けた。', respect: '大河内はネタを最後まで見て、「……まだや。舞台でウケたとこ見せてから、もう一回持ってこい」と言った。' },
  nakaji: { like: 'ナカジは「……気持ちだけ、もらっとくね」と笑った。まだ、全部を任せるほどの仲ではないらしい。', respect: 'ナカジは「ありがとう。でも先に、事務所のライブでウケてるとこ見せて。そしたら照明も任せる」と言った。' },
}

function inherit(s: GameState, id: string): void {
  const c = BOND_BY_ID[id]
  if (has(s, c.skill)) return
  const sr = c.group === 'senior' ? s.seniors.find((x) => x.id === id) : undefined
  if (sr && (sr.like < GIFT_LIKE || sr.respect < GIFT_RESPECT)) {
    s.weekLog.push(GIFT_MISS[id][sr.respect < GIFT_RESPECT ? 'respect' : 'like'])
    s.counters[`dev_${id}`] = Math.max(0, (s.counters[`dev_${id}`] ?? 1) - 1)
    return
  }
  addSkill(s, c.skill, `◆特殊能力「${SKILL_BY_ID[c.skill].name}」を${c.name}から受け継いだ。`)
  s.gifts ??= {}
  s.gifts[c.skill] = c.name
}

const stepOf = (s: GameState, id: string) => s.counters[`dev_${id}`] ?? 0

// その週に起きる発展イベントを1つ選ぶ。起きたら true
export function scheduleBondEvent(s: GameState, rng: Rng): boolean {
  const ready = BOND_CHARS.filter((c) => {
    const step = stepOf(s, c.id)
    const chain = CHAINS[c.id]
    if (step >= chain.length) return false
    if (c.group === 'douki' && s.turn < 2) return false // 相方見つけ会のあとから
    if (c.group === 'senior') return false // 先輩の話は、飲みに行ったときに進む（seniorDrama）
    if (s.turn < STEP_FROM[step]) return false
    if (s.turn - (s.counters[`devAt_${c.id}`] ?? -99) < GAP) return false
    return affinity(s, c.id) >= STEP_NEED[step]
  })
  if (!ready.length) return false
  // 友好度が高い人ほど選ばれやすい
  const weights = ready.map((c) => affinity(s, c.id))
  let r = rng.next() * weights.reduce((a, b) => a + b, 0)
  let pick = ready[0]
  for (let i = 0; i < ready.length; i++) {
    r -= weights[i]
    if (r <= 0) {
      pick = ready[i]
      break
    }
  }
  const step = stepOf(s, pick.id)
  s.counters[`dev_${pick.id}`] = step + 1
  s.counters[`devAt_${pick.id}`] = s.turn
  story(s, `dev_${pick.id}_${step}`)
  return true
}

// 先輩と飲みに行ったとき、その先輩の話が1つ進む。仲が足りなければ、ただの飲みで終わる
const SENIOR_NEED = [15, 30, 45]
export function seniorDrama(s: GameState, id: string): boolean {
  const chain = CHAINS[id]
  const step = stepOf(s, id)
  if (!chain || step >= chain.length || affinity(s, id) < SENIOR_NEED[step]) return false
  s.counters[`dev_${id}`] = step + 1
  s.counters[`devAt_${id}`] = s.turn
  story(s, `dev_${id}_${step}`)
  return true
}

// ---- 発展イベントの中身 ----
// セリフは台本の形で書く：名前（表情）「…」／ナレーション：…
// 表情は ふつう・笑い・爆笑・驚き・落ち込み・怒り・考え中・照れ

interface DevChoice {
  label: string
  reply?: string | string[]
  hint?: string
  apply: (s: GameState, rng: Rng) => void
}

interface DevEvent {
  title: string
  place: string
  lines: (s: GameState, me: string, partner: boolean) => string[]
  choices: DevChoice[]
}

const CHAINS: Record<string, DevEvent[]> = {
  // 向井：人懐っこい関西弁。入学式の夜の飲み会で向かいに座っていた【research/02 入学直後の飲み会】
  mukai: [
    {
      title: '向井の誘い',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：授業が終わると、向井が教室の出口で待っていた。',
        '向井（笑い）「なあ、今日飲み行かへん？ 同期10人くらい集めてんねん」',
        'ナレーション：入学して1か月。向井はもう、同期の半分と連絡先を交換している。',
        `${me}（驚き）「10人？ いつの間に」`,
        '向井（笑い）「“おはようございます”のついでに聞いたら、だいたい教えてくれんで。講師にも聞いたけど、教えてくれへんかった」',
      ],
      choices: [
        {
          reply: '向井（爆笑）「よっしゃ、11人目！」', label: '行く',
          hint: '同期の結束＋・3,000円',
          apply: (s) => {
            tie(s, 'mukai', 8)
            s.money -= 3000
            s.dokiBond = clamp(s.dokiBond + 6)
          },
        },
        { reply: '向井（笑い）「ほな、書けたら聞かせてや。飲みながら」', label: '今日はネタを書く', hint: '発想力＋', apply: (s) => (tie(s, 'mukai', 3), gain(s, 'idea', 2)) },
        { reply: '向井（笑い）「任しとき。三宅さんならいけそうや」', label: '「講師の番号、次は聞き出してきて」', hint: '度胸＋', apply: (s) => (tie(s, 'mukai', 6), gain(s, 'guts', 2)) },
      ],
    },
    {
      title: '向井の名簿',
      place: 'izakaya',
      lines: (s, me) => [
        'ナレーション：安いチェーンの居酒屋。向井がスマホのメモを見せてくれた。',
        `ナレーション：同期の名前、出身、ボケかツッコミか。何人かの名前には線が引いてある。同期は${s.classmates}人になった。`,
        '向井（ふつう）「線のとこは、辞めた人。せめて名前くらいは覚えときたいねん」',
        `${me}（考え中）「……自分の名前、どこにある？」`,
        '向井（笑い）「ここ。線はまだ引いてへん。鉛筆で、うっすら書いてるけど」',
        `${me}（怒り）「消しとけ！」`,
      ],
      choices: [
        { reply: '向井（照れ）「……ありがとう。1人で覚えるの、ちょっとしんどかってん」', label: '一緒に名前を覚える', hint: '対応力＋', apply: (s) => (tie(s, 'mukai', 10), gain(s, 'adlib', 2)) },
        { reply: '向井（爆笑）「やめろ！ 俺はまだおるやろ！」', label: '向井の名前に鉛筆で線を引く', hint: '度胸＋', apply: (s) => (tie(s, 'mukai', 8), gain(s, 'guts', 2)) },
      ],
    },
    {
      title: '打ち上げの席',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：先輩の単独ライブの打ち上げ。同期で呼ばれたのは向井だけ。……のはずが、向井に連れてこられた。',
        `${me}（落ち込み）「呼ばれてへんのに来てもうた」`,
        '向井（笑い）「ええねん。“あのボケ、どこから思いついたんですか”って聞いたら、先輩みんな1時間しゃべるから」',
        'ナレーション：本当に1時間しゃべった。大河内は2時間しゃべった。',
        '向井（照れ）「な？ 仲良くなるんやなくて、ネタの話を聞きに行くねん。そしたら、勝手に仲良くなってる」',
      ],
      choices: [
        { reply: 'ナレーション：先輩は1時間半しゃべった。最後に「お前、ええ聞き方するな」と言われた。', label: '隣の先輩に、ボケの出どころを聞く', apply: (s) => (tie(s, 'mukai', 8), inherit(s, 'mukai')) },
        { reply: '大河内（笑い）「最後まで聞いたやつ、お前が初めてや。……3時間目もあんねんけどな」', label: '大河内の2時間目を、最後まで聞く', hint: '発想力＋・体調−', apply: (s) => (tie(s, 'mukai', 4), gain(s, 'idea', 4), (s.condition = clamp(s.condition - 8))) },
      ],
    },
  ],

  // 堂島：ぼそぼそした関西弁。授業で一番スベっていた。ネタ帳は分厚い【research/02「一番スベってた子」と組んだ話】
  dojima: [
    {
      title: '一番スベってた人',
      place: 'rouka',
      lines: () => [
        'ナレーション：ネタ見せの授業。堂島のコンビは、最初から最後まで一度も笑いが起きなかった。',
        '辻堂（ふつう）「おもんない。次」',
        'ナレーション：授業のあと、廊下の隅で堂島がノートに何か書いている。',
        '堂島（考え中）「……スベったとこ、全部メモしてんねん。どこで客の顔が止まったか」',
        '堂島（ふつう）「今日は、最初の“どうもー”で止まってた」',
      ],
      choices: [
        { reply: '堂島（照れ）「……ええよ。字、汚いけど」', label: '「見せてもらっていい？」', hint: '発想力＋', apply: (s) => (tie(s, 'dojima', 8), gain(s, 'idea', 2)) },
        { reply: '堂島（笑い）「……それ、ネタ帳に書いとくわ」', label: '「“どうもー”で止まるのは才能や」', hint: '対応力＋', apply: (s) => (tie(s, 'dojima', 6), gain(s, 'adlib', 2)) },
        { reply: 'ナレーション：翌日、堂島のノートは1ページ増えていた。', label: 'そっとしておく', apply: (s) => tie(s, 'dojima', 3) },
      ],
    },
    {
      title: 'ネタ帳17冊',
      place: 'heya',
      lines: (_s, me) => [
        'ナレーション：堂島の部屋。本棚の一段が、全部同じ大学ノートで埋まっている。',
        '堂島（照れ）「17冊。高校のときから書いてる」',
        `${me}（驚き）「17冊！ ウケたのは？」`,
        '堂島（落ち込み）「3個」',
        '堂島（ふつう）「1個は、ノートを電車に忘れたときの話や。ネタ帳に書いたネタやなくて、ネタ帳を失くした話がウケた」',
      ],
      choices: [
        { reply: '堂島（照れ）「1冊目、中学生の字やから、笑わんといて。……笑ってもええけど」', label: '1冊目から読ませてもらう', hint: '発想力＋', apply: (s) => (tie(s, 'dojima', 10), gain(s, 'idea', 3)) },
        { reply: '堂島（驚き）「……お前のも、スベったとこにしか線引いてへんやん」', label: '自分のネタ帳も見せる', hint: 'ワード力＋', apply: (s) => (tie(s, 'dojima', 8), gain(s, 'word', 3)) },
        { reply: '堂島（爆笑）「それ、1個ウケるやつやん」', label: '「18冊目、電車に置いてこい」', hint: '対応力＋', apply: (s) => (tie(s, 'dojima', 6), gain(s, 'adlib', 2)) },
      ],
    },
    {
      title: 'スベりの記録',
      place: 'famires',
      lines: (_s, me, partner) => [
        'ナレーション：深夜のファミレス。ドリンクバーで5時間。堂島が18冊目を開いた。',
        partner ? '堂島（笑い）「最近、このコンビでスベった理由も書いてる。だいぶ溜まったで。お前の分が多い」' : '堂島（笑い）「最近、自分以外のスベりも書いてる。ネタ見せは、スベりの宝庫やから」',
        `${me}（怒り）「人のスベりまで書くな」`,
        '堂島（ふつう）「ウケた理由は誰も分からん。スベった理由は、だいたい分かる。そこを全部つぶしたら、残ったところが笑いになる……はずや。まだ3個しか残ってへんけど」',
      ],
      choices: [
        { reply: '堂島（笑い）「……2人で書いたら、倍スベれるな」', label: '今日のスベりを、隣で一緒に書く', apply: (s) => (tie(s, 'dojima', 8), inherit(s, 'dojima')) },
        {
          reply: '堂島（照れ）「……ええの？ 俺のボケ、まだ3個しかウケてへんで」', label: '「堂島のボケで一本作らせて」',
          hint: 'ネタの完成度＋',
          apply: (s) => {
            tie(s, 'dojima', 5)
            s.neta.polish = clamp(s.neta.polish + 15)
          },
        },
      ],
    },
  ],

  // 岸辺：標準語で、少し芝居がかる。元劇団員。プライドが高い
  kishibe: [
    {
      title: '後ろの壁まで',
      place: 'kyoushitsu',
      lines: () => [
        'ナレーション：発声の授業。岸辺の声だけが、教室の後ろの壁まで届いている。',
        '三宅（爆笑）「ええやん岸辺！ 今日一番！」',
        '岸辺（ふつう）「……劇団に8年いましたので。これくらいは普通です」',
        'ナレーション：褒められても、岸辺はにこりともしない。ただ、耳だけ赤い。',
      ],
      choices: [
        { reply: '岸辺（照れ）「……いいけど。厳しいよ」', label: '「発声、教えてください」', hint: '表現力＋', apply: (s) => (tie(s, 'kishibe', 8), gain(s, 'expr', 2)) },
        { reply: '岸辺（怒り）「赤くない。照明」', label: '「耳、赤いで」', hint: '対応力＋', apply: (s) => (tie(s, 'kishibe', 6), gain(s, 'adlib', 2)) },
        {
          reply: '岸辺（考え中）「……知ってる。だから、ここに来たの」', label: '「声だけじゃ笑いは取れへんで」',
          hint: '度胸＋',
          apply: (s) => {
            tie(s, 'kishibe', 3)
            gain(s, 'guts', 2)
          },
        },
      ],
    },
    {
      title: '劇団を辞めた理由',
      place: 'famires',
      lines: (_s, me) => [
        'ナレーション：ファミレス。岸辺がドリンクバーのアイスティーを3杯目に取りに行った。',
        '岸辺（考え中）「お芝居の途中で、客席が笑った日があったの。泣かせる場面だったのに」',
        '岸辺（照れ）「主演の人のカツラが、ずれてたの。……その日から、泣かせるより笑わせる方がしたくなった」',
        '岸辺（落ち込み）「でもここに来てから、わたし、まだ1回もウケてない」',
        `${me}（笑い）「カツラ、かぶってみる？」`,
      ],
      choices: [
        { reply: '岸辺（笑い）「……ここ、笑うとこだったんだ。お芝居では泣くとこなのに」', label: '一緒に笑いどころを探す', hint: '表現力＋', apply: (s) => (tie(s, 'kishibe', 10), gain(s, 'expr', 3)) },
        { reply: '岸辺（照れ）「……武器。うん。使ってみる」', label: '「芝居がうまいのは武器やで」と励ます', hint: 'やる気＋', apply: (s) => (tie(s, 'kishibe', 8), (s.motivation = clamp(s.motivation + 8))) },
      ],
    },
    {
      title: '一番後ろの席',
      place: 'butai',
      lines: (_s, me) => [
        'ナレーション：ライブの後、誰もいない客席。岸辺が一番後ろの列に座った。',
        '岸辺（ふつう）「ここ、来て。舞台から一番遠い席」',
        '岸辺（笑い）「劇団でね、ここに座ってる人のことを“神様”って呼んでたの。チケットが一番安いのに」',
        '岸辺（考え中）「前の3列だけ笑ってても、神様が置いていかれたら、それはウケてない」',
        `${me}（驚き）「……一番後ろの人の顔なんか、見たことなかった」`,
      ],
      choices: [
        {
          reply: '岸辺（ふつう）「いいよ。まず、自分の台詞以外から読むの」', label: '「台本の読み方を教えて」',
          hint: '表現力＋・ワード力＋',
          apply: (s) => (tie(s, 'kishibe', 5), gain(s, 'expr', 4), gain(s, 'word', 2)),
        },
        { reply: '岸辺（笑い）「……届いた。神様、笑ってる」', label: '舞台に上がって、神様の席に向かって一言しゃべってみる', apply: (s) => (tie(s, 'kishibe', 8), inherit(s, 'kishibe')) },
      ],
    },
  ],

  // 早瀬：早口で、読点が少ない。同じ風呂なしアパートの隣の部屋【research/02 家が近いから組んだ】
  hayase: [
    {
      title: '最寄り駅',
      place: 'ekimae',
      lines: (_s, me) => [
        'ナレーション：終電。同じ駅で降りたのは、早瀬だった。',
        '早瀬（驚き）「え、ここ？ 家どこ？」',
        `${me}（ふつう）「駅から5分の、風呂なしのアパート」`,
        '早瀬（爆笑）「それ俺の隣の部屋や夜中に壁の向こうでネタ言うてんのお前かずっと気になっててんあれもうちょいテンポ上げた方がええで」',
      ],
      choices: [
        { reply: '早瀬（笑い）「30分な絶対30分なほな俺の部屋で」', label: '「今から30分だけやる？」', hint: '対応力＋・体調−', apply: (s) => (tie(s, 'hayase', 8), gain(s, 'adlib', 2), (s.condition = clamp(s.condition - 5))) },
        { reply: '早瀬（爆笑）「ダメ出しちゃうアドバイスやほんでもうちょいテンポ上げた方がええ」', label: '「勝手にダメ出しすな」', hint: 'ワード力＋', apply: (s) => (tie(s, 'hayase', 6), gain(s, 'word', 2)) },
        { reply: '早瀬（笑い）「また明日なて隣やけどな」', label: '「また明日な」', apply: (s) => tie(s, 'hayase', 3) },
      ],
    },
    {
      title: '深夜のコンビニ前',
      place: 'ekimae',
      lines: (_s, me) => [
        'ナレーション：夜中の2時。壁がトントンと鳴った。早瀬だ。コンビニの前で待ち合わせた。',
        '早瀬（笑い）「俺の早口な生まれつきちゃうで毎晩ニュース原稿を3本声に出して読んでんねん噛んだら最初からそれを毎日」',
        `${me}（驚き）「3か月？」`,
        '早瀬（ふつう）「3か月。その前は普通にしゃべるのも遅かってんで。……ほんまに」',
        `${me}（考え中）「今の“ほんまに”だけ、ゆっくりやったな」`,
      ],
      choices: [
        { reply: '早瀬（笑い）「お前、噛んだら最初からやで」', label: '一緒に原稿を読む', hint: 'ワード力＋・体調−', apply: (s) => (tie(s, 'hayase', 10), gain(s, 'word', 3), (s.condition = clamp(s.condition - 5))) },
        { reply: '早瀬（ふつう）「おうおやすみ。壁、叩いたら起きてな」', label: 'コーヒーだけもらって帰る', hint: '体調＋', apply: (s) => (tie(s, 'hayase', 4), (s.condition = clamp(s.condition + 5))) },
      ],
    },
    {
      title: '毎日30分',
      place: 'kouen',
      lines: (_s, me, partner) => [
        'ナレーション：夜の公園。人の気配がしたら「ちょっと止めよか」。',
        partner ? '早瀬（ふつう）「今日でネタ合わせ100日連続や」' : '早瀬（ふつう）「相方とネタ合わせ100日連続やねん今日は相方が風邪やから付き合って」',
        `${me}（驚き）「100日？」`,
        '早瀬（笑い）「長くやらんでええねん毎日30分。そのかわり101日目に休んだら、全部チャラな気がして怖い」',
        `${me}（笑い）「それ、呪いやろ」`,
      ],
      choices: [
        { reply: '早瀬（照れ）「……ほんまに？ ……ほんまに、な」', label: '「ほな、101日目も付き合うわ」', apply: (s) => (tie(s, 'hayase', 8), inherit(s, 'hayase')) },
        { reply: '早瀬（笑い）「コツなんかないで毎日読むだけやほら今のもう5回分くらいしゃべった」', label: '「早口のコツだけ教えて」', hint: 'ワード力＋＋', apply: (s) => (tie(s, 'hayase', 5), gain(s, 'word', 5)) },
      ],
    },
  ],

  // 灰原：関西弁。1期上の助手先輩。入学式で「両隣いなくなる」と言った人【research/02 助手先輩】
  haibara: [
    {
      title: '1杯だけ',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：灰原と、駅前の安い居酒屋。灰原はウーロンハイを1杯だけ頼んで、ずっとそれを持っている。',
        '灰原（ふつう）「助手の仕事な、ネタ見せの朝6時に列を整理すんねん。割り込みは、上から全部見えてる」',
        '灰原（笑い）「私も去年は並ぶ側やった。始発で来て、階段の下で台本読んでた。……あそこ、日当たりええねん。寝てまうで」',
        `${me}（ふつう）「灰原さんも、並んでたんですね」`,
      ],
      choices: [
        { reply: '灰原（笑い）「始発な。……寝てたら起こしたるわ」', label: '「来週、始発で並びます」', hint: '体力＋', apply: (s) => (tie(s, 'haibara', 8), gain(s, 'stamina', 2)) },
        { reply: '灰原（ふつう）「ええ心がけや。……私の分まで飲まんでええで」', label: 'ウーロンハイを2杯目まで付き合う', hint: '体調−', apply: (s) => (tie(s, 'haibara', 5), (s.condition = clamp(s.condition - 5))) },
        { reply: '灰原（怒り）「それ聞いてどないすんねん。……チクるのは、私の仕事や」', label: '「割り込んでる人、誰ですか」', apply: (s) => tie(s, 'haibara', 1) },
      ],
    },
    {
      title: '両隣の話',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：2回目は、灰原から誘ってきた。ウーロンハイは、やっぱり1杯だけ。',
        '灰原（ふつう）「入学式の“両隣いなくなる”。あれ、私が入学したときに言われたことを、そのまま言うてん」',
        '灰原（落ち込み）「私の両隣も、ほんまにおらんくなった。1人は夏に辞めて、もう1人は私の元相方」',
        `${me}（考え中）「灰原さんは、何で残れたんですか」`,
        '灰原（笑い）「真ん中の席やったからちゃう？ 両隣おらんくなったら、真ん中だけ残るやろ」',
      ],
      choices: [
        { reply: '灰原（笑い）「……聞いてくれる子、珍しいわ。ほとんど途中で自分の話し始めるで」', label: '黙って最後まで聞く', hint: 'やる気＋', apply: (s) => (tie(s, 'haibara', 10), (s.motivation = clamp(s.motivation + 6))) },
        { reply: '灰原（笑い）「生意気。……取ったら、隣に座ったるわ」', label: '「来年、真ん中の席取ります」', hint: '度胸＋', apply: (s) => (tie(s, 'haibara', 6), gain(s, 'guts', 3)) },
      ],
    },
    {
      title: '助手のノート',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：3回目の飲み。灰原が、カバンから助手用のノートを出してテーブルに置いた。',
        '灰原（ふつう）「助手やってたら、辻堂さんが誰を上げて誰を落とすか、だいたい見えてくる」',
        '灰原（考え中）「ネタの出来より、“前回言われたことを、次に直してきたか”を見てる。同じダメ出しを2回されたら、もう名前覚えてもらわれへん」',
        `${me}（驚き）「それ、言っていいんですか」`,
        '灰原（笑い）「あかんよ。せやから、このノートは今からトイレに行ってる間、たまたまここに置き忘れる」',
      ],
      choices: [
        { reply: 'ナレーション：「前回のダメ出しを直してきた組」の欄に、自分たちの名前はまだなかった。', label: '置き忘れたノートを、そっと開く', apply: (s) => (tie(s, 'haibara', 8), inherit(s, 'haibara')) },
        { reply: '灰原（驚き）「……真面目か。……ほな、口で言うわ」', label: '「職員室に届けときます」', hint: '発想力＋・度胸＋', apply: (s) => (tie(s, 'haibara', 5), gain(s, 'idea', 3), gain(s, 'guts', 2)) },
      ],
    },
  ],

  // 大河内：関西弁。芸歴18年のお目付け役【research/05 好感度より「面白い」が一番、お礼3回】
  ookouchi: [
    {
      title: '声が小さい',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：大河内に連れられて、劇場裏の居酒屋。のれんをくぐると、奥の座敷に先輩芸人が何人もいた。',
        `${me}（ふつう）「おはようございます」`,
        '大河内（怒り）「声が小さい。夜でも“おはようございます”は、相手に届かな意味ないぞ」',
        'ナレーション：座敷の隅で寝ていた先輩が、その声で起きた。',
      ],
      choices: [
        { reply: '大河内（笑い）「それや。夜でも朝が来たように言え」', label: 'もう一度、腹から言い直す', hint: '表現力＋', apply: (s) => (tie(s, 'ookouchi', 8), gain(s, 'expr', 2)) },
        { reply: 'ナレーション：起きた先輩は「……おはようございます」と返して、また寝た。大河内が少し笑った。', label: '起きた先輩にも「おはようございます」', hint: '対応力＋', apply: (s) => (tie(s, 'ookouchi', 6), gain(s, 'adlib', 2)) },
        { reply: '大河内（ふつう）「謝らんでええ。次、声出せ」', label: '「すみません」と頭を下げる', apply: (s) => tie(s, 'ookouchi', 4) },
      ],
    },
    {
      title: '18年目のジョッキ',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：2回目の飲み。大河内はジョッキを置いたまま、明日の60秒の出番のネタを、口の中で繰り返している。',
        '大河内（ふつう）「売れてへんのに、なんで辞めへんのか。よう聞かれる」',
        `${me}（考え中）「……なんでですか」`,
        '大河内（笑い）「辞めるときの挨拶が、まだおもろく書けてへんねん。18年考えてるけど」',
      ],
      choices: [
        { reply: '大河内（照れ）「……ほな、もうちょっと書くの遅らせるわ」', label: '「その挨拶、聞く日は来ないでほしいです」', hint: 'やる気＋', apply: (s) => (tie(s, 'ookouchi', 10), (s.motivation = clamp(s.motivation + 8))) },
        { reply: '大河内（笑い）「アホか。……まあ、1行目くらいは聞いたるわ」', label: '「一緒に考えましょか」', hint: 'ワード力＋', apply: (s) => (tie(s, 'ookouchi', 6), gain(s, 'word', 2)) },
      ],
    },
    {
      title: '飲みより、ネタ持ってこい',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：3回目の飲み。大河内の行きつけの店。会計はもちろん大河内。',
        '大河内（ふつう）「飲みに付き合うやつは、なんぼでもおる。ありがたいけどな」',
        '大河内（怒り）「でもライブに呼ぶのは、ネタ持ってくるやつだけや。仲ええだけのやつは呼ばれへん」',
        '大河内（笑い）「次、新ネタできたら見せに来い。飲みより、そっちの方が嬉しい。……飲みも、まあ、嬉しいけど」',
        `${me}（笑い）「どっちですか」`,
      ],
      choices: [
        { reply: '大河内（笑い）「……ほんまに持ってきたんか。座れ、見たる」', label: 'カバンから新ネタの台本を出す', apply: (s) => (tie(s, 'ookouchi', 6), inherit(s, 'ookouchi')) },
        {
          reply: '大河内（爆笑）「ネタ持ってきたらな！」', label: '「また飲みにも連れてってください」',
          hint: '仲の良さ＋＋',
          apply: (s) => {
            tie(s, 'ookouchi', 12)
            s.money += 2500
          },
        },
      ],
    },
  ],

  // ナカジ：標準語。バイト先の先輩芸人、東京の自主ライブの顔【research/06 ギャラ167円・自主ライブ／05 直営業の危うさ】
  nakaji: [
    {
      title: 'ギャラ167円',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：バイト終わりに、ナカジと店の裏の安い居酒屋。ナカジが、紙を1枚ひらひらさせている。',
        'ナカジ（爆笑）「見て、ギャラの明細。167円」',
        `${me}（驚き）「167円！」`,
        'ナカジ（笑い）「劇場までの電車賃が片道220円。出るたびに赤字。これ額に入れて飾ってるの、俺だけだと思う」',
      ],
      choices: [
        { reply: 'ナカジ（爆笑）「でしょ？ 笑ってくれたから167円の元は取れた」', label: '一緒に笑う', hint: 'やる気＋', apply: (s) => (tie(s, 'nakaji', 8), (s.motivation = clamp(s.motivation + 4))) },
        { reply: 'ナカジ（驚き）「……額縁、980円だった。なんで気づかなかったんだろう」', label: '「額縁の方が高くないですか」', hint: '対応力＋', apply: (s) => (tie(s, 'nakaji', 7), gain(s, 'adlib', 2)) },
        { reply: 'ナカジ（笑い）「出ないと、167円ももらえないからね」', label: '「それでも出るんですね」', hint: '発想力＋', apply: (s) => (tie(s, 'nakaji', 5), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: '自主ライブの裏側',
      place: 'izakaya',
      lines: () => [
        'ナレーション：2回目の飲み。ナカジが主催している自主ライブの話になった。受付も照明もMCも、ナカジ一人でやっているらしい。',
        'ナカジ（笑い）「客席10人。そのうち4人は出演者の身内。でもね、毎回来てくれる人が2人いる」',
        'ナカジ（ふつう）「その2人の名前、俺まだ知らないんだよね。もう2年なのに。今さら聞けない」',
      ],
      choices: [
        {
          reply: 'ナレーション：翌週、受付で名前を聞いた。2人は「佐藤です」「佐藤です」と答えた。姉妹だった。ナカジは泣きそうな顔で笑った。', label: '「次のライブ、受付やります。名前、聞いときます」',
          hint: 'ファン＋・体調−',
          apply: (s) => {
            tie(s, 'nakaji', 10)
            s.fans += 3
            s.condition = clamp(s.condition - 5)
          },
        },
        { reply: 'ナカジ（笑い）「一番前で笑ってくれる人がいると、ほかのお客さんも笑っていいんだって分かるんだよ」', label: '「次は客席の一番前で笑います」', hint: '対応力＋', apply: (s) => (tie(s, 'nakaji', 6), gain(s, 'adlib', 2)) },
      ],
    },
    {
      title: 'ナカジの忠告',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：3回目の飲み。2軒目に入ったところで、ナカジがまじめな顔になった。',
        'ナカジ（ふつう）「この界隈にいたら、そのうち“事務所に内緒の営業”の話が来る。ギャラ3万、とかね」',
        'ナカジ（怒り）「それだけは、俺の紹介でも受けちゃだめ。消えていった先輩、何人も見てる」',
        'ナカジ（笑い）「167円の方が、まだ長生きできるよ」',
        `${me}（ふつう）「……はい」`,
      ],
      choices: [
        { reply: 'ナカジ（照れ）「……照明もやってくれる？ 俺、毎回自分のネタの時だけ真っ暗なんだ」', label: '「次の自主ライブ、受付から全部やらせてください」', apply: (s) => (tie(s, 'nakaji', 6), inherit(s, 'nakaji'), (s.risk = Math.max(0, s.risk - 10))) },
        {
          reply: 'ナカジ（笑い）「うん。それが一番いい」', label: '「事務所のライブで勝ちます」',
          hint: '社員の評価＋',
          apply: (s) => {
            tie(s, 'nakaji', 4)
            s.staffEval = clamp(s.staffEval + 8)
            s.risk = Math.max(0, s.risk - 10)
          },
        },
      ],
    },
  ],

  // 辻堂：講師。短い関西弁。「おもんない」しか言わない【research/02 ネタ見せのダメ出し】
  tsujido: [
    {
      title: '「おもんない」の意味',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：ネタ見せが終わった。辻堂は台本から目を上げずに言った。',
        '辻堂（ふつう）「おもんない。次」',
        'ナレーション：どこがおもんないのかは、言わなかった。',
        `${me}（落ち込み）「……」`,
      ],
      choices: [
        { reply: '辻堂（ふつう）「……来たんか。ほな、1個だけ言うたる」', label: '授業のあと、質問しに行く', hint: '度胸＋', apply: (s) => (tie(s, 'tsujido', 8), gain(s, 'guts', 2)) },
        { reply: '辻堂（怒り）「全部や。次」', label: '「どこがですか」とその場で聞く', hint: '度胸＋＋・講師の評価−', apply: (s) => (tie(s, 'tsujido', 6), gain(s, 'guts', 4), (s.teacherEval = clamp(s.teacherEval - 3))) },
        { reply: 'ナレーション：翌月のネタ見せ。辻堂は「おもんない」と言う前に、2秒だけ間を空けた。', label: '次のネタ見せで見返す', hint: '発想力＋', apply: (s) => (tie(s, 'tsujido', 5), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: '辻堂の理由',
      place: 'rouka',
      lines: (_s, me) => [
        'ナレーション：廊下で辻堂とすれ違った。珍しく、向こうから声をかけてきた。',
        '辻堂（ふつう）「なんで“おもんない”しか言わんか、分かるか」',
        `${me}（考え中）「……語彙が少ないから、ですか」`,
        '辻堂（怒り）「……」',
        '辻堂（笑い）「半分正解や。あと半分は、自分で見つけたことしか、舞台で使われへんからや」',
      ],
      choices: [
        { reply: '辻堂（ふつう）「礼はええ。直してこい」', label: '「ありがとうございます！」', hint: 'やる気＋', apply: (s) => (tie(s, 'tsujido', 10), (s.motivation = clamp(s.motivation + 8))) },
        { reply: '辻堂（笑い）「……そういうとこや。おもんないけどな」', label: '「半分も正解でしたか」', hint: '度胸＋', apply: (s) => (tie(s, 'tsujido', 8), gain(s, 'guts', 2)) },
      ],
    },
    {
      title: '赤ペン',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：授業のあと。辻堂が、提出した台本を返してきた。',
        'ナレーション：ページの余白が、赤ペンで真っ赤になっている。',
        '辻堂（ふつう）「おもんないとこ、全部書いた。全部直せとは言わん。どれ直すかは自分で決めろ」',
        `${me}（驚き）「……しゃべるより書く方が多いんですね」`,
        '辻堂（ふつう）「しゃべったら、お前ら泣くやろ」',
      ],
      choices: [
        { reply: '辻堂（ふつう）「……全部答えてきたん、お前だけや」', label: '赤を一つずつ読んで、次の台本に全部答える', apply: (s) => (tie(s, 'tsujido', 6), inherit(s, 'tsujido')) },
        {
          reply: '辻堂（ふつう）「それでええ。どれ選ぶかで、芸風が決まる」', label: '一番大きい赤だけ直す',
          hint: 'ネタの完成度＋＋',
          apply: (s) => {
            tie(s, 'tsujido', 4)
            s.neta.polish = clamp(s.neta.polish + 20)
          },
        },
      ],
    },
  ],

  // 三宅：関西弁で豪快。2人目の講師、元芸人で褒めて伸ばす【research/02 辞めていく人の多さ／06「Cクラスからも売れる」】
  miyake: [
    {
      title: '今日一番',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：三宅の授業は、まず大きな笑い声から始まる。',
        '三宅（爆笑）「今のツッコミ、ええやん！ 今日一番！」',
        'ナレーション：今日一番は、今日だけで4組目だった。',
        `${me}（照れ）「ありがとうございます」`,
      ],
      choices: [
        { reply: '三宅（爆笑）「ええ顔！ その顔、舞台でもしい！」', label: '素直に喜ぶ', hint: 'やる気＋', apply: (s) => (tie(s, 'miyake', 8), (s.motivation = clamp(s.motivation + 6))) },
        { reply: '三宅（爆笑）「4番目や！ でも一番や！」', label: '「何番目の一番ですか」', hint: '対応力＋', apply: (s) => (tie(s, 'miyake', 7), gain(s, 'adlib', 2)) },
        { reply: '三宅（考え中）「……ツッコミの前に、ちょっとだけ息吸うたやろ。あれや」', label: '「どこが良かったですか」と聞く', hint: '表現力＋', apply: (s) => (tie(s, 'miyake', 6), gain(s, 'expr', 2)) },
      ],
    },
    {
      title: '名札',
      place: 'rouka',
      lines: (s, me) => [
        `ナレーション：同期は${s.classmates}人。掲示板の前で、三宅が辞めた人の名札をそっと外していた。`,
        '三宅（落ち込み）「おもろいのに辞めていった子、いっぱい見てきた。辞めんかったら、いつか当たるのに」',
        `${me}（考え中）「……」`,
        '三宅（笑い）「せやから褒めんねん。褒めとったら、辞めにくいやろ。……ちょっとずるいけどな」',
      ],
      choices: [
        { reply: '三宅（落ち込み）「……ありがとう。この仕事、毎年ちょっとずつ重なるねん」', label: '名札を外すのを手伝う', hint: '同期の結束＋', apply: (s) => (tie(s, 'miyake', 10), (s.dokiBond = clamp(s.dokiBond + 5))) },
        { reply: '三宅（爆笑）「画びょう2個！ 外すとき苦労するやつや！ ええやん！」', label: '自分の名札を、画びょうで2か所留め直す', hint: '度胸＋', apply: (s) => (tie(s, 'miyake', 8), gain(s, 'guts', 3)) },
      ],
    },
    {
      title: '梅組の星',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：誰もいない教室。三宅が、昔の自分の写真を見せてくれた。',
        '三宅（笑い）「私な、在学中ずっと一番下のクラスやってん。選抜なんか一回も入ってへん」',
        '三宅（爆笑）「でも同期で一番長く舞台に立ってたのは私や。Cクラスからでも売れる」',
        `${me}（笑い）「先生、それ毎年言うてるでしょ」`,
        '三宅（照れ）「バレた？」',
      ],
      choices: [
        { reply: '三宅（爆笑）「似てる！ 30年前の私や！」', label: '写真の三宅と同じポーズをする', apply: (s) => (tie(s, 'miyake', 6), inherit(s, 'miyake')) },
        { reply: '三宅（照れ）「ええけど、加工して。目、大きして」', label: '「写真、撮っていいですか」', hint: 'やる気＋＋', apply: (s) => (tie(s, 'miyake', 8), (s.motivation = clamp(s.motivation + 15))) },
      ],
    },
  ],

  // 御堂：標準語の自信家。学生お笑い出身で、用語が多い【research/04「仕上がってる扱い」】
  mido: [
    {
      title: '仕上がってる新人',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：ネタ見せで、御堂のコンビだけが最初から最後までウケていた。大学お笑いで4年やってきたらしい。',
        '辻堂（ふつう）「仕上がってるね。次」',
        '御堂（笑い）「フリ、ボケ、天丼、裏切り。全部入れたら、そりゃウケるでしょ。養成所って、事務所に入るための手続きだよね」',
        `${me}（怒り）「……」`,
      ],
      choices: [
        { reply: '御堂（笑い）「いいね。1年後、覚えてたら言ってよ」', label: '「1年後、同じこと言えるか見とくわ」', hint: '度胸＋', apply: (s) => (tie(s, 'mido', 8), gain(s, 'guts', 2)) },
        { reply: '御堂（驚き）「……え、本気で？ ……今の、ちょっと面白かった」', label: '「“天丼”って何？ 食べるやつ？」', hint: '対応力＋', apply: (s) => (tie(s, 'mido', 6), gain(s, 'adlib', 2)) },
        { reply: '御堂（ふつう）「……聞こえてるでしょ。顔に出てる」', label: '聞こえないふりをする', hint: '発想力＋', apply: (s) => (tie(s, 'mido', 3), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: '隣の番号シール',
      place: 'livehouse',
      lines: (_s, me) => [
        'ナレーション：漫才の大会の1回戦。受付で2,000円を払い、胸に番号シールを貼る。',
        'ナレーション：隣の番号を貼っていたのは、御堂だった。',
        '御堂（ふつう）「……君らも出てたんだ」',
        '御堂（考え中）「学生の大会では決勝の常連だった。ここだと、ただの番号。……シール、曲がってない？」',
        `${me}（驚き）「御堂でも緊張すんの」`,
      ],
      choices: [
        { reply: '御堂（照れ）「……ありがとう。番号シールでコケたら笑えないからね」', label: 'シールをまっすぐ貼り直してやる', hint: '対応力＋', apply: (s) => (tie(s, 'mido', 10), gain(s, 'adlib', 2)) },
        { reply: '御堂（笑い）「いいよ。そういうの、嫌いじゃない」', label: '「お前にだけは負けへん」', hint: '度胸＋', apply: (s) => (tie(s, 'mido', 8), gain(s, 'guts', 3)) },
      ],
    },
    {
      title: '伸びしろ',
      place: 'rouka',
      lines: (_s, me) => [
        'ナレーション：クラス分けの掲示。御堂の名前は、選抜になかった。',
        '御堂（落ち込み）「“仕上がってる”って、伸びしろがないって意味だったんだね」',
        '御堂（怒り）「学生のときの鉄板が、ここでは全部まばら。……君らは毎回ちょっとずつ変えてくるでしょ。あれ、腹立つ」',
        `${me}（考え中）「……それ、褒めてる？」`,
        '御堂（笑い）「次は絶対負けない。それだけ言いに来た。……あと、天丼は食べ物じゃない」',
      ],
      choices: [
        { reply: '御堂（笑い）「……離して。手汗、すごいから」', label: '「こっちこそ」と握手して、手を離さない', apply: (s) => (tie(s, 'mido', 8), inherit(s, 'mido')) },
        { reply: '御堂（照れ）「……見せる。学生のときのやつ、全部」', label: '御堂のネタを見せてもらう', hint: 'ワード力＋・発想力＋', apply: (s) => (tie(s, 'mido', 6), gain(s, 'word', 3), gain(s, 'idea', 2)) },
      ],
    },
  ],

  // 真壁：単語でしかしゃべらない。キャップで目が見えない
  makabe: [
    {
      title: '一言もしゃべらない人',
      place: 'kyoushitsu',
      lines: () => [
        'ナレーション：真壁のコンビのコント。真壁はセリフが一つもない役だった。',
        'ナレーション：なのに、教室で一番大きい笑いは、真壁が黙って振り向いたところで起きた。',
        '三宅（爆笑）「真壁、何もしてへんのに！」',
        '真壁（ふつう）「……してる」',
      ],
      choices: [
        { reply: '真壁（考え中）「……振り向く前に、一回、見ない」', label: '「今の、どうやったん？」と聞きに行く', hint: '表現力＋', apply: (s) => (tie(s, 'makabe', 8), gain(s, 'expr', 2)) },
        { reply: '真壁（笑い）「……遅い。でも、いい」', label: '黙って振り向いてみせる', hint: '表現力＋・対応力＋', apply: (s) => (tie(s, 'makabe', 7), gain(s, 'expr', 1), gain(s, 'adlib', 1)) },
        { reply: '真壁（ふつう）「……見えてる」', label: '遠くから真似してみる', hint: '発想力＋', apply: (s) => (tie(s, 'makabe', 4), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: 'ファミレスの観察',
      place: 'famires',
      lines: (_s, me) => [
        'ナレーション：深夜のファミレス。奥の席に、真壁が一人でいた。メモ帳に何か書いている。',
        `${me}（ふつう）「何書いてんの」`,
        '真壁（ふつう）「あの人。ドリンクバー3回。3回とも同じの混ぜてる」',
        '真壁（笑い）「配合、探してる」',
        `${me}（笑い）「……4回目、行った」`,
      ],
      choices: [
        { reply: '真壁（笑い）「……5回目。メロンソーダ、入った」', label: '隣に座って一緒に観察する', hint: '発想力＋', apply: (s) => (tie(s, 'makabe', 10), gain(s, 'idea', 3)) },
        { reply: '真壁（照れ）「……もう、なってる」', label: '「それ、コントになるやん」', hint: 'ネタの完成度＋', apply: (s) => (tie(s, 'makabe', 6), (s.neta.polish = clamp(s.neta.polish + 6))) },
      ],
    },
    {
      title: '真壁のメモ帳',
      place: 'kouen',
      lines: (_s, me) => [
        'ナレーション：公園のベンチ。真壁がキャップのつばを少しだけ上げた。目までは、見えなかった。',
        '真壁（照れ）「しゃべるの、苦手。見るのは、得意」',
        '真壁（ふつう）「おもろい人。本人だけ、気づいてない」',
        '真壁（笑い）「たとえば、今の、あなた」',
        `${me}（驚き）「どこが？」`,
        '真壁（笑い）「それ。メモした」',
      ],
      choices: [
        { reply: '真壁（笑い）「……今の人、2回、振り返った。メモ」', label: '真壁と並んで、通る人を黙って見る', apply: (s) => (tie(s, 'makabe', 8), inherit(s, 'makabe')) },
        { reply: 'ナレーション：1ページ目には、自分の名前と「振り向くの、遅い」と書いてあった。', label: 'メモ帳を1ページだけ見せてもらう', hint: '発想力＋＋', apply: (s) => (tie(s, 'makabe', 6), gain(s, 'idea', 5)) },
      ],
    },
  ],

  // 店長：関西弁の人情家。バイト先の居酒屋の店長【research/06 芸人のバイトあるある】
  tencho: [
    {
      title: 'シフトの融通',
      place: 'baito',
      lines: (_s, me) => [
        'ナレーション：居酒屋の厨房。店長がシフト表を見ながら言った。',
        '店長（笑い）「ライブの日は先に言うてや。全部空けとくから」',
        '店長（ふつう）「その代わり、売れたらうちの店の名前、テレビで言うてな。店の名前、まだ覚えてへんやろ」',
        `${me}（驚き）「……覚えてます」`,
        '店長（笑い）「ほな言うてみ」',
      ],
      choices: [
        { reply: '店長（爆笑）「よっしゃ！ ほな店の名前、言うてみ！」', label: '「言います！」と約束する', hint: 'やる気＋', apply: (s) => (tie(s, 'tencho', 10), (s.motivation = clamp(s.motivation + 5))) },
        { reply: '店長（爆笑）「確認すな！」', label: '看板を見に、店の外に出る', hint: '対応力＋', apply: (s) => (tie(s, 'tencho', 8), gain(s, 'adlib', 2)) },
        { reply: '店長（笑い）「……ええわ。皿、ピカピカやしな」', label: '黙って皿を洗う', hint: '体力＋', apply: (s) => (tie(s, 'tencho', 5), gain(s, 'stamina', 2)) },
      ],
    },
    {
      title: '店長の十八番',
      place: 'baito',
      lines: (_s, me) => [
        'ナレーション：閉店後。店長がまかないを2人分作ってくれた。',
        '店長（照れ）「わしもな、若いころ、ちょっとだけ漫才やっててん。3か月で辞めたけど」',
        '店長（笑い）「腹減ってたら、ネタなんか書かれへんねん。食え食え。……おかわりは1回までな」',
        `${me}（笑い）「いただきます！」`,
      ],
      choices: [
        { reply: '店長（笑い）「皿まで舐めたらあかんで。……でも、ええ食べっぷりや」', label: 'おかわりを1回して、皿まできれいにする', apply: (s) => (tie(s, 'tencho', 6), inherit(s, 'tencho')) },
        { reply: '店長（照れ）「アホか。……3分だけやぞ」', label: '「店長のネタ、見せてください」', hint: 'ワード力＋・発想力＋', apply: (s) => (tie(s, 'tencho', 8), gain(s, 'word', 2), gain(s, 'idea', 2)) },
      ],
    },
  ],

  // 支配人：丁寧語。小さな劇場の支配人、眠そうな目【research/03 劇場オーディション・出番の少なさ】
  shihainin: [
    {
      title: 'また来ましたね',
      place: 'butai',
      lines: (_s, me) => [
        'ナレーション：劇場の受付。眠そうな目の支配人が、チケットをもぎりながら言った。',
        '支配人（ふつう）「また来ましたね。今月4回目です」',
        `${me}（驚き）「覚えてるんですか」`,
        '支配人（笑い）「覚えていますよ。毎回、同じところで一番大きく笑う方なので。……少し、うるさいです」',
      ],
      choices: [
        { reply: '支配人（笑い）「お待ちしています。……少しだけ、小さめに笑ってください」', label: '「来月も来ます」', hint: '発想力＋', apply: (s) => (tie(s, 'shihainin', 10), gain(s, 'idea', 2)) },
        { reply: '支配人（爆笑）「……それは、少し寂しいです」', label: '「来月は、小さく笑います」', hint: '対応力＋', apply: (s) => (tie(s, 'shihainin', 8), gain(s, 'adlib', 2)) },
        { reply: '支配人（ふつう）「そこは、一番よく見える席です。舞台も、お客様も」', label: '一番後ろの席で観る', hint: '表現力＋', apply: (s) => (tie(s, 'shihainin', 5), gain(s, 'expr', 2)) },
      ],
    },
    {
      title: '60秒',
      place: 'butai',
      lines: (_s, me) => [
        'ナレーション：閉館後。支配人が、ストップウォッチを見せてくれた。',
        '支配人（ふつう）「若手の出番は、月に1回、60秒です。60秒で、お客様に名前を覚えていただく」',
        '支配人（考え中）「私は30年、この劇場で60秒を数えてきました。……時々、寝てしまいますが」',
        `${me}（笑い）「寝たらあかんでしょ」`,
        '支配人（笑い）「起こしてくれた芸人さんのことは、忘れません」',
      ],
      choices: [
        { reply: '支配人（笑い）「楽しみにしています。……寝ないように、努力します」', label: '「60秒で起こしてみせます」', apply: (s) => (tie(s, 'shihainin', 6), inherit(s, 'shihainin')) },
        { reply: '支配人（ふつう）「どうぞ。……58秒でした。あと2秒、伸ばせます」', label: '「60秒のネタ、見てもらえますか」', hint: 'ネタの完成度＋', apply: (s) => (tie(s, 'shihainin', 8), (s.neta.polish = clamp(s.neta.polish + 12))) },
      ],
    },
  ],
}

export const DEV_STORIES: Record<string, StoryDef> = Object.fromEntries(
  Object.entries(CHAINS).flatMap(([id, chain]) =>
    chain.map((ev, i): [string, StoryDef] => [
      `dev_${id}_${i}`,
      {
        view: (s) => ({
          title: ev.title,
          place: ev.place,
          lines: ev.lines(s, s.player.callName, isPartner(s, id)),
          choices: ev.choices.map((c) => ({ label: c.label, hint: c.hint, reply: c.reply })),
        }),
        resolve: (s, c, rng) => ev.choices[c]?.apply(s, rng),
      },
    ]),
  ),
)

export const DEV_COUNT = Object.values(CHAINS).reduce((n, c) => n + c.length, 0)

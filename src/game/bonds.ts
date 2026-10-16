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

function inherit(s: GameState, id: string): void {
  const c = BOND_BY_ID[id]
  if (has(s, c.skill)) return
  addSkill(s, c.skill, `特殊能力「${SKILL_BY_ID[c.skill].name}」を${c.name}から受け継いだ。`)
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
    if (c.group === 'douki' && !s.partner) return false // 相方見つけ会のあとから
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

// ---- 発展イベントの中身 ----
// セリフは台本の形で書く：名前（表情）「…」／ナレーション：…
// 表情は ふつう・笑い・爆笑・驚き・落ち込み・怒り・考え中・照れ

interface DevChoice {
  label: string
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
  // 向井：人懐っこい。入学式の夜の飲み会で向かいに座っていた【research/02 入学直後の飲み会】
  mukai: [
    {
      title: '向井の誘い',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：授業が終わると、向井が教室の出口で待っていた。',
        '向井（笑い）「なあ、今日飲み行かへん？ 同期10人くらい集めてんねん」',
        'ナレーション：入学して1か月。向井はもう、同期の半分と連絡先を交換している。',
        `${me}（驚き）「10人？ いつの間に」`,
        '向井（笑い）「“おはようございます”のついでに聞いたら、だいたい教えてくれんで」',
      ],
      choices: [
        {
          label: '行く',
          hint: '同期の結束＋・3,000円',
          apply: (s) => {
            tie(s, 'mukai', 8)
            s.money -= 3000
            s.dokiBond = clamp(s.dokiBond + 6)
          },
        },
        { label: '今日はネタを書く', hint: '発想力＋', apply: (s) => (tie(s, 'mukai', 3), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: '向井の名簿',
      place: 'izakaya',
      lines: (s, me) => [
        'ナレーション：安いチェーンの居酒屋。向井がスマホのメモを見せてくれた。',
        `ナレーション：同期の名前、出身、ボケかツッコミか。何人かの名前には線が引いてある。同期は${s.classmates}人になった。`,
        '向井（ふつう）「線のとこは、辞めた人。入学式で灰原さんが“両隣いなくなる”って言うてたやろ」',
        '向井（落ち込み）「ほんまにおらんくなるから。せめて名前くらいは覚えときたいねん」',
        `${me}（考え中）「……」`,
      ],
      choices: [
        { label: '一緒に名前を覚える', hint: '対応力＋', apply: (s) => (tie(s, 'mukai', 10), gain(s, 'adlib', 2)) },
        {
          label: '「辞めた人のことは考えん方がええで」',
          hint: '度胸＋',
          apply: (s) => (tie(s, 'mukai', 2), gain(s, 'guts', 2), (s.edge += 2)),
        },
      ],
    },
    {
      title: '人たらしの極意',
      place: 'rouka',
      lines: (_s, me) => [
        'ナレーション：向井が、先輩の単独ライブの打ち上げに呼ばれたらしい。同期で呼ばれたのは向井だけだ。',
        `${me}（考え中）「なんで向井ばっかり先輩に気に入られんの」`,
        '向井（笑い）「先輩には、ネタの質問だけしたらええねん。おべっかはすぐバレる」',
        '向井（ふつう）「“あの日のあのボケ、どこから思いついたんですか”って聞いたら、みんな1時間しゃべるで」',
        '向井（笑い）「面白いって思われるんが一番。仲ええだけのやつは、ライブには呼ばれへんから」',
      ],
      choices: [
        { label: '「そのやり方、教えてくれ」', apply: (s) => (tie(s, 'mukai', 8), inherit(s, 'mukai')) },
        {
          label: '「自分のやり方でいく」',
          hint: '度胸＋・発想力＋',
          apply: (s) => (tie(s, 'mukai', 4), gain(s, 'guts', 3), gain(s, 'idea', 3)),
        },
      ],
    },
  ],

  // 堂島：授業で一番スベっていた。ネタ帳は分厚い【research/02「一番スベってた子」と組んだ話】
  dojima: [
    {
      title: '一番スベってた人',
      place: 'rouka',
      lines: () => [
        'ナレーション：ネタ見せの授業。堂島のコンビは、最初から最後まで一度も笑いが起きなかった。',
        '辻堂（ふつう）「おもんない。次」',
        'ナレーション：授業のあと、廊下の隅で堂島がノートに何か書いている。',
        '堂島（考え中）「……スベったとこ、全部メモしてんねん。どこで客の顔が止まったか」',
      ],
      choices: [
        { label: '「見せてもらっていい？」', hint: '発想力＋', apply: (s) => (tie(s, 'dojima', 8), gain(s, 'idea', 2)) },
        { label: 'そっとしておく', apply: (s) => tie(s, 'dojima', 3) },
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
        '堂島（ふつう）「でも、スベった理由を書いとくと、それがそのまま次のネタの種になるんよ」',
      ],
      choices: [
        { label: '1冊目から読ませてもらう', hint: '発想力＋', apply: (s) => (tie(s, 'dojima', 10), gain(s, 'idea', 3)) },
        { label: '自分のネタ帳も見せる', hint: 'ワード力＋', apply: (s) => (tie(s, 'dojima', 8), gain(s, 'word', 3)) },
      ],
    },
    {
      title: 'スベりの記録',
      place: 'famires',
      lines: (_s, me, partner) => [
        'ナレーション：深夜のファミレス。ドリンクバーで5時間。堂島が18冊目を開いた。',
        partner ? '堂島（笑い）「最近、このコンビでスベった理由も書いてる。だいぶ溜まったで」' : '堂島（笑い）「最近、自分以外のスベりも書いてる。ネタ見せは、スベりの宝庫やから」',
        `${me}（笑い）「人のスベりまで書いてんの」`,
        '堂島（ふつう）「ウケた理由は誰も分からん。でも、スベった理由はだいたい分かる。そこを全部つぶしたら、残ったところが笑いになる」',
      ],
      choices: [
        { label: '「その書き方、教えて」', apply: (s) => (tie(s, 'dojima', 8), inherit(s, 'dojima')) },
        {
          label: '「堂島のボケで一本作らせて」',
          hint: 'ネタの完成度＋',
          apply: (s) => {
            tie(s, 'dojima', 5)
            s.neta.polish = clamp(s.neta.polish + 15)
          },
        },
      ],
    },
  ],

  // 岸辺：元劇団員。芝居がうまい。少しプライドが高い
  kishibe: [
    {
      title: '後ろの壁まで',
      place: 'kyoushitsu',
      lines: () => [
        'ナレーション：発声の授業。岸辺の声だけが、教室の後ろの壁まで届いている。',
        '三宅（爆笑）「ええやん岸辺！ 今日一番！」',
        '岸辺（ふつう）「……劇団に8年いたので。これくらいは普通です」',
        'ナレーション：褒められても、岸辺はにこりともしない。',
      ],
      choices: [
        { label: '「発声、教えてください」', hint: '表現力＋', apply: (s) => (tie(s, 'kishibe', 8), gain(s, 'expr', 2)) },
        {
          label: '「声だけじゃ笑いは取れへんで」',
          hint: '尖り＋',
          apply: (s) => {
            tie(s, 'kishibe', 4)
            s.edge += 3
          },
        },
      ],
    },
    {
      title: '劇団を辞めた理由',
      place: 'famires',
      lines: (_s, me) => [
        'ナレーション：ファミレス。岸辺がドリンクバーのアイスティーを3杯目に取りに行った。',
        '岸辺（考え中）「芝居の途中で、客席が笑った日があってん。台本では笑うとこちゃうのに」',
        '岸辺（照れ）「その日から、泣かすより笑かす方がしたくなった」',
        '岸辺（落ち込み）「でもここに来てから、私、まだ1回もウケてない。何をやってるんやろって思う」',
        `${me}（ふつう）「……」`,
      ],
      choices: [
        { label: '一緒に笑いどころを探す', hint: '表現力＋', apply: (s) => (tie(s, 'kishibe', 10), gain(s, 'expr', 3)) },
        { label: '「芝居がうまいのは武器やで」と励ます', hint: 'やる気＋', apply: (s) => (tie(s, 'kishibe', 8), (s.motivation = clamp(s.motivation + 8))) },
      ],
    },
    {
      title: '一番後ろの席',
      place: 'butai',
      lines: (_s, me) => [
        'ナレーション：ライブの後、誰もいない客席。岸辺が一番後ろの列に座った。',
        '岸辺（ふつう）「ここ、来て。舞台から一番遠い席」',
        '岸辺（考え中）「劇団で最初に言われたんは、“舞台は後ろの席の人のためにある”ってこと」',
        '岸辺（笑い）「前の3列が笑ってても、後ろが置いていかれたら、それはウケてない」',
        `${me}（驚き）「……後ろの人の顔なんか、見たことなかった」`,
      ],
      choices: [
        {
          label: '「台本の読み方を教えて」',
          hint: '表現力＋・ワード力＋',
          apply: (s) => (tie(s, 'kishibe', 5), gain(s, 'expr', 4), gain(s, 'word', 2)),
        },
        { label: '「後ろの席まで届く声、教えて」', apply: (s) => (tie(s, 'kishibe', 8), inherit(s, 'kishibe')) },
      ],
    },
  ],

  // 早瀬：口が回る。家が近い【research/02 家が近いから組んだ／ネタ合わせのしやすさ】
  hayase: [
    {
      title: '最寄り駅',
      place: 'ekimae',
      lines: (_s, me) => [
        'ナレーション：終電。同じ駅で降りたのは、早瀬だった。',
        '早瀬（驚き）「え、ここ？ 家どこ？」',
        `${me}（ふつう）「駅から歩いて5分」`,
        '早瀬（笑い）「俺3分！ ほぼお隣さんやん。ネタ合わせし放題やな」',
      ],
      choices: [
        { label: '「今から30分だけやる？」', hint: '対応力＋・体調−', apply: (s) => (tie(s, 'hayase', 8), gain(s, 'adlib', 2), (s.condition = clamp(s.condition - 5))) },
        { label: '「また明日な」', apply: (s) => tie(s, 'hayase', 3) },
      ],
    },
    {
      title: '深夜のコンビニ前',
      place: 'ekimae',
      lines: () => [
        'ナレーション：夜中の2時。「起きてる？」と早瀬からLINEが来た。',
        'ナレーション：コンビニの前。早瀬は缶コーヒーを2本持って立っていた。',
        '早瀬（笑い）「俺の早口な、生まれつきちゃうで。毎晩ニュース原稿を3本、声に出して読んでんねん」',
        '早瀬（ふつう）「噛んだら最初から。それを毎日。3か月で口が勝手に回るようになった」',
      ],
      choices: [
        { label: '一緒に原稿を読む', hint: 'ワード力＋・体調−', apply: (s) => (tie(s, 'hayase', 10), gain(s, 'word', 3), (s.condition = clamp(s.condition - 5))) },
        { label: 'コーヒーだけもらって帰る', hint: '体調＋', apply: (s) => (tie(s, 'hayase', 4), (s.condition = clamp(s.condition + 5))) },
      ],
    },
    {
      title: '毎日30分',
      place: 'kouen',
      lines: (_s, me, partner) => [
        'ナレーション：夜の公園。人の気配がしたら「ちょっと止めよか」。',
        partner ? '早瀬（ふつう）「今日で、ネタ合わせ100日連続や」' : '早瀬（ふつう）「相方とな、ネタ合わせ100日連続やねん。今日は相方が風邪やから、付き合って」',
        `${me}（驚き）「100日？」`,
        '早瀬（笑い）「長くやらんでええねん。毎日30分。辞めていったやつらは、たまに5時間やって、そのあと1週間やらへんかった」',
        '早瀬（ふつう）「最後に残るのは、毎日やったやつやと思う」',
      ],
      choices: [
        { label: '「その30分、毎日やる」', apply: (s) => (tie(s, 'hayase', 8), inherit(s, 'hayase')) },
        { label: '「早口のコツだけ教えて」', hint: 'ワード力＋＋', apply: (s) => (tie(s, 'hayase', 5), gain(s, 'word', 5)) },
      ],
    },
  ],

  // 灰原：1期上の助手先輩。入学式で「両隣いなくなる」と言った人【research/02 助手先輩】
  haibara: [
    {
      title: '朝6時の廊下',
      place: 'rouka',
      lines: (_s, me) => [
        'ナレーション：ネタ見せの日の朝6時。階段の下に、もう列ができている。',
        'ナレーション：列を整理しているのは、助手先輩の灰原だった。',
        '灰原（ふつう）「おはようございます。順番は並んだ順。割り込みは見たら全部言うから」',
        '灰原（笑い）「私も去年は並ぶ側やった。始発で来て、ここで台本読んでた」',
        `${me}（ふつう）「おはようございます！」`,
      ],
      choices: [
        { label: '列の整理を手伝う', hint: '体調−', apply: (s) => (tie(s, 'haibara', 8), (s.condition = clamp(s.condition - 5))) },
        { label: '列に並んで台本を読む', hint: 'ワード力＋', apply: (s) => (tie(s, 'haibara', 3), gain(s, 'word', 2)) },
      ],
    },
    {
      title: '両隣の話',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：灰原に誘われて、安い居酒屋。灰原はウーロンハイを1杯だけ頼んだ。',
        '灰原（ふつう）「入学式の“両隣いなくなる”。あれ、私が入学したときに言われたことを、そのまま言うてん」',
        '灰原（落ち込み）「私の両隣も、ほんまにおらんくなった。1人は夏に辞めて、もう1人は私の元相方」',
        `${me}（考え中）「灰原さんは、何で残れたんですか」`,
        '灰原（笑い）「わからん。辞めるタイミングを逃し続けただけかも」',
      ],
      choices: [
        { label: '黙って最後まで聞く', hint: 'やる気＋', apply: (s) => (tie(s, 'haibara', 10), (s.motivation = clamp(s.motivation + 6))) },
        { label: '「絶対、残ります」', hint: '度胸＋', apply: (s) => (tie(s, 'haibara', 6), gain(s, 'guts', 3)) },
      ],
    },
    {
      title: '辻堂さんが見てるとこ',
      place: 'rouka',
      lines: (_s, me) => [
        'ナレーション：授業のあと、灰原が助手用のノートを閉じた。',
        '灰原（ふつう）「助手やってたら、辻堂さんが誰を上げて、誰を落とすか、だいたい見えてくる」',
        '灰原（考え中）「ネタの出来よりな、“前回言われたことを、次に直してきたか”を見てる」',
        '灰原（笑い）「同じダメ出しを2回されたら、もう名前覚えてもらわれへんで」',
        `${me}（驚き）「それ、言っていいんですか」`,
      ],
      choices: [
        { label: '「ノートの付け方、教えてください」', apply: (s) => (tie(s, 'haibara', 8), inherit(s, 'haibara')) },
        { label: '「自分で気づきたいです」', hint: '発想力＋・度胸＋', apply: (s) => (tie(s, 'haibara', 5), gain(s, 'idea', 3), gain(s, 'guts', 2)) },
      ],
    },
  ],

  // 大河内：芸歴18年のお目付け役【research/05 好感度より「面白い」が一番、お礼3回】
  ookouchi: [
    {
      title: '声が小さい',
      place: 'gakuya',
      lines: (_s, me) => [
        'ナレーション：先輩のライブの手伝い。狭い楽屋に入るなり、大河内がこちらを見た。',
        `${me}（ふつう）「おはようございます」`,
        '大河内（怒り）「声が小さい。夜でも“おはようございます”は、相手に届かな意味ないぞ」',
      ],
      choices: [
        { label: 'もう一度、腹から言い直す', hint: '度胸＋', apply: (s) => (tie(s, 'ookouchi', 8), gain(s, 'guts', 2)) },
        { label: '「すみません」と頭を下げる', apply: (s) => tie(s, 'ookouchi', 4) },
      ],
    },
    {
      title: '18年目の楽屋',
      place: 'gakuya',
      lines: (_s, me) => [
        'ナレーション：出番を待つ楽屋。大河内は、若手と同じ60秒の出番のために、ネタを口の中で繰り返している。',
        '大河内（ふつう）「売れてへんのに、なんで辞めへんのか。よう聞かれる」',
        '大河内（笑い）「おもろいもん作るのが、まだおもろいからや。それだけや」',
        `${me}（考え中）「……」`,
      ],
      choices: [
        { label: '「自分も、そうなりたいです」', hint: 'やる気＋', apply: (s) => (tie(s, 'ookouchi', 10), (s.motivation = clamp(s.motivation + 8))) },
        { label: '「売れたいです」', hint: '尖り＋・度胸＋', apply: (s) => (tie(s, 'ookouchi', 6), gain(s, 'guts', 2), (s.edge += 3)) },
      ],
    },
    {
      title: '飲みより、ネタ持ってこい',
      place: 'izakaya',
      lines: (_s, me) => [
        'ナレーション：大河内の行きつけの店。会計はもちろん大河内。',
        '大河内（ふつう）「飲みに付き合うやつは、なんぼでもおる。ありがたいけどな」',
        '大河内（怒り）「でもライブに呼ぶのは、ネタ持ってくるやつだけや。仲ええだけのやつは呼ばれへん」',
        '大河内（笑い）「次、新ネタできたら見せに来い。飲みより、そっちのが嬉しい」',
        `${me}（驚き）「はい！」`,
      ],
      choices: [
        { label: '翌週、新ネタを持っていく', apply: (s) => (tie(s, 'ookouchi', 6), inherit(s, 'ookouchi')) },
        {
          label: '「また飲みにも連れてってください」',
          hint: '仲の良さ＋＋',
          apply: (s) => {
            tie(s, 'ookouchi', 12)
            s.money += 2500
          },
        },
      ],
    },
  ],

  // ナカジ：バイト先の先輩芸人、自主ライブの顔【research/06 ギャラ167円・自主ライブ／05 直営業の危うさ】
  nakaji: [
    {
      title: 'ギャラ167円',
      place: 'baito',
      lines: (_s, me) => [
        'ナレーション：居酒屋の厨房。休憩中のナカジが、紙を1枚ひらひらさせている。',
        'ナカジ（爆笑）「見て、ギャラの明細。167円」',
        `${me}（驚き）「167円！」`,
        'ナカジ（笑い）「劇場までの電車賃が片道220円。出るたびに赤字や」',
      ],
      choices: [
        { label: '一緒に笑う', hint: 'やる気＋', apply: (s) => (tie(s, 'nakaji', 8), (s.motivation = clamp(s.motivation + 4))) },
        { label: '「それでも出るんですね」', hint: '発想力＋', apply: (s) => (tie(s, 'nakaji', 6), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: '自主ライブの裏側',
      place: 'livehouse',
      lines: () => [
        'ナレーション：ナカジが主催する自主ライブ。受付も照明もMCも、ナカジ一人。',
        'ナカジ（笑い）「客席10人。そのうち4人は出演者の身内や。でもな、毎回来てくれる人が2人おる」',
        'ナカジ（ふつう）「事務所のライブで勝たれへんやつは、ここで客を作る。この2人が、いつか20人になる」',
      ],
      choices: [
        {
          label: '受付を手伝う',
          hint: '外の縁＋・体調−',
          apply: (s) => {
            tie(s, 'nakaji', 10)
            s.outsideRep = clamp(s.outsideRep + 5)
            s.condition = clamp(s.condition - 5)
          },
        },
        { label: '客席の一番前で笑う', hint: '対応力＋', apply: (s) => (tie(s, 'nakaji', 6), gain(s, 'adlib', 2)) },
      ],
    },
    {
      title: 'ナカジの忠告',
      place: 'livehouse',
      lines: (_s, me) => [
        'ナレーション：打ち上げのあと、ナカジがまじめな顔になった。',
        'ナカジ（ふつう）「この界隈におったら、そのうち“事務所に内緒の営業”の話が来る。ギャラ3万、とかな」',
        'ナカジ（怒り）「それだけは、俺の紹介でも受けたらあかん。辞めていった先輩、何人も見てる」',
        'ナカジ（笑い）「その代わり、自主ライブの回し方は全部教えたる」',
        `${me}（ふつう）「……はい」`,
      ],
      choices: [
        { label: '「ライブの回し方、教えてください」', apply: (s) => (tie(s, 'nakaji', 6), inherit(s, 'nakaji'), (s.risk = Math.max(0, s.risk - 10))) },
        {
          label: '「事務所のライブで勝ちます」',
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

  // 辻堂：講師。「おもんない」しか言わない【research/02 ネタ見せのダメ出し】
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
        { label: '授業のあと、質問しに行く', hint: '度胸＋', apply: (s) => (tie(s, 'tsujido', 8), gain(s, 'guts', 2)) },
        { label: '次のネタ見せで見返す', hint: '発想力＋', apply: (s) => (tie(s, 'tsujido', 5), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: '辻堂の理由',
      place: 'rouka',
      lines: (_s, me) => [
        'ナレーション：廊下で辻堂とすれ違った。珍しく、向こうから声をかけてきた。',
        '辻堂（ふつう）「なんで“おもんない”しか言わんか、分かるか」',
        `${me}（考え中）「……分かりません」`,
        '辻堂（ふつう）「どこがおもんないか、自分で見つけたやつしか残らんからや。答え教えたら、そいつは来年おらん」',
        '辻堂（笑い）「お前、最近ちょっとだけ見つけてきてるな」',
      ],
      choices: [
        { label: '「ありがとうございます！」', hint: 'やる気＋', apply: (s) => (tie(s, 'tsujido', 10), (s.motivation = clamp(s.motivation + 8))) },
        { label: '「ちょっとだけ、ですか」', hint: '尖り＋・度胸＋', apply: (s) => (tie(s, 'tsujido', 8), gain(s, 'guts', 2), (s.edge += 2)) },
      ],
    },
    {
      title: '赤ペン',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：授業のあと。辻堂が、提出した台本を返してきた。',
        'ナレーション：ページの余白が、赤ペンで真っ赤になっている。',
        '辻堂（ふつう）「おもんないとこ、全部書いた。全部直せとは言わん。どれを直すかは自分で決めろ」',
        `${me}（驚き）「……これ、全部ですか」`,
        '辻堂（笑い）「赤が多いのは、見るとこがあるってことや」',
      ],
      choices: [
        { label: '赤ペンを1つずつ読み込む', apply: (s) => (tie(s, 'tsujido', 6), inherit(s, 'tsujido')) },
        {
          label: '一番大きい赤だけ直す',
          hint: 'ネタの完成度＋＋',
          apply: (s) => {
            tie(s, 'tsujido', 4)
            s.neta.polish = clamp(s.neta.polish + 20)
          },
        },
      ],
    },
  ],

  // 三宅：2人目の講師。元芸人で褒めて伸ばす【research/02 辞めていく人の多さ／06「Cクラスからも売れる」】
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
        { label: '素直に喜ぶ', hint: 'やる気＋', apply: (s) => (tie(s, 'miyake', 8), (s.motivation = clamp(s.motivation + 6))) },
        { label: '「どこが良かったですか」と聞く', hint: '表現力＋', apply: (s) => (tie(s, 'miyake', 6), gain(s, 'expr', 2)) },
      ],
    },
    {
      title: '褒める理由',
      place: 'rouka',
      lines: (s, me) => [
        `ナレーション：同期は${s.classmates}人。掲示板の前で、三宅が辞めた人の名札をそっと外していた。`,
        '三宅（ふつう）「私が褒めるのはな、辞めさせへんためやで」',
        '三宅（落ち込み）「おもろいのに辞めていった子、いっぱい見てきた。辞めんかったら、いつか当たるのに」',
        `${me}（考え中）「……」`,
      ],
      choices: [
        { label: '名札を外すのを手伝う', hint: '同期の結束＋', apply: (s) => (tie(s, 'miyake', 10), (s.dokiBond = clamp(s.dokiBond + 5))) },
        { label: '「名札は、外させません」', hint: '度胸＋', apply: (s) => (tie(s, 'miyake', 8), gain(s, 'guts', 3)) },
      ],
    },
    {
      title: '梅組の星',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：誰もいない教室。三宅が、昔の自分の写真を見せてくれた。',
        '三宅（笑い）「私な、在学中ずっと一番下のクラスやってん。選抜なんか一回も入ってへん」',
        '三宅（爆笑）「でも同期で一番長く舞台に立ってたのは私や。Cクラスからでも売れる。辞めへんかったらな」',
        `${me}（笑い）「先生、それ毎年言うてるでしょ」`,
        '三宅（照れ）「バレた？」',
      ],
      choices: [
        { label: '「その気持ちの保ち方、教えてください」', apply: (s) => (tie(s, 'miyake', 6), inherit(s, 'miyake')) },
        { label: '「写真、撮っていいですか」', hint: 'やる気＋＋', apply: (s) => (tie(s, 'miyake', 8), (s.motivation = clamp(s.motivation + 15))) },
      ],
    },
  ],

  // 御堂：同期のライバル（漫才）。大学お笑い出身の自信家【research/04「仕上がってる扱い」】
  mido: [
    {
      title: '仕上がってる新人',
      place: 'kyoushitsu',
      lines: (_s, me) => [
        'ナレーション：ネタ見せで、御堂のコンビだけが最初から最後までウケていた。大学お笑いで4年やってきたらしい。',
        '辻堂（ふつう）「仕上がってるね。次」',
        '御堂（笑い）「養成所なんか、事務所に入るための手続きやろ」',
        `${me}（怒り）「……」`,
      ],
      choices: [
        { label: '「1年後、同じこと言えるか見とくわ」', hint: '度胸＋・尖り＋', apply: (s) => (tie(s, 'mido', 8), gain(s, 'guts', 2), (s.edge += 2)) },
        { label: '聞こえないふりをする', hint: '発想力＋', apply: (s) => (tie(s, 'mido', 3), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: '隣の番号シール',
      place: 'livehouse',
      lines: (_s, me) => [
        'ナレーション：漫才の大会の1回戦。受付で2,000円を払い、胸に番号シールを貼る。',
        'ナレーション：隣の番号を貼っていたのは、御堂だった。',
        '御堂（ふつう）「……お前らも出てたんや」',
        '御堂（考え中）「学生のときは決勝の常連やった。ここでは、ただの番号や」',
        `${me}（驚き）「御堂でも緊張すんの」`,
      ],
      choices: [
        { label: '「お互い、勝とうや」', hint: '対応力＋', apply: (s) => (tie(s, 'mido', 10), gain(s, 'adlib', 2)) },
        { label: '「お前にだけは負けへん」', hint: '度胸＋', apply: (s) => (tie(s, 'mido', 8), gain(s, 'guts', 3)) },
      ],
    },
    {
      title: '伸びしろ',
      place: 'rouka',
      lines: (_s, me) => [
        'ナレーション：クラス分けの掲示。御堂の名前は、選抜になかった。',
        '御堂（落ち込み）「“仕上がってる”って、伸びしろないって意味やったんやな」',
        '御堂（怒り）「学生のときの鉄板が、ここでは全部まばらや。……お前らは、毎回ちょっとずつ変えてくるやろ。あれが腹立つ」',
        `${me}（考え中）「……それ、褒めてる？」`,
        '御堂（笑い）「次は絶対負けへん。それだけ言いに来た」',
      ],
      choices: [
        { label: '「こっちこそ」と握手する', apply: (s) => (tie(s, 'mido', 8), inherit(s, 'mido')) },
        { label: '御堂のネタを見せてもらう', hint: 'ワード力＋・発想力＋', apply: (s) => (tie(s, 'mido', 6), gain(s, 'word', 3), gain(s, 'idea', 2)) },
      ],
    },
  ],

  // 真壁：同期のライバル（コント）。無口。キャップで目が見えない
  makabe: [
    {
      title: '一言もしゃべらない人',
      place: 'kyoushitsu',
      lines: () => [
        'ナレーション：真壁のコンビのコント。真壁はセリフが一つもない役だった。',
        'ナレーション：なのに、教室で一番大きい笑いは、真壁が黙って振り向いたところで起きた。',
        '三宅（爆笑）「真壁、何もしてへんのに！」',
        '真壁（ふつう）「……」',
      ],
      choices: [
        { label: '「今の、どうやったん？」と聞きに行く', hint: '表現力＋', apply: (s) => (tie(s, 'makabe', 8), gain(s, 'expr', 2)) },
        { label: '遠くから真似してみる', hint: '発想力＋', apply: (s) => (tie(s, 'makabe', 4), gain(s, 'idea', 2)) },
      ],
    },
    {
      title: 'ファミレスの観察',
      place: 'famires',
      lines: (_s, me) => [
        'ナレーション：深夜のファミレス。奥の席に、真壁が一人でいた。メモ帳に何か書いている。',
        `${me}（ふつう）「何書いてんの」`,
        '真壁（ふつう）「……あの人。ドリンクバー3回行って、3回とも同じのを混ぜてる」',
        '真壁（笑い）「たぶん、正解の配合を探してる」',
      ],
      choices: [
        { label: '隣に座って一緒に観察する', hint: '発想力＋', apply: (s) => (tie(s, 'makabe', 10), gain(s, 'idea', 3)) },
        { label: '「それ、コントになるやん」', hint: 'ネタの種＋', apply: (s) => (tie(s, 'makabe', 6), (s.neta.polish = clamp(s.neta.polish + 6))) },
      ],
    },
    {
      title: '真壁のメモ帳',
      place: 'kouen',
      lines: (_s, me) => [
        'ナレーション：公園のベンチ。真壁がキャップを少しだけ上げた。初めて目が見えた。',
        '真壁（照れ）「……しゃべるの、苦手やから。見るのだけは、得意」',
        '真壁（ふつう）「おもろい人は、本人がおもろいと思ってないところが一番おもろい」',
        '真壁（笑い）「このメモ帳、もう何冊目かわからん」',
        `${me}（驚き）「真壁、今日めっちゃしゃべるやん」`,
      ],
      choices: [
        { label: '「見方、教えてくれへん？」', apply: (s) => (tie(s, 'makabe', 8), inherit(s, 'makabe')) },
        { label: 'メモ帳を1ページだけ見せてもらう', hint: '発想力＋＋', apply: (s) => (tie(s, 'makabe', 6), gain(s, 'idea', 5)) },
      ],
    },
  ],

  // 店長：バイト先の居酒屋の店長。人情家【research/06 芸人のバイトあるある】
  tencho: [
    {
      title: 'シフトの融通',
      place: 'baito',
      lines: (_s, me) => [
        'ナレーション：居酒屋の厨房。店長がシフト表を見ながら言った。',
        '店長（笑い）「ライブの日は先に言うてや。全部空けとくから」',
        '店長（ふつう）「その代わり、売れたらうちの店の名前、テレビで言うてな」',
        `${me}（笑い）「絶対言います」`,
      ],
      choices: [
        { label: '「言います！」と約束する', hint: 'やる気＋', apply: (s) => (tie(s, 'tencho', 10), (s.motivation = clamp(s.motivation + 5))) },
        { label: '黙って皿を洗う', hint: '体力＋', apply: (s) => (tie(s, 'tencho', 6), gain(s, 'stamina', 2)) },
      ],
    },
    {
      title: '店長の十八番',
      place: 'baito',
      lines: (_s, me) => [
        'ナレーション：閉店後。店長がまかないを2人分作ってくれた。',
        '店長（照れ）「わしもな、若いころ、ちょっとだけ漫才やっててん。3か月で辞めたけど」',
        '店長（笑い）「腹減ってたら、ネタなんか書かれへんねん。食え食え」',
        `${me}（笑い）「いただきます！」`,
      ],
      choices: [
        { label: '毎回まかないを食べて帰る', apply: (s) => (tie(s, 'tencho', 6), inherit(s, 'tencho')) },
        { label: '「店長のネタ、見せてください」', hint: 'ワード力＋・発想力＋', apply: (s) => (tie(s, 'tencho', 8), gain(s, 'word', 2), gain(s, 'idea', 2)) },
      ],
    },
  ],

  // 支配人：小さな劇場の支配人。眠そうな目【research/03 劇場オーディション・出番の少なさ】
  shihainin: [
    {
      title: 'また来たね',
      place: 'butai',
      lines: (_s, me) => [
        'ナレーション：劇場の受付。眠そうな目の支配人が、チケットをもぎりながら言った。',
        '支配人（ふつう）「また来たね。今月4回目」',
        `${me}（驚き）「覚えてるんですか」`,
        '支配人（笑い）「客席から先輩を見に来る新人は、だいたい残る。見に来ないのは、だいたい消える」',
      ],
      choices: [
        { label: '「来月も来ます」', hint: '発想力＋', apply: (s) => (tie(s, 'shihainin', 10), gain(s, 'idea', 2)) },
        { label: '一番後ろの席で観る', hint: '表現力＋', apply: (s) => (tie(s, 'shihainin', 6), gain(s, 'expr', 2)) },
      ],
    },
    {
      title: '客席の端から',
      place: 'butai',
      lines: (_s, me) => [
        'ナレーション：閉館後。支配人が、客席の一番端の席を指さした。',
        '支配人（ふつう）「舞台に立つ前に、ここに座ってみ。この席からでも見える芸人だけが、劇場に残る」',
        '支配人（考え中）「出番は月に1回、60秒。その60秒で、端っこの客まで顔を覚えさせなあかん」',
        `${me}（考え中）「……60秒」`,
      ],
      choices: [
        { label: '端の席から舞台を見つめる', apply: (s) => (tie(s, 'shihainin', 6), inherit(s, 'shihainin')) },
        { label: '「60秒のネタ、見てもらえますか」', hint: 'ネタの完成度＋', apply: (s) => (tie(s, 'shihainin', 8), (s.neta.polish = clamp(s.neta.polish + 12))) },
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
          choices: ev.choices.map((c) => ({ label: c.label, hint: c.hint })),
        }),
        resolve: (s, c, rng) => ev.choices[c]?.apply(s, rng),
      },
    ]),
  ),
)

export const DEV_COUNT = Object.values(CHAINS).reduce((n, c) => n + c.length, 0)

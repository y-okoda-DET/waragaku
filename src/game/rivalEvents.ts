import { tie } from './bonds'
import { clamp, gain } from './core'
import type { StoryDef } from './events'
import type { GameState } from './types'

// ライバル（御堂・真壁）が1年の本筋に絡む場面
// bonds.ts の発展イベント（友好度で起きる3段）とは別に、決まった週に起きる
// 御堂：標準語の自信家、学生お笑いの用語が多い。秋に「仕上がってる」が剥がれ、主人公を恨みつつ認めていく
// 真壁：キャップで目が見えない。ほぼ単語。観察が得意。しゃべらないコントで一番ウケる
// セリフは台本の形：名前（表情）「…」／ナレーション：…
//
// フラグ（あとのイベントが読む）
// ・mido_rival：御堂に張り合うと宣言した（5月・8月）
// ・mido_open：御堂が弱みを見せた（8月・1月）
// ・makabe_judge：真壁に「どっちが早い？」と審査を頼んだ（5月）
// ・makabe_seen：真壁の出番を袖から観た（6月）
// ・makabe_rival：真壁に「次は勝つ」と言った（7月）

const me = (s: GameState) => s.player.callName
const combo = (s: GameState) => s.comboName || '自分たち'

function contestPassed(s: GameState, name: string): boolean | undefined {
  const r = s.contestResults.find((x) => x.name === name)
  return r ? r.result.includes('通過') : undefined
}

export const RIVAL_STORIES: Record<string, StoryDef> = {
  // 5月：夜の公園の街灯は、ネタ合わせの一等地
  rival_kouen: {
    view: () => ({
      title: '街灯の下',
      place: 'kouen',
      lines: [
        'ナレーション：夜の公園。街灯の下は、ネタ合わせの一等地だ。今夜は先客がいた。御堂のコンビだった。',
        '御堂（ふつう）「ごめん、ここ21時から押さえてるんだよね。表情の確認、暗いとできないから」',
        '御堂（笑い）「あと、さっき通りがかりに聞こえた。ボケのあとのツッコミ、0.5秒早い。“間”は大事だよ」',
        'ナレーション：ベンチの暗がりに、キャップを目深にかぶった同期が座っている。真壁だ。さっきから、両方を見ている。',
        '真壁（ふつう）「……どっちも、早い」',
      ],
      choices: [
        { reply: '御堂（笑い）「声量で勝負するの、学生の1回戦までだよ」', label: '「隣の街灯でやるわ。声はこっちがデカいけどな」', hint: '度胸＋・尖り＋' },
        { reply: '御堂（驚き）「……体感だよ。体感で分かるくらいには、やってきたから」', label: '「0.5秒って、何で測ったん」', hint: '対応力＋' },
        { reply: ['真壁（考え中）「……あっち。0.6」', '御堂（怒り）「……測ってたの？」'], label: '真壁に「どっちが早い？」と聞く', hint: '発想力＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.flags.mido_rival = true
        tie(s, 'mido', 5)
        gain(s, 'guts', 2)
        s.edge += 2
      } else if (c === 1) {
        tie(s, 'mido', 4)
        gain(s, 'adlib', 2)
      } else {
        s.flags.makabe_judge = true
        tie(s, 'makabe', 6)
        tie(s, 'mido', 2)
        gain(s, 'idea', 2)
      }
    },
  },

  // 6月：ほやほや初回の袖。真壁は客席ではなく、出番前の芸人を見ている
  rival_sode: {
    view: (s) => ({
      title: '袖のグー',
      place: 'butai',
      lines: [
        'ナレーション：月イチ寄席「ほやほや」。袖は、人がすれ違えないほど狭い。',
        'ナレーション：前の出番は真壁のコンビ。真壁は客席ではなく、出番を待つ芸人の顔を順番に見ている。',
        ...(s.flags.makabe_judge ? ['真壁（ふつう）「……0.6。直った？」'] : []),
        '真壁（ふつう）「……手」',
        `${me(s)}（驚き）「手？」`,
        '真壁（笑い）「ずっと、グー」',
      ],
      choices: [
        { reply: '真壁（笑い）「……パー。勝ち」', label: 'グーをパーに開いて見せる', hint: '度胸＋・体調＋' },
        { reply: ['真壁（ふつう）「……する」', 'ナレーション：真壁がキャップを1センチ下げた。それが真壁の緊張らしい。'], label: '「真壁は緊張せえへんの？」', hint: '発想力＋' },
        { reply: 'ナレーション：真壁は一言もしゃべらず、その日いちばん大きい笑いを持っていった。次が、自分たちの番だった。', label: '真壁の出番を袖から観る', hint: '表現力＋・やる気−' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        tie(s, 'makabe', 5)
        gain(s, 'guts', 2)
        s.condition = clamp(s.condition + 4)
      } else if (c === 1) {
        tie(s, 'makabe', 6)
        gain(s, 'idea', 2)
      } else {
        s.flags.makabe_seen = true
        tie(s, 'makabe', 3)
        gain(s, 'expr', 3)
        s.motivation = clamp(s.motivation - 3)
      }
    },
  },

  // 7月：コント頂1回戦。同じ組に真壁のコンビ
  rival_onaji_kumi: {
    view: (s) => {
      const passed = contestPassed(s, 'コント頂')
      return {
        title: '同じ組',
        place: 'livehouse',
        lines: [
          'ナレーション：コント頂の1回戦。同じ組の5組前に、真壁のコンビがいた。',
          `ナレーション：真壁の役は「エレベーターに乗り合わせた人」。2分間、ひとこともしゃべらない。${s.flags.makabe_seen ? '袖で観たあの間が、2分間続いた。' : ''}`,
          'ナレーション：真壁が階数ボタンを押し直すたびに、会場の笑いが大きくなった。3回目は、押さなかった。いちばんウケた。',
          passed
            ? `ナレーション：結果ページには、真壁のコンビと${combo(s)}の名前が並んでいた。`
            : 'ナレーション：結果ページには、真壁のコンビの名前だけがあった。',
          '真壁（ふつう）「……おつかれ」',
        ],
        choices: [
          { reply: '真壁（笑い）「……客が、押す。頭の中で」', label: '「3回目、なんで押さへんかったん」', hint: '発想力＋' },
          { reply: '真壁（ふつう）「……うん。待つ」', label: '「次は、同じ組で勝つ」', hint: 'やる気＋' },
          { reply: '真壁（爆笑）「……押しすぎ」', label: 'エレベーターの真似をして見せる', hint: '表現力＋' },
        ],
      }
    },
    resolve: (s, c) => {
      if (c === 0) {
        tie(s, 'makabe', 6)
        gain(s, 'idea', 3)
      } else if (c === 1) {
        s.flags.makabe_rival = true
        tie(s, 'makabe', 5)
        s.motivation = clamp(s.motivation + 8)
      } else {
        tie(s, 'makabe', 7)
        gain(s, 'expr', 2)
      }
    },
  },

  // 8月：漫才天下一1回戦の夜。ファミレスで、斜め向かいも結果ページを更新している
  rival_kekka_page: {
    view: (s) => {
      const passed = contestPassed(s, '漫才天下一')
      return {
        title: '41回目の更新',
        place: 'famires',
        lines: [
          'ナレーション：漫才天下一、1回戦の夜。ファミレスで結果ページを更新していると、斜め向かいの席でも同じ親指の動きをしている男がいた。御堂だ。',
          '御堂（ふつう）「……更新は30秒に1回でいい。負荷かけると反映が遅れる。らしいよ」',
          `${me(s)}（笑い）「お前、今ので何回目や」`,
          '御堂（照れ）「……41回目」',
          passed
            ? `ナレーション：結果が出た。${combo(s)}も、御堂のコンビも、名前があった。御堂は「当然」と言ってから、トイレに5分こもった。`
            : 'ナレーション：結果が出た。御堂のコンビの名前だけがあった。御堂は「……お疲れ」とだけ言って、伝票を2枚とも持っていった。',
        ],
        choices: [
          { reply: '御堂（笑い）「いいよ。負けた方がドリンクバー奢り。……安い賭けだね」', label: '「次、どっちが先に落ちるか賭けよか」', hint: '度胸＋' },
          { reply: '御堂（考え中）「……学生のときは、待たなかった。通るの分かってたから。待つの、今日が初めて」', label: '「学生のときも、こうやって待ってたん？」', hint: '発想力＋' },
          { reply: '御堂（驚き）「……メロンソーダ？ 頼んでないけど。……飲むけど」', label: '黙ってドリンクバーを2人分取りに行く', hint: '体調＋' },
        ],
      }
    },
    resolve: (s, c) => {
      if (c === 0) {
        s.flags.mido_rival = true
        tie(s, 'mido', 6)
        gain(s, 'guts', 2)
      } else if (c === 1) {
        s.flags.mido_open = true
        tie(s, 'mido', 7)
        gain(s, 'idea', 2)
      } else {
        tie(s, 'mido', 5)
        s.condition = clamp(s.condition + 5)
      }
    },
  },

  // 9月：合宿の前の週。行きのバスの席順の噂【gasshuku の灰原の噂を受ける】
  rival_bus: {
    view: () => ({
      title: '座席表の噂',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：合宿の前の週。行きのバスの座席表はまだ出ていないのに、教室はその話で持ちきりだ。',
        '御堂（笑い）「前の方は選抜候補、後ろは思い出づくり。データ的にはね。去年の座席表、手に入れたから」',
        '真壁（ふつう）「……今年、違う」',
        '御堂（驚き）「なんで分かるの」',
        '真壁（ふつう）「灰原さん。座席表。逆さまに、持ってた」',
      ],
      choices: [
        { reply: ['御堂（考え中）「……つまり、僕が後ろ？」', '真壁（笑い）「……かも」'], label: '「ほな、前と後ろが逆ってこと？」', hint: '対応力＋' },
        { reply: '御堂（笑い）「いいよ。ほら、3列目。ここが去年の総代。……僕、今年ここ狙ってるから」', label: '御堂に去年の座席表を見せてもらう', hint: '発想力＋' },
        { reply: '御堂（怒り）「……正論やめてくれる？ 今、楽しかったのに」', label: '「座席で決まるなら、ネタいらんやん」', hint: '度胸＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        tie(s, 'mido', 3)
        tie(s, 'makabe', 4)
        gain(s, 'adlib', 2)
      } else if (c === 1) {
        tie(s, 'mido', 5)
        gain(s, 'idea', 2)
      } else {
        tie(s, 'mido', 3)
        tie(s, 'makabe', 4)
        gain(s, 'guts', 2)
      }
    },
  },

  // 11月：三校対抗戦の選考の前。御堂は候補から外れ、真壁と枠を争う
  rival_waku: {
    view: (s) => {
      const listed = s.classRank === 'matsu' || !!s.flags.tokushin
      return {
        title: '最後の枠',
        place: 'rouka',
        lines: [
          'ナレーション：廊下に三校対抗戦の告知が貼られた。候補は松組と特進から。',
          listed
            ? `ナレーション：候補の欄に${combo(s)}の名前があった。その隣に、真壁のコンビ。残る枠は、たぶんどちらか1つ。`
            : `ナレーション：候補の欄に真壁のコンビの名前があった。${combo(s)}の名前は、その下の「補欠」の欄の、さらに下にあった。`,
          '御堂（落ち込み）「……僕らは補欠にもいない。夏まで“仕上がってる”って言われてたのにね」',
          s.flags.mido_rival
            ? '御堂（怒り）「張り合ってた相手が先に上に行くの、いちばん腹立つんだよ。……応援はしないから」'
            : '御堂（笑い）「真壁と君ら、どっちが出ても応援しないから。それだけ」',
          s.flags.makabe_rival ? '真壁（ふつう）「……同じ組。待ってた」' : '真壁（ふつう）「……どうぞ」',
        ],
        choices: [
          { reply: '御堂（考え中）「……全部、正しかった。フリもボケも天丼も。正しいだけだった」', label: '「御堂のネタ、何があかんかったん」', hint: '発想力＋' },
          { reply: '真壁（笑い）「……ない」', label: '真壁に「枠、譲る気ある？」と聞く', hint: '度胸＋・ネタの完成度＋' },
          { reply: '御堂（笑い）「……いいね。それ、去年の僕のセリフ」', label: '「応援されへんでも、勝つわ」', hint: 'やる気＋・尖り＋' },
        ],
      }
    },
    resolve: (s, c) => {
      if (c === 0) {
        s.flags.mido_open = true
        tie(s, 'mido', 7)
        gain(s, 'idea', 2)
      } else if (c === 1) {
        tie(s, 'makabe', 5)
        gain(s, 'guts', 2)
        s.neta.polish = clamp(s.neta.polish + 4)
      } else {
        tie(s, 'mido', 4)
        s.motivation = clamp(s.motivation + 6)
        s.edge += 2
      }
    },
  },

  // 1月：ほやほやの楽屋。12月の事故を、御堂は袖から見ていた
  rival_jiko_ato: {
    view: (s) => ({
      title: '3秒',
      place: 'gakuya',
      lines: [
        'ナレーション：年明けのほやほや。楽屋の隅で出番を待っていると、御堂が隣に座った。',
        '御堂（ふつう）「12月の、袖から見てた」',
        s.flags.jiko_saved
          ? '御堂（考え中）「飛んだところが、いちばんウケてた。あれ、台本にないでしょ。……僕にはできない。台本どおりにしか、やってこなかったから」'
          : '御堂（考え中）「3秒、黙ってたね。学生のときの僕なら“事故”って笑ってた。……今は笑えない。3秒の長さ、知ってるから」',
        '御堂（笑い）「悔しいけど、今日のネタ、袖で見るよ」',
        `${me(s)}（驚き）「……」`,
      ],
      choices: [
        { reply: '御堂（照れ）「……学生の決勝で1回。誰にも言ってない。今、言った」', label: '「御堂も、飛んだことあるん？」', hint: 'やる気＋' },
        { reply: '御堂（笑い）「……ウケたらね。採点は厳しいよ」', label: '「袖で見るんやったら、笑えよ」', hint: '度胸＋' },
        { reply: '御堂（怒り）「同情じゃないよ。……リスペクトって、言わせないで」', label: '「同情はいらん」', hint: '尖り＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.flags.mido_open = true
        tie(s, 'mido', 8)
        s.motivation = clamp(s.motivation + 6)
      } else if (c === 1) {
        tie(s, 'mido', 6)
        gain(s, 'guts', 3)
      } else {
        s.flags.mido_rival = true
        tie(s, 'mido', 5)
        s.edge += 3
      }
    },
  },

  // 2月：卒業大会「門出」の打ち上げ。ライバル2人と最後に並ぶ
  rival_kadode_ato: {
    view: (s) => {
      const r = s.gradRank
      return {
        title: '門出の打ち上げ',
        place: 'izakaya',
        lines: [
          'ナレーション：卒業大会「門出」の打ち上げ。安い居酒屋の座敷に、同期がぎゅうぎゅうに座っている。',
          r === 1
            ? 'ナレーション：総代のたすきを、まだ外せずにいる。'
            : r && r <= 8
              ? `ナレーション：決勝${r}位。悔しいのか嬉しいのか、まだ分からない。`
              : 'ナレーション：決勝は、客席から観た。',
          s.flags.mido_open
            ? '御堂（笑い）「1年でいちばん伸びたの、君らだったね。……学生の決勝で飛ばした話、誰にも言わないでよ」'
            : '御堂（笑い）「1年でいちばん伸びたの、君らだったね。4月は“天丼”も知らなかったのに」',
          '真壁（ふつう）「……メモ。最後のページ」',
          'ナレーション：真壁が、メモ帳を1枚破って差し出した。「4月：うるさい。2月：うるさい。おもろい」',
        ],
        choices: [
          { reply: '御堂（笑い）「……4月にそれ言われてたら、鼻で笑ってた。今は、ちょっと怖い」', label: '「御堂、4月からも負けへんで」', hint: 'やる気＋' },
          { reply: '真壁（爆笑）「……ずるい」', label: 'メモに「真壁：しゃべらんのに一番うるさい」と書き足して返す', hint: 'ワード力＋' },
          { reply: ['御堂（照れ）「……乾杯の音頭、学生のときから苦手なんだよ」', '真壁（笑い）「……かんぱい」', 'ナレーション：結局、いちばん声の小さい真壁が音頭を取った。座敷がいちばん笑った。'], label: '3人で乾杯する', hint: '同期の結束＋' },
        ],
      }
    },
    resolve: (s, c) => {
      if (c === 0) {
        tie(s, 'mido', 8)
        s.motivation = clamp(s.motivation + 8)
      } else if (c === 1) {
        tie(s, 'makabe', 8)
        gain(s, 'word', 3)
      } else {
        tie(s, 'mido', 5)
        tie(s, 'makabe', 5)
        s.dokiBond = clamp(s.dokiBond + 5)
      }
    },
  },
}

// どの週に起きるか。固定イベントのない週を選んでいる
// 6/4・1/4 は月イチ寄席（live）の週。ストーリーはステージの前後どちらに出ても読めるようにしてある
export const RIVAL_SCHEDULE: { month: number; week: number; key: string; when?: (s: GameState) => boolean }[] = [
  { month: 5, week: 4, key: 'rival_kouen' },
  { month: 6, week: 4, key: 'rival_sode' },
  { month: 7, week: 4, key: 'rival_onaji_kumi', when: (s) => contestPassed(s, 'コント頂') !== undefined },
  { month: 8, week: 4, key: 'rival_kekka_page', when: (s) => contestPassed(s, '漫才天下一') !== undefined },
  { month: 9, week: 1, key: 'rival_bus' },
  { month: 11, week: 1, key: 'rival_waku' },
  { month: 1, week: 4, key: 'rival_jiko_ato', when: (s) => (s.counters.jiko ?? 0) > 0 },
  { month: 2, week: 3, key: 'rival_kadode_ato', when: (s) => s.gradRank !== null },
]

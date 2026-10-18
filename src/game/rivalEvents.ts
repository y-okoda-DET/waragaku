import { rivalOf, tie } from './bonds'
import { clamp, gain } from './core'
import type { StoryDef } from './events'
import type { GameState } from './types'
import { kadodeHead, midoPartnerLine, rivalVariant } from './rivalCareers'

// ライバル（御堂・真壁）が1年の本筋に絡む場面
// 漫才を選ぶと御堂、コントを選ぶと真壁がライバルになり、その人の場面だけが起きる。もう1人は1年を通して出てこない
// 大学お笑いと元会社員は、出会い方と会話を経歴ごとに書き分けている（rivalCareers.ts）。ここに書いた台本は高校卒業の分
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
// ・mido_promise／makabe_promise：門出の前の夜に、決勝での約束をした（2月）

const me = (s: GameState) => s.player.callName

export { rivalOf }
const combo = (s: GameState) => s.comboName || '自分たち'

function contestPassed(s: GameState, name: string): boolean | undefined {
  const r = s.contestResults.find((x) => x.name === name)
  return r ? r.result.includes('通過') : undefined
}

const BASE: Record<string, StoryDef> = {
  // 5月：夜の公園の街灯は、ネタ合わせの一等地。ライバルとちゃんと話すのは、これが最初
  rival_kouen: {
    view: (s) =>
      rivalOf(s) === 'mido'
        ? {
            title: '街灯の下',
            place: 'kouen',
            lines: [
              'ナレーション：夜の公園。街灯の下は、ネタ合わせの一等地だ。今夜は先客がいた。御堂のコンビだった。',
              'ナレーション：御堂。学生お笑いの全国大会で準優勝したコンビのツッコミ。入学式の日から、ひとりだけ「経験者」の顔をしていた。授業で講師に褒められるのも、いつも御堂だ。',
              'ナレーション：正直、苦手なタイプだと思っていた。向こうも、こっちの名前は覚えていないだろうと思っていた。',
              `御堂（ふつう）「${me(s)}くんだよね。ごめん、ここ21時から押さえてるんだ。表情の確認、暗いとできないから」`,
              '御堂（笑い）「あと、さっき通りがかりに聞こえた。ボケのあとのツッコミ、0.5秒早い。“間”は大事だよ」',
            ],
            choices: [
              { reply: '御堂（笑い）「声量で勝負するの、学生の1回戦までだよ」', label: '「隣の街灯でやるわ。声はこっちがデカいけどな」', hint: '度胸＋' },
              { reply: '御堂（驚き）「……体感だよ。体感で分かるくらいには、やってきたから」', label: '「0.5秒って、何で測ったん」', hint: '対応力＋' },
              { reply: ['御堂（驚き）「……え。素直だね」', '御堂（照れ）「……1回だけね。僕の相方、こういうの嫌がるから」'], label: '「その0.5秒、教えてくれ」と頭を下げる', hint: '表現力＋' },
            ],
          }
        : {
            title: '街灯の下',
            place: 'kouen',
            lines: [
              'ナレーション：夜の公園。街灯の下は、ネタ合わせの一等地だ。今夜は先客がいた。真壁のコンビだった。',
              'ナレーション：真壁。入学式の自己紹介は「真壁。……コント」だけだった。キャップを目深にかぶっていて、目が見えない。何を考えているか分からない同期、と思っていた。',
              'ナレーション：相方がセリフを言い、真壁は黙ってベンチに座り直す。それだけなのに、なぜか可笑しい。気づいたら、植え込みの陰から見ていた。',
              '真壁（ふつう）「……見てた？」',
              `${me(s)}（驚き）「……バレてた」`,
              '真壁（ふつう）「……ずっと。コント、するの？」',
              ...(s.flags.nyugaku_ohayo ? ['真壁（ふつう）「……入学式の。おはようございます、の人」'] : []),
            ],
            choices: [
              { reply: '真壁（笑い）「……うるさい。……いい」', label: '「隣の街灯でやるわ。声はこっちがデカいけどな」', hint: '度胸＋' },
              { reply: '真壁（考え中）「……座る前に、客が座る。頭の中で」', label: '「座り直すだけで、なんでウケるん」', hint: '発想力＋' },
              { reply: ['真壁（ふつう）「……うん」', 'ナレーション：ネタを1本やった。真壁は最後まで表情を変えなかった。', '真壁（笑い）「……2か所。笑った」'], label: '「こっちのコントも見てや」', hint: '表現力＋' },
            ],
          },
    resolve: (s, c) => {
      if (rivalOf(s) === 'mido') {
        if (c === 0) {
          s.flags.mido_rival = true
          tie(s, 'mido', 5)
          gain(s, 'guts', 2)
        } else if (c === 1) {
          tie(s, 'mido', 4)
          gain(s, 'adlib', 2)
        } else {
          tie(s, 'mido', 6)
          gain(s, 'expr', 2)
        }
      } else if (c === 0) {
        tie(s, 'makabe', 5)
        gain(s, 'guts', 2)
      } else if (c === 1) {
        tie(s, 'makabe', 5)
        gain(s, 'idea', 2)
      } else {
        s.flags.makabe_judge = true
        tie(s, 'makabe', 6)
        gain(s, 'expr', 2)
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
        ...(s.flags.makabe_judge ? ['真壁（ふつう）「……2か所。増えた？」'] : []),
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

  // 6月：ほやほや初回の袖。御堂は台本を閉じない（漫才のとき）
  rival_sode_mido: {
    view: (s) => ({
      title: '台本の余白',
      place: 'butai',
      lines: [
        'ナレーション：月イチ寄席「ほやほや」。袖は、人がすれ違えないほど狭い。',
        'ナレーション：前の出番は御堂のコンビ。御堂は台本を開いたまま目を閉じて、唇だけを動かしている。',
        'ナレーション：台本の余白に、秒数がびっしり書いてあった。「0.5」「0.4」「0.6」「0.5」。',
        '御堂（ふつう）「……ごめん、話しかけないで。今、3周目」',
        `${me(s)}（驚き）「本番前に、まだ見てんの？」`,
      ],
      choices: [
        { reply: '御堂（怒り）「知ってるよ。……知ってるから、見てるんだよ」', label: '「本番は台本、持って出られへんで」', hint: '度胸＋' },
        { reply: '御堂（笑い）「……君らのネタ、聞こえてる。口、動いてるよ」', label: '同じように目を閉じて、自分たちのネタを頭で流す', hint: 'ネタの完成度＋' },
        { reply: 'ナレーション：御堂のコンビは、台本どおりに、きっちり笑いを取った。秒数どおりの笑いだった。なぜか、少しだけ怖かった。', label: '御堂の出番を袖から観る', hint: '表現力＋・やる気−' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        tie(s, 'mido', 5)
        gain(s, 'guts', 2)
      } else if (c === 1) {
        tie(s, 'mido', 4)
        s.neta.polish = clamp(s.neta.polish + 4)
      } else {
        s.flags.mido_seen = true
        tie(s, 'mido', 3)
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
    view: (s) =>
      rivalOf(s) === 'mido'
        ? {
            title: '座席表の噂',
            place: 'kyoushitsu',
            lines: [
              'ナレーション：合宿の前の週。行きのバスの座席表はまだ出ていないのに、教室はその話で持ちきりだ。',
              '御堂（笑い）「前の方は選抜候補、後ろは思い出づくり。データ的にはね。去年の座席表、手に入れたから」',
            ],
            choices: [
              { reply: '御堂（考え中）「……つまり、僕が後ろ？ ……データ的には、ないとは言えないね」', label: '「ほな、前と後ろが逆ってこともあるやろ」', hint: '対応力＋' },
              { reply: '御堂（笑い）「いいよ。ほら、3列目。ここが去年の総代。……僕、今年ここ狙ってるから」', label: '御堂に去年の座席表を見せてもらう', hint: '発想力＋' },
              { reply: '御堂（怒り）「……正論やめてくれる？ 今、楽しかったのに」', label: '「座席で決まるなら、ネタいらんやん」', hint: '度胸＋' },
            ],
          }
        : {
            title: '座席表の噂',
            place: 'kyoushitsu',
            lines: [
              'ナレーション：合宿の前の週。行きのバスの座席表はまだ出ていないのに、教室はその話で持ちきりだ。',
              'ナレーション：真壁だけが、話に入らずに窓の外を見ている。',
              '真壁（ふつう）「……前、選抜。後ろ、思い出。……みんな、そう言ってる」',
            ],
            choices: [
              { reply: '真壁（笑い）「……灰原さん。座席表。逆さまに、持ってた」', label: '「ほな、前と後ろが逆ってこともあるやろ」', hint: '対応力＋' },
              { reply: '真壁（考え中）「……いちばん後ろ。全員の、後頭部。見える」', label: '「真壁は、どこ座りたいん」と聞く', hint: '発想力＋' },
              { reply: '真壁（ふつう）「……うん。うるさい席、行く」', label: '「座席で決まるなら、ネタいらんやん」', hint: '度胸＋' },
            ],
          },
    resolve: (s, c) => {
      const r = rivalOf(s)
      if (c === 0) {
        tie(s, r, 4)
        gain(s, 'adlib', 2)
      } else if (c === 1) {
        tie(s, r, 5)
        gain(s, 'idea', 2)
      } else {
        tie(s, r, 4)
        gain(s, 'guts', 2)
      }
    },
  },

  // 11月：三校対抗戦の選考の前。ライバルと最後の1枠を争う
  rival_waku: {
    view: (s) => {
      const listed = s.classRank === 'matsu' || !!s.flags.tokushin
      if (rivalOf(s) === 'mido')
        return {
          title: '最後の枠',
          place: 'rouka',
          lines: [
            'ナレーション：廊下に三校対抗戦の告知が貼られた。候補は松組と特進から。漫才の枠は1つ。',
            listed
              ? `ナレーション：候補の欄に${combo(s)}の名前があった。その隣に、御堂のコンビ。`
              : `ナレーション：候補の欄に御堂のコンビの名前があった。${combo(s)}の名前は、その下の「補欠」の欄の、さらに下にあった。`,
            '御堂（ふつう）「夏までは“仕上がってる”って言われてた。秋からは“仕上がってる扱い”。……扱い、って何だろうね」',
            s.flags.mido_rival
              ? '御堂（怒り）「張り合うって言ったの、そっちだからね。……手加減したら、一生恨む」'
              : '御堂（笑い）「枠は取りに行くから。君らがどうでも」',
          ],
          choices: [
            { reply: '御堂（考え中）「……全部、正しかった。フリもボケも天丼も。正しいだけだった」', label: '「御堂のネタ、何があかんの」', hint: '発想力＋' },
            { reply: '御堂（考え中）「……恨むよ。恨むけど、ちゃんと観る」', label: '「どっちが選ばれても、恨みっこなしや」', hint: 'やる気＋' },
            { reply: '御堂（笑い）「……いいね。それ、去年の僕のセリフ」', label: '「応援されへんでも、勝つわ」', hint: 'やる気＋' },
          ],
        }
      return {
        title: '最後の枠',
        place: 'rouka',
        lines: [
          'ナレーション：廊下に三校対抗戦の告知が貼られた。候補は松組と特進から。コントの枠は1つ。',
          listed
            ? `ナレーション：候補の欄に${combo(s)}の名前があった。その隣に、真壁のコンビ。`
            : `ナレーション：候補の欄に真壁のコンビの名前があった。${combo(s)}の名前は、その下の「補欠」の欄の、さらに下にあった。`,
          'ナレーション：告知の前で、真壁がずっと立っている。キャップのつばで、どこを見ているのか分からない。',
          s.flags.makabe_rival ? '真壁（ふつう）「……同じ組。待ってた」' : '真壁（ふつう）「……どうぞ」',
        ],
        choices: [
          { reply: '真壁（考え中）「……しゃべると、嘘になる。だから、しゃべらない」', label: '「真壁のコント、なんでしゃべらへんの」', hint: '発想力＋' },
          { reply: '真壁（笑い）「……ない」', label: '「枠、譲る気ある？」と聞く', hint: '度胸＋・ネタの完成度＋' },
          { reply: '真壁（笑い）「……知ってる」', label: '「選ばれへんでも、勝つわ」', hint: 'やる気＋' },
        ],
      }
    },
    resolve: (s, c) => {
      const r = rivalOf(s)
      if (c === 0) {
        s.flags[r === 'mido' ? 'mido_open' : 'makabe_open'] = true
        tie(s, r, 7)
        gain(s, 'idea', 2)
      } else if (c === 1) {
        tie(s, r, 5)
        if (r === 'mido') s.motivation = clamp(s.motivation + 5)
        else {
          gain(s, 'guts', 2)
          s.neta.polish = clamp(s.neta.polish + 4)
        }
      } else {
        tie(s, r, 4)
        s.motivation = clamp(s.motivation + 6)
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
        { reply: '御堂（怒り）「同情じゃないよ。……リスペクトって、言わせないで」', label: '「同情はいらん」', hint: '度胸＋' },
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
        gain(s, 'guts', 2)
      }
    },
  },

  // 1月：ほやほやの楽屋。12月の事故を、真壁は袖から見ていた（コントのとき）
  rival_jiko_ato_makabe: {
    view: (s) => ({
      title: '袖のメモ',
      place: 'gakuya',
      lines: [
        'ナレーション：年明けのほやほや。楽屋で出番を待っていると、真壁がメモ帳を1枚破って、黙って置いていった。',
        'ナレーション：「12月　3秒　とまる　客　前のめり」',
        s.flags.jiko_saved ? '真壁（ふつう）「……あの3秒。いちばん、見てた。客」' : '真壁（ふつう）「……3秒。長かった。でも、客、帰らなかった」',
        `${me(s)}（驚き）「……」`,
      ],
      choices: [
        { reply: '真壁（照れ）「……全部、ある。4月から」', label: '「このメモ、もらってええの」', hint: 'やる気＋' },
        { reply: ['真壁（ふつう）「……毎回」', '真壁（笑い）「しゃべらないから、ばれない」'], label: '「真壁も、止まったことある？」', hint: '度胸＋' },
        { reply: '真壁（怒り）「……同情、しない。メモ」', label: '「同情はいらん」', hint: '度胸＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.flags.makabe_open = true
        tie(s, 'makabe', 8)
        s.motivation = clamp(s.motivation + 6)
      } else if (c === 1) {
        tie(s, 'makabe', 6)
        gain(s, 'guts', 3)
      } else {
        tie(s, 'makabe', 5)
        gain(s, 'guts', 2)
      }
    },
  },

  // 2月：門出の前の週。ライバルが、1年でいちばん本音を話す夜
  rival_yoru: {
    view: (s) =>
      rivalOf(s) === 'mido'
        ? {
            title: '終電のホーム',
            place: 'ekimae',
            lines: [
              'ナレーション：門出の前の週。終電のホームで、御堂がひとりでベンチに座っていた。膝の上に、表紙の破れたノートがある。',
              '御堂（ふつう）「相方、門出で優勝できなかったら辞めるって。就職、決まってるんだ。そういう約束で、親に入学させてもらったらしい」',
              '御堂（考え中）「学生の決勝で負けたとき、審査員に言われたんだ。“君らの漫才は正しい。正しいだけで、おもろない”って」',
              '御堂（ふつう）「これ、高1のとき、相方が初めて書いたネタ。……ひどいよ。フリもオチもない」',
              'ナレーション：開いたページの余白に、下手な字で書いてあった。「ここで御堂がわらったら成功」',
              '御堂（照れ）「あのころは、毎回成功してた。……いつからだろうね。舞台で笑わなくなったの。正しくやるのに、必死で」',
              `御堂（笑い）「君らの漫才は、ずっと正しくない。4月から。……褒めてるんだよ、たぶん」`,
              'ナレーション：終電が入ってきた。御堂は立ち上がらなかった。',
            ],
            choices: [
              { reply: ['御堂（笑い）「……それ、聞きたかった」', 'ナレーション：ドアが閉まる直前、御堂は電車に飛び乗った。窓の向こうで、親指を立てていた。'], label: '「門出、手加減せえへんで」', hint: 'やる気＋' },
              { reply: ['御堂（照れ）「……何を」', `${me(s)}（ふつう）「お前とやるのがおもろい、って」`, '御堂（照れ）「……言えるわけないだろ。……言うけど」'], label: '「相方に、一回ちゃんと言うたら」', hint: '同期の結束＋' },
              {
                reply: [
                  'ナレーション：ノートを借りて、ホームのベンチの前で、高1のネタをやった。本当にひどかった。',
                  'ナレーション：終電が出ていった。3つ目のボケで、御堂の肩が震えた。',
                  '御堂（爆笑）「……ひどい。ひどすぎる。なんで、これで笑ってたんだろ」',
                  'ナレーション：御堂は、しばらく笑いが止まらなかった。目尻を何度もこすっていた。',
                  '御堂（照れ）「……タクシー代、半分出す」',
                ],
                label: '「そのネタ、今ここでやろうや」',
                hint: '体調−・お金−',
              },
            ],
          }
        : {
            title: 'いちばんしゃべった夜',
            place: 'kouen',
            lines: [
              'ナレーション：門出の前の週。ネタ合わせの帰り、公園の街灯の下に、真壁がひとりで立っていた。5月に先客だった、あの街灯だ。',
              '真壁（ふつう）「……小学生のとき、しゃべれなかった。教室で、一言も」',
              '真壁（考え中）「朝の会。みんな、おはよう、って言う。わたしだけ、口が開かない。6年」',
              '真壁（ふつう）「だから、ずっと見てた。人が笑う前。息を、吸うところ」',
              s.flags.nyugaku_ohayo
                ? '真壁（笑い）「入学式。あなた、大きい声で、おはようございます。みんな笑った。……いいな、と思った」'
                : '真壁（ふつう）「入学式。あなたも、周り、見てた。……同じ、と思った」',
              '真壁（ふつう）「門出のネタ。最後に一言だけ、しゃべる。そう決めた」',
              '真壁（照れ）「……練習、付き合って。あなたの前なら、言える。気がする」',
              'ナレーション：真壁が、こんなに長くしゃべるのを初めて聞いた。何の一言なのかは、聞かなかった。',
            ],
            choices: [
              {
                reply: [
                  'ナレーション：相手役をやった。真壁の一言は、何度やっても、声になる手前で止まった。',
                  'ナレーション：日付が変わるころ、真壁がキャップを取った。',
                  '真壁（素顔）「……見えてると、言えない。と、思ってた」',
                  '真壁（素顔）「……おはようございます」',
                  'ナレーション：夜中の公園で、朝の挨拶を聞いた。何と返せばいいのか分からなくて、「おはよう」とだけ言った。',
                  'ナレーション：真壁はキャップをかぶり直した。つばが、前より少しだけ上がっていた。',
                ],
                label: '相手役をやって、練習に付き合う',
                hint: '表現力＋・体調−',
              },
              { reply: '真壁（笑い）「……袖、近い。……がんばる」', label: '「決勝で、その一言を聞かせてくれ。袖で待ってる」', hint: 'やる気＋' },
              { reply: ['ナレーション：真壁も座った。しばらくして、真壁が小さく「……ありがと」と言った。', 'ナレーション：聞き返さなかった。聞き返したら、もう二度と言わない気がした。'], label: '何も言わずに、ベンチに座る', hint: '同期の結束＋' },
            ],
          },
    resolve: (s, c) => {
      const r = rivalOf(s)
      tie(s, r, 10)
      if (c === 0) {
        if (r === 'mido') {
          s.flags.mido_promise = true
          s.motivation = clamp(s.motivation + 8)
        } else {
          s.flags.makabe_sugao = true
          gain(s, 'expr', 3)
          s.condition = clamp(s.condition - 8)
        }
      } else if (c === 1) {
        if (r === 'mido') s.dokiBond = clamp(s.dokiBond + 6)
        else {
          s.flags.makabe_promise = true
          s.motivation = clamp(s.motivation + 8)
        }
      } else if (r === 'mido') {
        s.flags.mido_warai = true
        s.condition = clamp(s.condition - 6)
        s.money -= 2000
      } else s.dokiBond = clamp(s.dokiBond + 6)
    },
  },

  // 2月：卒業大会「門出」の打ち上げ。ライバルと最後に並ぶ
  rival_kadode_ato: {
    view: (s) =>
      rivalOf(s) === 'mido'
        ? {
            title: '門出の打ち上げ',
            place: 'izakaya',
            lines: [
              ...kadodeHead(s),
              s.flags.mido_open ? '御堂（笑い）「1年でいちばん伸びたの、君らだったね。……学生の決勝で飛ばした話、誰にも言わないでよ」' : '御堂（笑い）「1年でいちばん伸びたの、君らだったね。4月は“天丼”も知らなかったのに」',
              midoPartnerLine(s),
            ],
            choices: [
              { reply: '御堂（笑い）「……4月にそれ言われてたら、鼻で笑ってた。今は、ちょっと怖い」', label: '「御堂、4月からも負けへんで」', hint: 'やる気＋' },
              { reply: '御堂（爆笑）「……天丼の書き方、まだ間違ってるよ。……ずるい」', label: '御堂の台本の余白に「天丼＝食べ物」と書き足して返す', hint: 'ワード力＋' },
              { reply: ['御堂（照れ）「……乾杯の音頭、学生のときから苦手なんだよ」', 'ナレーション：結局、音頭を取った。御堂が、いちばん大きい声で「乾杯」と言った。'], label: '同期みんなで乾杯する', hint: '同期の結束＋' },
            ],
          }
        : {
            title: '門出の打ち上げ',
            place: 'izakaya',
            lines: [
              ...kadodeHead(s),
              '真壁（ふつう）「……メモ。最後のページ」',
              ...(s.flags.makabe_promise ? ['真壁（笑い）「……一言。言えた。袖、近かった」'] : []),
              `ナレーション：真壁が、メモ帳を1枚破って差し出した。いちばん上に「4月：${s.flags.nyugaku_ohayo ? 'おはようございます。声、でかい' : '見回してる人。わたしと、同じ'}」。いちばん下に「2月：おはようございます。言えた」。`,
              'ナレーション：裏返すと、もう1行だけあった。「来年も、隣の街灯」',
            ],
            choices: [
              { reply: '真壁（笑い）「……知ってる」', label: '「真壁、4月からも負けへんで」', hint: 'やる気＋' },
              { reply: '真壁（爆笑）「……ずるい」', label: 'メモに「真壁：しゃべらんのに一番うるさい」と書き足して返す', hint: 'ワード力＋' },
              { reply: ['真壁（笑い）「……かんぱい」', 'ナレーション：いちばん声の小さい真壁が、いちばん最初にグラスを上げた。座敷がいちばん笑った。'], label: '同期みんなで乾杯する', hint: '同期の結束＋' },
            ],
          },
    resolve: (s, c) => {
      const r = rivalOf(s)
      if (c === 0) {
        tie(s, r, 8)
        s.motivation = clamp(s.motivation + 8)
      } else if (c === 1) {
        tie(s, r, 8)
        gain(s, 'word', 3)
      } else {
        tie(s, r, 5)
        s.dokiBond = clamp(s.dokiBond + 5)
      }
    },
  },
}

// どの週に起きるか。固定イベントのない週を選んでいる
// 6/4・1/4 は月イチ寄席（live）の週。ストーリーはステージの前後どちらに出ても読めるようにしてある
// コントのとき「同じ組」、漫才のとき「41回目の更新」は、その大会に出た週のうちに起きる（engine.ts）
export const RIVAL_SCHEDULE: { month: number; week: number; key: string; style?: 'manzai' | 'conte'; when?: (s: GameState) => boolean }[] = [
  { month: 5, week: 4, key: 'rival_kouen' },
  { month: 6, week: 4, key: 'rival_sode', style: 'conte' },
  { month: 6, week: 4, key: 'rival_sode_mido', style: 'manzai' },
  { month: 9, week: 1, key: 'rival_bus' },
  { month: 11, week: 1, key: 'rival_waku' },
  { month: 1, week: 4, key: 'rival_jiko_ato', style: 'manzai', when: (s) => (s.counters.jiko ?? 0) > 0 },
  { month: 1, week: 4, key: 'rival_jiko_ato_makabe', style: 'conte', when: (s) => (s.counters.jiko ?? 0) > 0 },
  { month: 2, week: 1, key: 'rival_yoru' },
  { month: 2, week: 3, key: 'rival_kadode_ato', when: (s) => s.gradRank !== null },
]

// 大学お笑い・元会社員の書き分けがあれば、文と返しだけを差し替える（選択肢の効果は元の場面のまま）
export const RIVAL_STORIES: Record<string, StoryDef> = Object.fromEntries(
  Object.entries(BASE).map(([key, def]) => [
    key,
    {
      ...def,
      view: (s, p) => {
        const base = def.view(s, p)
        const v = rivalVariant(s, `${key}:${rivalOf(s)}`)
        if (!v) return base
        return { ...base, lines: v.lines, choices: base.choices.map((c, i) => ({ ...c, label: v.choices[i]?.label ?? c.label, reply: v.choices[i]?.reply ?? c.reply })) }
      },
    },
  ]),
)

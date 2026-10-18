import { affinity, classmatesOf, tie } from './bonds'
import { PARTNER_CANDIDATES } from './data/people'
import { clamp, count, gain, has, push, story } from './core'
import type { StoryDef } from './events'
import { KODAWARI, KODAWARI_KEYS, recall } from './kodawari'
import { makePartner, nextPartnerBase } from './partner'
import { scriptOf } from './partnerLines'
import { gradLines, gradPartnerLine } from './careers'
import type { GameState, Kodawari } from './types'

// 1年間の流れ（scenario/1年間の流れ.md）のうち、あとから足した行事
// 下敷き：research/01 公式の年間行事、02 卒業生の体験談、06 あるある
// セリフは台本の形：名前（表情）「…」／ナレーション：…

const me = (s: GameState) => s.player.callName
const pn = (s: GameState) => s.partner?.name ?? '相方'

// 相方が離れていく理由。相方ごとに違う【research/02・06】
const LEAVE_REASON: Record<string, { line: string; why: string }> = {
  向井: { line: '「地元に帰ろうと思う。親父の店、手伝わなあかんねん」', why: '地元に帰る' },
  堂島: { line: '「俺、作家なるねん。ネタ書く方が向いてる気がする」', why: '作家になる' },
  岸辺: { line: '「劇団から、戻ってこいって言われてる」', why: '劇団に戻る' },
  早瀬: { line: '「就職、決まってん。親に、もう1年は無理って言われた」', why: '就職する' },
  佐倉: { line: '「……就職しようと思う。断った会社が、もう一回受けてええって言うてくれてん」', why: '就職する' },
}

// 卒業式で左隣にいる同期。いちばん仲のいい同期（相方以外）
function leftNeighbor(s: GameState): string | undefined {
  const names: Record<string, string> = { mukai: '向井', dojima: '堂島', kishibe: '岸辺', hayase: '早瀬', mido: '御堂', makabe: '真壁' }
  const best = classmatesOf(s).sort((a, b) => affinity(s, b) - affinity(s, a))[0]
  return best && affinity(s, best) >= 35 ? names[best] : undefined
}

// 続けると決めたときの相方の一言（weekLog に出すので、名前なしの地の文に直す）
const PARTNER_STAY: Record<string, string> = {
  向井: '向井は親父さんに電話した。「あと1年だけ待って」。「1年でええんか」と笑われたらしい。',
  堂島: '堂島は作家の話を断った。「書くのは、お前の隣でええわ」',
  岸辺: '岸辺は主宰に断りの手紙を書いた。「笑わせる方が、性に合ってました」',
  早瀬: '早瀬は親に言った。「もう1年だけ、壁越しにネタ合わせさせてくれ」',
  佐倉: '佐倉は内定を断った。人事の人に「もったいない」と言われた。「知ってる」と思った。',
}

// 面談で答えたあとの辻堂の返し
const MENDAN_REPLY: Record<Kodawari, string[]> = {
  sainou: ['辻堂（ふつう）「試すんやったら、毎週書いてこい。書いてこんかったら、その日からお前は“言うてただけの人”や」'],
  kane: ['辻堂（ふつう）「正直でええ」', '辻堂（笑い）「ほな、売れるまでの1年は金ないで。覚悟しとけ」'],
  kyaku: ['辻堂（ふつう）「審査員も客やぞ」', '辻堂（笑い）「顔、納得してへんな。それでええ」'],
  nantonaku: ['辻堂（考え中）「……なんとなく、か」', 'ナレーション：辻堂が、ほんの少しだけ笑った。', '辻堂（ふつう）「なんとなくで1年残ったら、それはもう理由や」'],
}

export const YEAR_STORIES: Record<string, StoryDef> = {
  // 4月：相方見つけ会の結果。即結成／4時間で解散／誰も手を挙げない【research/02・06】
  aikata_kekka: {
    view: (s, p) => {
      const a = PARTNER_CANDIDATES[Number(p.a)].name
      const b = PARTNER_CANDIDATES[Number(p.b)].name
      const lines =
        p.o === 'soku'
          ? [
              `ナレーション：${a}の番。司会が「この人と組んでみたい人！」と聞く。`,
              `ナレーション：手を挙げたのは、${me(s)}だけだった。${a}も、${me(s)}の番で手を挙げてくれていた。`,
              `${a}（笑い）「組もうや、絶対おもろいって」`,
              'ナレーション：その場でコンビ結成。教室の後ろで、拍手がまばらに起きた。',
            ]
          : p.o === 'yon'
            ? [
                `ナレーション：${a}と手が挙がり合って、その場でコンビ結成。`,
                `ナレーション：その足でファミレスへ。ネタの方向性、ボケとツッコミ、どっちが書くか。`,
                `${a}（怒り）「いや、それはちゃうやろ」`,
                'ナレーション：4時間後、ドリンクバーのグラスが空のまま、解散した。',
                `ナレーション：帰り道、駅で${b}に声をかけられた。`,
                `${b}（照れ）「さっきの、見てた。……俺と、組まへん？」`,
              ]
            : [
                `ナレーション：${a}に手を挙げた。${a}は、別の人と組んだ。`,
                `ナレーション：${me(s)}の番。司会が「この人と組んでみたい人！」と聞く。誰も手を挙げなかった。`,
                'ナレーション：会が終わった教室に、余った人がぽつぽつ残っている。',
                `${b}（ふつう）「……余り同士、組んでみる？」`,
              ]
      return { title: '相方見つけ会', place: p.o === 'yon' ? 'famires' : 'kyoushitsu', lines, choices: [] }
    },
  },

  // 5月：毎月必ずある「わけのわからない」授業【research/02・06 カンフー、日舞】
  nazo_jugyo: {
    view: (s) => ({
      title: 'わけのわからない授業',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：時間割に「カンフー」とある。誰も理由を知らない。',
        'ナレーション：毎月必ず、こういう授業が1コマある。先月は日舞だった。',
        '三宅（爆笑）「真面目にやって！ 真面目にやってるのに、なんでふざけてるように見えるん！」',
        `${me(s)}（落ち込み）「……全力です」`,
      ],
      choices: [
        { reply: '三宅（爆笑）「型は完璧！ 顔がずっと面白い！ なんでや！」', label: '全力で型を決める', hint: '表現力＋・体力＋' },
        { reply: '三宅（爆笑）「それはもうカンフーちゃう、コントや！ 正解！」', label: 'ふざけて見えるのを逆に使う', hint: '対応力＋' },
      ],
    }),
    resolve: (s, c) => {
      tie(s, 'miyake', 3)
      if (c === 0) {
        gain(s, 'expr', 2)
        gain(s, 'stamina', 2)
      } else gain(s, 'adlib', 3)
    },
  },

  // 5月：個別面談。ここで主人公の「譲れないもの」が決まる【research/01 5月 個別面談】
  mendan: {
    view: (s) => ({
      title: '個別面談',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：小さな会議室。机の向こうに辻堂。面談は1人5分。',
        '辻堂（ふつう）「なんで芸人になろうと思った」',
        'ナレーション：ここで言ったことは、たぶん1年間ついて回る。',
        `${me(s)}（考え中）「……」`,
      ],
      choices: KODAWARI_KEYS.map((k) => ({ label: KODAWARI[k].answer, reply: MENDAN_REPLY[k] })),
    }),
    resolve: (s, c) => {
      s.kodawari = KODAWARI_KEYS[c] ?? 'nantonaku'
      tie(s, 'tsujido', 3)
    },
  },

  // 6月：張り切って仕切っていた同期が消える【research/02「5月、6月には別人のようにおとなしくなり、ひっそり辞めていく」】
  ikitteta: {
    view: (s) => ({
      title: '仕切っていた同期',
      place: 'rouka',
      lines: [
        'ナレーション：入学してすぐ、同期LINEを作り、最初の飲み会を仕切っていたのは鮫島だった。',
        'ナレーション：5月の終わりから、鮫島は急に静かになった。授業でも一番後ろに座るようになった。',
        'ナレーション：6月。ネタ見せの名簿から、鮫島の名前が消えた。同期LINEの管理人が、知らない名前に変わっていた。',
        '灰原（ふつう）「ああいう子が、一番早い。毎年そう」',
        `ナレーション：同期は${s.classmates}人になった。`,
      ],
      choices: [
        { reply: 'ナレーション：「元気？」とだけ送った。送信ボタンを押す指が、少し重かった。', label: '鮫島にLINEを送る', hint: '同期の結束＋・やる気−' },
        { reply: 'ナレーション：同期LINEの通知は、その日も200件を超えていた。', label: '送らない', hint: '度胸＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.dokiBond = clamp(s.dokiBond + 5)
        s.motivation = clamp(s.motivation - 4)
        s.weekLog.push('鮫島から返事が来た。「がんばってな」。それだけだった。')
      } else gain(s, 'guts', 2)
    },
  },

  // 7月：賞レース対策の授業【research/01 7月、ほやほやは2分・2分10秒でゴング】
  // 5月：体力と体調の違い、体調が悪いと本番で事故が起きること。最後に灰原と連絡先を交換する
  taichou: {
    view: (s) => ({
      title: '栄養ドリンク',
      place: 'rouka',
      lines: [
        'ナレーション：授業の前の廊下。灰原が壁にもたれて、栄養ドリンクを飲んでいた。',
        `灰原（ふつう）「${me(s)}、ちょっと。入学して最初に倒れるの、だいたいこの時期やから言うとくわ」`,
        '灰原（考え中）「“体力”と“体調”は別もんやで。体力は体の地力。鍛えたら上がるし、一晩では減らへん。体力ある人ほど疲れが溜まりにくい」',
        '灰原（ふつう）「体調は今週のコンディション。バイトや練習で減って、寝たら少し戻る。ちゃんと休んだら一気に戻る」',
        '灰原（怒り）「体調悪いまま舞台立ったら、噛むし、セリフ飛ぶ。小さいミスひとつで解散したコンビ、何組も見てきた」',
        `${me(s)}（考え中）「……どないしたらええんですか」`,
        '灰原（ふつう）「夜は寝る。それだけや。……あ、なんかあったら連絡し。番号、教えとくわ」',
        'ナレーション：灰原の連絡先が、スマホに入った。登録名を「灰原さん」にするか「助手先輩」にするか、少し迷った。',
      ],
      choices: [
        { reply: '灰原（笑い）「それ、毎晩言うてな」', label: '「今日から早く寝ます」', hint: '体調＋' },
        { reply: '灰原（ふつう）「ほな自主練で筋トレやな。地味やけど効くで」', label: '「体力つけます」', hint: '体力＋' },
      ],
    }),
    resolve: (s, c) => {
      tie(s, 'haibara', 2)
      s.flags.contact_haibara = true
      if (c === 0) s.condition = clamp(s.condition + 5)
      else gain(s, 'stamina', 2)
    },
  },

  taisaku: {
    view: (s) => ({
      title: '賞レース対策の授業',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：授業の前、灰原が教卓の横に立った。',
        '灰原（ふつう）「連絡。9月2週の強化合宿、参加費は4万円。出発の朝、集合場所で現金で払うんやで。払えん人は、バスに乗られへん」',
        '灰原（笑い）「去年、バイト代の振込が1日間に合わんで、置いていかれた人がおった。今から貯めとき」',
        'ナレーション：予選の季節。今日の授業は「2分ネタの作り方」。',
        '辻堂（ふつう）「1回戦の審査員は、1日に何百組も見る。最初の10秒で名前を覚えさせろ」',
        '辻堂（怒り）「2分10秒を超えたらゴング。どんだけおもろくても、そこで終わりや」',
        `${me(s)}（考え中）「最初の10秒……」`,
      ],
      choices: [
        { reply: '辻堂（ふつう）「10秒で名前。それだけ覚えて帰れ」', label: 'ツカミを作り直す', hint: 'ネタの完成度＋' },
        { reply: '辻堂（ふつう）「削った分だけ、残ったボケが強なる」', label: '削って2分に収める', hint: 'ワード力＋' },
        { reply: '辻堂（怒り）「……それで2秒使うてるやろ」', label: '「ツカミで“2分10秒です”って言います」', hint: '対応力＋・講師の評価−' },
      ],
    }),
    resolve: (s, c) => {
      tie(s, 'tsujido', 2)
      if (c === 0) {
        s.neta.polish = clamp(s.neta.polish + 8)
        count(s, 'tsukamiUke')
      } else if (c === 1) gain(s, 'word', 3)
      else {
        gain(s, 'adlib', 3)
        s.teacherEval = clamp(s.teacherEval - 2)
      }
    },
  },

  // 8月：夏休み特別授業。8〜10人の集団コント【research/01 夏休み特別授業、06 集団コント】
  natsu_jugyo: {
    view: (s) => ({
      title: '夏休み特別授業',
      place: 'butai',
      lines: [
        'ナレーション：夏休みの特別授業は、10人で1本の集団コント。役はくじで決まる。',
        `ナレーション：${me(s)}が引いたのは「死体」だった。セリフはない。`,
        '三宅（爆笑）「死体がいちばんおもろいコント、見てみたいなあ！」',
      ],
      choices: [
        { reply: '三宅（爆笑）「死体が一番ウケてる！ 主役、泣いてるで！」', label: '死体を極める', hint: '表現力＋＋' },
        { reply: '三宅（笑い）「交換成立！ 主役の子、死体役で寝てもうたけどな」', label: '主役の子と役を交換してもらう', hint: '度胸＋・ワード力＋' },
      ],
    }),
    resolve: (s, c) => {
      tie(s, 'miyake', 3)
      for (const id of classmatesOf(s)) tie(s, id, 2)
      if (c === 0) {
        gain(s, 'expr', 4)
      } else {
        gain(s, 'guts', 2)
        gain(s, 'word', 2)
      }
    },
  },

  // 10月：気づいたらあいつ来てない【research/02】
  kiteinai: {
    view: (s) => {
      const listed = (s.counters.dev_mukai ?? 0) >= 2
      return {
        title: '空いた席',
        place: 'kyoushitsu',
        lines: [
          'ナレーション：夏前まで、いつも隣で台本を読んでいた同期の席が空いている。',
          'ナレーション：いつから来ていないのか、思い出せない。名前も、すぐには出てこなかった。',
          ...(listed
            ? ['向井（落ち込み）「……あいつ、8月の終わりに辞めてる。名簿に線、引いといた」']
            : ['ナレーション：「気づいたらあいつ来てないな」。誰かがそう言って、それで終わった。']),
          `ナレーション：同期は${s.classmates}人になった。`,
        ],
        choices: [
          { reply: 'ナレーション：思い出せたのは、名字の最初の1文字だけだった。', label: '名前を思い出そうとする', hint: 'やる気＋' },
          { reply: 'ナレーション：台本の余白に、知らないうちに今日の日付を書いていた。', label: '自分の台本を読む', hint: 'ワード力＋' },
        ],
      }
    },
    resolve: (s, c) => {
      if (c === 0) {
        s.motivation = clamp(s.motivation + 5)
        tie(s, 'mukai', 4)
      } else gain(s, 'word', 2)
    },
  },

  // 10月：特進クラスの選抜。講師ごとに選ぶ顔ぶれが違う【research/01・02、06 選抜入りのコツは目立つこと】
  tokushin: {
    view: (s) => {
      const by = tokushinBy(s)
      return {
        title: '特進クラス',
        place: 'rouka',
        lines: [
          'ナレーション：講師ごとの特進クラスの名簿が、廊下に貼り出された。顔ぶれは講師によってまるで違う。',
          by
            ? `ナレーション：${by}の特進クラスに、${s.comboName}の名前があった。`
            : `ナレーション：どの名簿にも、${s.comboName}の名前はなかった。`,
          by === '辻堂'
            ? '辻堂（ふつう）「特進は何本やってもええ。3分超えてもええ。そのかわり、スベったら全員の前でスベる」'
            : by === '三宅'
              ? '三宅（笑い）「おめでとう！ ここからは褒めへんよ」'
              : 'ナレーション：特進に入った同期は、最前列に座って、一番にネタを出していた。',
        ],
        choices: by
          ? [
              { reply: '辻堂（ふつう）「一番に出したやつだけ、俺の機嫌がええ。覚えとけ」', label: '一番にネタを出す', hint: '度胸＋' },
              { reply: '三宅（笑い）「新ネタ大歓迎！ ……ここからは褒めへんけどな」', label: '新ネタを試す場にする', hint: '発想力＋' },
            ]
          : [
              { reply: 'ナレーション：最前列に座ると、辻堂の「おもんない」が少しだけ大きく聞こえた。', label: '次から最前列に座る', hint: '度胸＋・講師の評価＋' },
              { reply: 'ナレーション：自分のペース。それが一番難しいと分かったのは、もう少しあとだった。', label: '自分のペースでいく', hint: 'やる気＋' },
            ],
      }
    },
    resolve: (s, c) => {
      const by = tokushinBy(s)
      if (by) {
        s.flags.tokushin = true
        s.teacherEval = clamp(s.teacherEval + 5)
        tie(s, by === '辻堂' ? 'tsujido' : 'miyake', 5)
        if (c === 0) gain(s, 'guts', 3)
        else gain(s, 'idea', 3)
      } else if (c === 0) {
        gain(s, 'guts', 2)
        s.teacherEval = clamp(s.teacherEval + 3)
      } else s.motivation = clamp(s.motivation + 6)
    },
  },

  // 10月：学園祭【research/01 10月 学園祭イベント】
  gakuensai: {
    view: (s) => ({
      title: '学園祭',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：学園祭。教室は模擬店に、ホールは特設ステージになった。',
        `${pn(s)}（笑い）「たこ焼きの店、人手足りてへんらしいで。ステージの大喜利も、まだ枠空いてるって」`,
        'ナレーション：大喜利のお題が貼り出されている。「こんな養成所は嫌だ」。',
        `${me(s)}（考え中）「……入学式で“両隣いなくなる”って言われる」`,
        `${pn(s)}（ふつう）「それ、ほんまのことや」`,
      ],
      choices: [
        { reply: `${pn(s)}（笑い）「うまいやん！ 将来、たこ焼き屋で食っていけるで」`, label: 'たこ焼きを焼く', hint: 'お金＋・同期の結束＋' },
        { reply: `${pn(s)}（爆笑）「今の答え、客席の講師が一番笑ってたで」`, label: '大喜利のステージに出る', hint: '対応力＋・ファン＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.money += 3000
        s.dokiBond = clamp(s.dokiBond + 6)
        for (const id of classmatesOf(s)) tie(s, id, 3)
      } else {
        gain(s, 'adlib', 3)
        s.fans += 3
      }
    },
  },

  // 11月：三校対抗戦の選考。会社を辞めて親友と入った2人組【research/02 切手を貼り忘れた願書、他事務所の養成所との対抗戦】
  sankou: {
    view: (s) => {
      const chosen = s.classRank === 'matsu' || !!s.flags.tokushin
      return {
        title: '三校対抗戦',
        place: 'livehouse',
        lines: [
          'ナレーション：ネクスト笑劇スクール、東都演芸塾との三校対抗戦。出られるのは、各校から選ばれた数組だけ。',
          'ナレーション：選ばれた中に、会社を辞めて親友と入ってきた2人組「ワイシャツ同盟」がいた。',
          'ナレーション：願書の切手を貼り忘れて、一度送り返された2人だ。それでも「俺らほんまにおもろい」と言い続けていた。',
          chosen ? `ナレーション：そして、${s.comboName}も選ばれた。` : `ナレーション：${s.comboName}は、客席から観ることになった。`,
        ],
        choices: chosen
          ? [
              { reply: 'ナレーション：ワイシャツ同盟のネタは、ボケの数が少ないのに、一つ一つが長くウケていた。', label: '他校の組を研究する', hint: '発想力＋' },
              { reply: 'ナレーション：本番前日、ネタ合わせの回数が100を超えた。', label: '自分たちのネタを仕上げる', hint: 'ネタの完成度＋' },
            ]
          : [
              { reply: 'ナレーション：一番前の席で、ワイシャツ同盟の汗が飛んできた。', label: '一番前で観る', hint: '発想力＋' },
              { reply: 'ナレーション：遠くから笑い声が聞こえた。誰がウケたのかは、あとで知った。', label: '観ずにネタ合わせする', hint: 'ネタの完成度＋' },
            ],
      }
    },
    resolve: (s, c) => {
      const chosen = s.classRank === 'matsu' || !!s.flags.tokushin
      if (chosen) {
        s.staffEval = clamp(s.staffEval + 5)
        s.fans += 4
      }
      if (c === 0) gain(s, 'idea', 3)
      else s.neta.polish = clamp(s.neta.polish + 8)
    },
  },

  // 11月：前年ファイナリストの特別授業【research/01 11月 コント大会の特別授業】
  finalist: {
    view: (s) => ({
      title: 'ファイナリストの授業',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：特別授業の講師は、去年のコント頂ファイナリスト。テレビで観た顔が、教室の前に立っている。',
        'ナレーション：「決勝でやったネタは、1回戦と同じネタです。100回やって、100回直しました」',
        `${me(s)}（驚き）「同じネタを、100回……」`,
        'ナレーション：「101回目は、決勝の翌日にやりました。スベりました」。教室が、今日いちばん笑った。',
      ],
      choices: [
        { reply: 'ナレーション：「いい質問ですね。……答えは、100回やれば分かります」。教室がまた笑った。', label: '手を挙げて質問する', hint: '度胸＋' },
        { reply: 'ナレーション：メモは3ページになった。いちばん大きく書いたのは「直す」の2文字だった。', label: 'ひたすらメモを取る', hint: 'ネタの完成度＋' },
        { reply: 'ナレーション：ファイナリストは本当にやった。102回目は、ウケた。', label: '「102回目、ここでやってください」', hint: '対応力＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) gain(s, 'guts', 3)
      else if (c === 1) s.neta.polish = clamp(s.neta.polish + 8)
      else {
        gain(s, 'adlib', 3)
      }
    },
  },

  // 12月：譲れないものが真正面から試される。中身は譲れないものごとに違う
  // 選択肢は どれも「0＝曲げる／1＝守る」の並び（kodawari.ts の HOOKS.shiren）
  shiren: {
    view: (s) => {
      const k = s.kodawari ?? 'nantonaku'
      const m = me(s)
      const v = {
        sainou: {
          title: '譲られたネタ',
          place: 'gakuya',
          lines: [
            'ナレーション：楽屋。大河内が、黄ばんだ台本を差し出した。',
            '大河内（ふつう）「これ、お前らにやる。俺がやったら18年前から一回もスベってへん鉄板や。もう俺はやらん」',
            `${m}（驚き）「……ええんですか」`,
            '大河内（笑い）「東西でも門出でも使え。ただ、ガラケーのくだりだけは直せよ」',
            ...recall(s),
          ],
          choices: [
            { reply: '大河内（笑い）「おう。スベったら俺のせいにしてええ。ウケたら自分の手柄にせえ」', label: 'ありがたく使わせてもらう', hint: 'ネタの完成度＋＋' },
            { reply: '大河内（笑い）「……生意気やな。俺も18年前、同じこと言うたわ」', label: '「自分で書いたやつで、勝ちたいです」', hint: '発想力＋' },
          ],
        },
        kyaku: {
          title: '審査員の好み',
          place: 'kyoushitsu',
          lines: [
            'ナレーション：東西寄席合戦の前。審査員をやる構成作家が、ネタを見て言った。',
            'ナレーション：「お客さんは笑うよ。でも、審査員は点を入れない。こっちの細かいボケに変えたら、点は取れる」',
            'ナレーション：細かいボケに変えた台本では、客席の後ろの方は、たぶん笑わない。',
            `${m}（考え中）「……」`,
            ...recall(s),
          ],
          choices: [
            { reply: 'ナレーション：「いいね、点は取れる」。構成作家は、ペンで丸をつけた。', label: '審査員向けに作り変える', hint: '講師の評価＋・社員の評価＋' },
            { reply: 'ナレーション：構成作家は少し笑って、「じゃあ、後ろの客を見とくよ」と言った。', label: '客席の一番後ろが笑う方を取る', hint: 'ファン＋・表現力＋' },
          ],
        },
        kane: {
          title: '正社員の話',
          place: 'baito',
          lines: [
            'ナレーション：バイトの閉店後。店長が、珍しくまじめな顔で座った。',
            '店長（ふつう）「4月から、正社員にならへんか。給料も上がる。まかないは食べ放題や」',
            '店長（笑い）「ライブの日は……まあ、月1回くらいなら休んでええ」',
            'ナレーション：通帳の残高を思い出した。正社員の給料なら、来年は家賃の心配をしなくていい。',
            ...recall(s),
          ],
          choices: [
            { reply: '店長（ふつう）「おう。急がんでええ。席は空けとくわ」', label: '「考えさせてください」', hint: 'お金＋' },
            { reply: '店長（爆笑）「言うたな！ ほな売れるまで、まかないはおかわり1回までや」', label: '「まかない食べ放題は、売れてからにします」', hint: 'やる気＋' },
          ],
        },
        nantonaku: {
          title: '辞める同期',
          place: 'izakaya',
          lines: [
            'ナレーション：同期の飲み会の帰り。来月で辞めるという同期が、駅まで並んで歩いた。',
            'ナレーション：「なあ、一緒に辞めへん？ 叔父さんの会社、もう1人ぐらいなら入れるって」',
            'ナレーション：「面談で“なんとなく”って言うてたやん。俺もなんとなくで入って、なんとなく辞めるねん」',
            `${m}（考え中）「……」`,
            ...recall(s),
          ],
          choices: [
            { reply: 'ナレーション：「ほな、連絡して」。同期は改札の向こうで手を振った。', label: '「……ちょっと考える」', hint: 'お金＋' },
            { reply: 'ナレーション：同期は笑った。「なんやそれ。……ほな、売れたら自慢させてな」', label: '「なんとなく、まだ辞めへん」', hint: 'やる気＋' },
          ],
        },
      }[k]
      return { ...v, choices: v.choices }
    },
    resolve: (s, c) => {
      const k = s.kodawari ?? 'nantonaku'
      if (k === 'sainou') {
        if (c === 0) s.neta.polish = clamp(s.neta.polish + 12)
        else gain(s, 'idea', 4)
      } else if (k === 'kyaku') {
        if (c === 0) {
          s.teacherEval = clamp(s.teacherEval + 6)
          s.staffEval = clamp(s.staffEval + 6)
        } else {
          s.fans += 6
          gain(s, 'expr', 3)
        }
      } else if (c === 0) {
        s.money += 20000
      } else {
        s.motivation = clamp(s.motivation + 10)
        if (k === 'kane') tie(s, 'tencho', 4)
      }
    },
  },

  // 12月：ほやほやでのセリフ飛び事故（物語の軸の山場）【research/02 小さなセリフミスで決裂、06 ネタを飛ばした相方を責めたら3時間無視】
  jiko: {
    view: (s) => ({
      title: 'セリフが飛んだ',
      place: 'butai',
      lines: [
        'ナレーション：12月のほやほや。ネタの真ん中、いちばんの見せ場の手前。',
        ...(scriptOf(s)?.flub(me(s)) ?? []),
        `ナレーション：${pn(s)}の口が止まった。セリフが飛んだ。`,
        'ナレーション：1秒、2秒、3秒。客席の空気が、すっと冷えていくのがわかる。',
        `${pn(s)}（驚き）「……」`,
      ],
      choices: [
        { reply: `${pn(s)}（驚き）「……！」`, label: 'アドリブで拾う', hint: '対応力しだい' },
        { reply: `${pn(s)}（笑い）「……もう一回最初からやな！」`, label: '「もう一回最初から言うて！」と頭からやり直す', hint: '度胸しだい' },
        { reply: `${pn(s)}（落ち込み）「……」`, label: '黙って待つ' },
        { reply: `${pn(s)}（爆笑）「お前の頭の方が飛んどるわ！」`, label: '「飛んでんのはお前の頭や！」と客席に向かって言う', hint: '対応力しだい・関係値−' },
      ],
    }),
    resolve: (s, c, rng) => {
      const saved = c === 0 ? s.stats.adlib + rng.int(0, 40) >= 60 : c === 1 ? s.stats.guts + rng.int(0, 40) >= 65 : c === 3 ? s.stats.adlib + rng.int(0, 50) >= 70 : false
      if (c === 3 && s.partner) s.partner.bond = clamp(s.partner.bond - 5)
      s.flags.jiko_saved = saved
      count(s, 'jiko')
      if (saved) {
        s.fans += 3
        gain(s, c === 0 ? 'adlib' : 'guts', 3)
        s.weekLog.push(c === 0 ? 'とっさのツッコミで、いちばん大きい笑いが起きた。' : c === 1 ? '「もう一回」で客席がどっと沸いた。事故が見せ場になった。' : '客席が爆発した。相方だけが、笑っていなかった。')
      } else s.weekLog.push('そのまま最後までネタをやった。拍手は、まばらだった。')
      story(s, 'jiko_yoru')
    },
  },
  jiko_yoru: {
    view: (s) =>
      s.flags.jiko_saved
        ? {
            title: '打ち上げの帰り道',
            place: 'ekimae',
            lines: [
              'ナレーション：打ち上げの帰り道。駅までの坂を、2人で歩く。',
              ...(scriptOf(s)?.saved ?? [`${pn(s)}（照れ）「さっきは……ごめん。助かった」`]),
              `${me(s)}（笑い）「飛ばしたとこがいちばんウケたな」`,
            ],
            choices: [
              { reply: `${pn(s)}（笑い）「……ほな、毎回飛ばさなあかんやん」`, label: '「あの流れ、ネタに入れよか」', hint: 'ネタの完成度＋・関係値＋' },
              { reply: `${pn(s)}（落ち込み）「……うん。分かってる」`, label: '「次は飛ばすなよ」と釘を刺す', hint: '関係値−' },
            ],
          }
        : {
            title: '打ち上げに行けない夜',
            place: 'kouen',
            lines: [
              'ナレーション：終演後。同期が打ち上げに向かう中、2人だけが楽屋口に残った。',
              `${pn(s)}（落ち込み）「……」`,
              scriptOf(s)?.cold ?? `ナレーション：${pn(s)}は何も言わず、振り返りもせずに帰っていった。`,
              `ナレーション：${me(s)}は、劇場の裏の公園のベンチで、しばらく動けなかった。`,
              'ナレーション：SNSには、打ち上げで笑う同期の写真が流れてくる。',
              ...recall(s),
            ],
            choices: [
              { reply: `${pn(s)}（驚き）「……なんで、そっちが謝んねん」`, label: '追いかけて、先に謝る', hint: '関係値＋' },
              { reply: 'ナレーション：送信してから、言い方を3回後悔した。', label: '「なんで飛ばすねん」とLINEを送る', hint: '関係値−' },
              { reply: 'ナレーション：始発の時間。ベンチの横に、缶コーヒーが1本置いてあった。', label: 'ベンチに座ったまま朝を待つ', hint: 'やる気−' },
            ],
          },
    resolve: (s, c) => {
      if (!s.partner) return
      if (s.flags.jiko_saved) {
        if (c === 0) {
          s.partner.bond = clamp(s.partner.bond + 10)
          s.neta.polish = clamp(s.neta.polish + 6)
        } else {
          s.partner.bond = clamp(s.partner.bond - 3)
        }
        return
      }
      if (c === 0) {
        s.partner.bond = clamp(s.partner.bond + 12)
        s.weekLog.push(`駅のホームで追いついた。${s.partner.name}は「……俺もごめん」とだけ言った。`)
      } else if (c === 1) {
        s.partner.bond = clamp(s.partner.bond - (has(s, 'aikata') ? 8 : 20))
        s.weekLog.push('既読はついた。返事は3日来なかった。')
      } else {
        s.partner.bond = clamp(s.partner.bond - 6)
        s.motivation = clamp(s.motivation - 10)
        s.weekLog.push('始発で帰った。ネタ帳を開いたが、何も書けなかった。')
      }
    },
  },

  // 1月：東西寄席合戦のホーム戦【research/01 1月 東西対抗戦（東京会場）】
  tozai_home: {
    view: (s) => ({
      title: '東西寄席合戦（ホーム戦）',
      place: 'butai',
      lines: s.flags.tozai_chosen
        ? ['ナレーション：東西寄席合戦、今度はホーム。客席には同期の顔が見える。', `ナレーション：アウェイで負けた分を、ここで返す。${s.comboName}の出番は3番目。`]
        : ['ナレーション：東西寄席合戦、ホーム戦。差し入れ係として袖から観た舞台は、客席から観るより、ずっと明るかった。'],
      choices: [],
    }),
    resolve: (s) => {
      if (s.flags.tozai_chosen) push(s, { type: 'stage', kind: 'tozai' })
      else gain(s, 'idea', 2)
    },
  },

  // 1月：前年王者の凱旋授業【research/01 1月 漫才大会の特別授業】
  gaisen: {
    view: (s) => ({
      title: '凱旋授業',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：去年の漫才天下一の王者が、母校に凱旋した。卒業して8年目のコンビだ。',
        'ナレーション：「僕ら、在学中はずっと一番下のクラスでした。選抜も一回も入ってません」',
        'ナレーション：教室の後ろの方で、梅組の何人かが顔を上げた。',
        `${me(s)}（考え中）「8年……」`,
      ],
      choices: [
        { reply: 'ナレーション：「辞める理由が、ネタにならなかったからです」。王者は少しも笑わずに言った。', label: '「なんで辞めなかったんですか」と聞く', hint: 'やる気＋' },
        { reply: 'ナレーション：書き写してみると、ボケは思ったより少なかった。', label: '王者のネタの構成を書き写す', hint: 'ワード力＋・発想力＋' },
        { reply: 'ナレーション：「待ってます。8年は長いですよ」。教室が少しだけ笑った。', label: '「8年後、ここに凱旋しに来ます」と宣言する', hint: '度胸＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.motivation = clamp(s.motivation + 10)
      } else if (c === 1) {
        gain(s, 'word', 2)
        gain(s, 'idea', 2)
      } else {
        gain(s, 'guts', 3)
      }
    },
  },

  // 1月：興行実践ライブ。班で企画から作る【research/02 作家志望と組み、意見がぶつかる】
  kougyou: {
    view: (s) => ({
      title: '興行実践ライブ',
      place: 'livehouse',
      lines: [
        'ナレーション：卒業前の課題は、班ごとにライブを1本作ること。企画、構成、出演、全部自分たちで。',
        ...(s.partner?.name === '堂島'
          ? ['ナレーション：同じ班には作家志望の子がいた。台本の直しが細かい。', 'ナレーション：「そこは削った方がええって。オチが2個あったら、どっちも弱なる」']
          : ['ナレーション：同じ班には、作家もやりたいと言い出した堂島がいた。台本の直しが細かい。', '堂島（怒り）「そこは削った方がええって。オチが2個あったら、どっちも弱なる」']),
        `${me(s)}（怒り）「どっちも要るねん」`,
      ],
      choices: [
        { reply: 'ナレーション：構成表を書いたら、自分の出番が一番短くなっていた。', label: '企画と構成に回る', hint: '発想力＋・ワード力＋' },
        { reply: 'ナレーション：出演に専念した。一番ウケたのは、台本になかった一言だった。', label: '出演に専念する', hint: '表現力＋' },
        { reply: 'ナレーション：本番、オチは2つとも残した。2つ目の方が、少しだけウケた。', label: '意見を曲げない', hint: '度胸＋' },
      ],
    }),
    resolve: (s, c) => {
      tie(s, 'dojima', 4)
      if (c === 0) {
        gain(s, 'idea', 2)
        gain(s, 'word', 2)
      } else if (c === 1) gain(s, 'expr', 3)
      else {
        gain(s, 'guts', 2)
      }
      s.weekLog.push('終演後、講師からのダメ出しは1時間続いた。')
    },
  },

  // 2月：最後の決断。続ける／組み直す／ピン（物語の軸）
  ketsudan: {
    view: (s) => {
      const p = s.partner
      if (!p) return { title: '4月から', place: 'heya', lines: ['ナレーション：卒業まであと少し。ひとりで、4月からのネタを書いた。'], choices: [] }
      const leaving = p.bond < 35
      const reason = LEAVE_REASON[p.name] ?? LEAVE_REASON['佐倉']
      const next = nextPartnerBase(s).name
      return {
        title: '4月から',
        place: 'famires',
        lines: leaving
          ? [
              `ナレーション：深夜のファミレス。${p.name}が、ドリンクバーのグラスを置いた。`,
              `${p.name}（落ち込み）「話あんねん」`,
              `${p.name}（落ち込み）${reason.line}`,
              `ナレーション：同じ週、${next}から電話があった。「もし、ひとりになるんやったら……」`,
              ...recall(s),
            ]
          : [
              `ナレーション：深夜のファミレス。${p.name}が、4月からのライブの予定表を広げた。`,
              `${p.name}（笑い）「4月から、劇場のオーディション全部出よな」`,
              `${me(s)}（ふつう）「……」`,
            ],
        choices: leaving
          ? [
              { reply: 'ナレーション：ドリンクバーの氷が溶ける音だけが、しばらく続いた。', label: `${p.name}を引き止める`, hint: '関係値しだい' },
              { reply: `${next}（笑い）「よろしく。……ネタ合わせ、明日からでええ？」`, label: `${next}と組み直す` },
              { reply: 'ナレーション：ひとりで帰る道は、思っていたより静かだった。', label: 'ピンでやっていく' },
            ]
          : [
              { reply: `${p.name}（爆笑）「全部や！ 全部落ちても、全部出る！」`, label: '「全部出よう」', hint: '関係値＋' },
              { reply: `${p.name}（驚き）「……そうか。……ちょっと、考えさせて」`, label: '「ピンでやってみたい」と切り出す' },
            ],
      }
    },
    resolve: (s, c, rng) => {
      const p = s.partner
      if (!p) return
      const leaving = p.bond < 35
      const stay = leaving ? c === 0 && p.bond + rng.int(0, 40) >= 50 : c === 0
      if (stay) {
        p.bond = clamp(p.bond + 10)
        if (leaving) s.weekLog.push(`${p.name}は、もう1年だけやると言った。「お前がそこまで言うなら」`)
        const stayLine = PARTNER_STAY[p.name]
        if (stayLine) s.weekLog.push(stayLine)
        return
      }
      if (leaving && c === 0) s.weekLog.push(`${p.name}の気持ちは変わらなかった。「${LEAVE_REASON[p.name]?.why ?? '辞める'}」と決めていた。`)
      const pin = leaving ? c === 2 || (c === 0 && rng.chance(0.5)) : true
      if (pin) {
        s.flags.pin = true
        s.partner = null
        s.comboName = s.player.name
        s.weekLog.push('ピン芸人として卒業することにした。コンビ名の欄に、自分の名前を書いた。')
      } else {
        const next = nextPartnerBase(s)
        s.partner = makePartner(next, s, 45)
        count(s, 'kaisan')
        s.flags.reform = true
        s.weekLog.push(`${next.name}と組み直した。「笑いのツボが同じ」。卒業公演が終わったら、新しいコンビ名を決める。`)
      }
    },
  },

  // 3月：出席が足りない人の救済【research/02 卒業ライブの手伝いで卒業資格】
  kyusai: {
    view: (s) => ({
      title: '卒業認定',
      place: 'rouka',
      lines: [
        'ナレーション：卒業認定の掲示。名前の横に「出席不足」の赤い字。',
        '灰原（ふつう）「卒業公演の裏方、全部手伝ったら卒業資格あげるって。毎年1人か2人おるねん」',
        `${me(s)}（落ち込み）「……やります」`,
      ],
      choices: [],
    }),
    resolve: (s) => {
      s.condition = clamp(s.condition - 10)
      tie(s, 'haibara', 6)
      s.weekLog.push('照明と転換と受付を全部やった。卒業公演は、袖から観た。')
    },
  },

  // 3月：卒業式。入学式と同じ講堂で、隣の席を見る（物語の軸の結末）
  sotsugyo: {
    view: (s) => {
      const left = leftNeighbor(s)
      const p = s.partner
      return {
        title: '3月 卒業',
        place: 'koudou',
        lines: [
          'ナレーション：3月。卒業式は、入学式と同じ講堂だった。',
          `ナレーション：入学式で300人いた同期は、${s.classmates}人になった。空いた席の方が多い。`,
          '灰原（笑い）「ほら。両隣、見てみ」',
          ...gradLines(s),
          p
            ? `ナレーション：右隣には${p.name}が座っていた。${s.flags.reform ? '組み直して、まだひと月。' : (gradPartnerLine(s) ?? '4月の相方見つけ会から、ずっと隣にいた。')}`
            : 'ナレーション：右隣の席は、空いていた。ピンで残ることを選んだ。',
          ...(p ? [scriptOf(s)?.grad ?? `${p.name}（笑い）「なんや、じろじろ見て」`] : []),
          left ? `ナレーション：左隣には${left}。最後まで、ここに残った。` : 'ナレーション：左隣も、空いていた。',
          s.flags.audition_3 ? 'ナレーション：卒業公演「巣立ち」では、その他大勢として舞台の端で踊った。' : 'ナレーション：卒業公演「巣立ち」。バトルではない。思い出という感じだった。',
          ...(affinity(s, 'mido') >= 35
            ? [
                s.player.background === 'circle'
                  ? '御堂（笑い）「卒業おめでとう。……4月からは、シードなしの同業者だね」'
                  : s.player.background === 'salaryman'
                    ? '御堂（笑い）「卒業おめでとう。……4月からは、ただの同業者だね」'
                    : '御堂（笑い）「卒業おめでとう。……4月からは、ただの同業者だね」',
              ]
            : []),
          ...(affinity(s, 'makabe') >= 35
            ? [
                s.player.background === 'circle'
                  ? '真壁（笑い）「……メモ帳。あなたのページ、学祭から、まだ続く」'
                  : s.player.background === 'salaryman'
                    ? '真壁（笑い）「……メモ帳。スーツの人のページ、まだ続きます」'
                    : '真壁（笑い）「……メモ帳。あなたのページ、まだ続く」',
              ]
            : []),
          ...(s.kodawari ? [`ナレーション：「${KODAWARI[s.kodawari].label}」。面談でそう言ってから、11か月がたった。`] : []),
          'ナレーション：所属説明会。4月から、大笑興業の芸人になる。',
        ],
        choices: [],
      }
    },
    resolve: (s) => {
      s.phase = 'result'
    },
  },
}

// 特進クラスに選ばれるか。講師ごとに好みが違う（辻堂は評価、三宅は仲の良さ）
function tokushinBy(s: GameState): '辻堂' | '三宅' | undefined {
  if (s.teacherEval >= 50 || (s.teacherEval >= 40 && affinity(s, 'tsujido') >= 40)) return '辻堂'
  if (affinity(s, 'miyake') >= 40 && s.teacherEval >= 30) return '三宅'
  return undefined
}

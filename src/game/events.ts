import { DEV_STORIES, affinity, classmatesOf, tie } from './bonds'
import { kodawariOf } from './kodawari'
import { PARTNER_STORIES } from './partnerLines'
import { YEAR_STORIES } from './yearEvents'
import { CARDS } from './data/cards'
import { PARTNER_CANDIDATES } from './data/people'
import { clamp, count, gain, has, push, story, yen } from './core'
import { makePartner, splitUp } from './partner'
import type { Rng } from './rng'
import type { GameState } from './types'

export interface Choice {
  label: string
  hint?: string
}

export interface StoryView {
  title: string
  lines: string[]
  choices: Choice[] // 空なら「次へ」だけ
  place?: string // 背景（bg_◯◯）。なければ題名と行の言葉から選ぶ
  input?: { placeholder: string; suggestions: string[] }
}

export interface StoryDef {
  view: (s: GameState, p: Record<string, string | number>) => StoryView
  // choice は選んだ番号。input があるイベントでは text に入力値が入る
  resolve?: (s: GameState, choice: number, rng: Rng, p: Record<string, string | number>, text?: string) => void
}

function seniorName(s: GameState, id: string | number | undefined): string {
  return s.seniors.find((x) => x.id === id)?.name ?? '先輩'
}

export const STORIES: Record<string, StoryDef> = {
  nyugaku: {
    view: (s) => ({
      title: '入学式',
      lines: [
        `大笑芸能学院、入学式。同期は${s.classmates}人。スーツの人もいれば、さっき起きたばかりのスウェットの人もいる。`,
        '壇上に1期上の「助手先輩」が並ぶ。灰原という先輩がマイクを持った。',
        '「今はたくさんいるけど、マジで今、自分の両隣にいる人、いなくなるから」',
        '校則：授業の20分前にいなければ遅刻。挨拶は時間に関係なく「おはようございます」。生徒同士の恋愛は禁止。',
      ],
      choices: [{ label: '「おはようございます！」と声を張る', hint: '度胸＋' }, { label: '黙って周りを見回す', hint: '発想力＋' }],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        gain(s, 'guts', 2)
        s.seniors[0].like += 3
      } else gain(s, 'idea', 2)
    },
  },
  jissai: {
    view: (s) => ({
      title: '「実質、芸歴9年やろ」',
      lines: [
        `最初の授業で、講師が名簿を見て言った。「${s.player.callName}と${s.partner?.name}、大学でずっとやってたんやろ。4年もやってたら、もう芸歴9年やで」`,
        '周りの同期の視線が刺さる。期待されているのか、試されているのか。',
      ],
      choices: [{ label: '「そんなことないです」と笑う', hint: '先輩の印象＋' }, { label: '「見ててください」と言い切る', hint: 'やる気＋・尖り＋' }],
    }),
    resolve: (s, c) => {
      s.teacherEval += 5
      if (c === 0) s.safePlay += 1
      else {
        s.motivation = clamp(s.motivation + 8)
        s.edge += 5
      }
    },
  },
  aikata_kai: {
    view: (_s, p) => {
      const ids = [Number(p.c0), Number(p.c1), Number(p.c2)]
      return {
        title: '相方見つけ会',
        lines: [
          '教室に100人近くが集まる。司会は先輩芸人。まるでお見合いパーティー。',
          '自己紹介カードには「ボケ希望かツッコミ希望か」「ネタを書きたいか、書いてほしいか」。',
          '前に出た人に、司会が「この人と組んでみたい人、手を挙げて！」と聞いていく。',
          ...ids.map((i) => `・${PARTNER_CANDIDATES[i].name}：${PARTNER_CANDIDATES[i].blurb}`),
        ],
        choices: ids.map((i) => ({ label: `${PARTNER_CANDIDATES[i].name}に手を挙げる` })),
      }
    },
    resolve: (s, c, rng, p) => {
      const ids = [Number(p.c0), Number(p.c1), Number(p.c2)]
      const a = ids[c]
      const b = ids[(c + 1) % 3]
      // 手を挙げ返してもらえるか。挙げ返してもらえても、その日のうちに解散することがある【research/02・06 4時間で解散】
      const o = rng.chance(0.55 + s.stats.guts / 200) ? (rng.chance(0.2) ? 'yon' : 'soku') : 'dare'
      s.partner = makePartner(PARTNER_CANDIDATES[o === 'soku' ? a : b], s, o === 'soku' ? 40 : 30)
      if (o === 'yon') count(s, 'yonjikan')
      story(s, 'aikata_kekka', { o, a, b })
      story(s, 'combo_name')
    },
  },
  combo_name: {
    view: (s) => ({
      title: 'コンビ名を決める',
      lines: [
        `${s.partner?.name}と、ファミレスでコンビ名を出し合う。お互い20案ずつ出して、かぶったのは1つだけ。`,
        'カタカナかひらがなかで、そこから2時間揉めた。',
      ],
      choices: [],
      input: { placeholder: 'コンビ名', suggestions: ['ニッチモサッチモ', 'ドロップキック', 'かもめ食堂', '2700ミリ', 'ミッドナイト短パン'] },
    }),
    resolve: (s, _c, _r, _p, text) => {
      s.comboName = (text ?? '').trim() || 'ニッチモサッチモ'
      s.weekLog.push(`コンビ名は「${s.comboName}」に決まった。`)
    },
  },
  queue: {
    view: () => ({
      title: 'ネタ見せの順番',
      lines: ['ネタ見せは並んだ順。授業時間内に見てもらえるのは15組前後。', '後の順番ほど講師がヒートアップして、当たりが強くなる。何時に並ぶ？'],
      choices: [
        { label: '2時間前から最前列に並ぶ', hint: '体調−・講師の機嫌＋' },
        { label: '1時間前に並ぶ', hint: '体調−' },
        { label: 'ギリギリに行く' },
        { label: 'わざと列の後ろに並ぶ', hint: '見てもらえないかも' },
      ],
    }),
    resolve: (s, c, rng) => {
      s.queueChoice = (['early2', 'early1', 'late', 'last'] as const)[c]
      if (c === 0) s.condition = clamp(s.condition - 8)
      if (c === 1) s.condition = clamp(s.condition - 4)
      if (has(s, 'chikoku') && c >= 2 && rng.chance(0.3)) {
        s.queueChoice = 'last'
        s.weekLog.push('寝坊した。着いた頃には列が階段の下まで伸びていた。')
      }
    },
  },
  orei: {
    view: (s, p) => ({
      title: 'ごちそうさまでした',
      lines: [
        `昨日は${seniorName(s, p.senior)}さんにごちそうになった。`,
        'お礼は3回が鉄則。別れ際に直接、翌朝にメッセージ、次に会ったときは開口一番「この前はご馳走様でした」。',
      ],
      choices: [{ label: '翌朝一番にお礼を送る' }, { label: '二日酔いで昼まで寝てしまう' }],
    }),
    resolve: (s, c, _r, p) => {
      const senior = s.seniors.find((x) => x.id === p.senior)
      if (!senior) return
      if (c === 0) {
        senior.like = clamp(senior.like + 3)
        count(s, 'orei')
      } else {
        senior.like = clamp(senior.like - 6)
        s.weekLog.push(`${senior.name}さんへのお礼が昼過ぎになった。返事は「おう」だけだった。`)
      }
    },
  },
  contest_entry: {
    view: (_s, p) => ({
      title: p.kind === 'contest_conte' ? 'コント頂のエントリー' : '漫才天下一のエントリー',
      lines: [
        p.kind === 'contest_conte'
          ? 'コントの大会「コント頂」の予選が始まる。在学生でもエントリーできる。'
          : '漫才の大会「漫才天下一」の1回戦。結成15年以内ならプロもアマも出られる。2分ネタ。',
        '在学中に勝ち上がると、講師の評価が大きく上がるらしい。エントリー料はコンビで2,000円。',
      ],
      choices: [{ label: 'エントリーする', hint: '2,000円' }, { label: '今年は見送る' }],
    }),
    resolve: (s, c, _r, p) => {
      if (c === 0) {
        s.money -= 2000
        push(s, { type: 'stage', kind: p.kind as 'contest_conte' | 'contest_manzai' })
      }
    },
  },
  gasshuku: {
    view: () => ({
      title: '夏の強化合宿',
      lines: ['東西合同、2泊3日。参加費は4万円で自由参加。', '行きのバスの割り振りが、秋のクラス替えと関係しているという噂がある。'],
      choices: [{ label: '行く', hint: '40,000円' }, { label: 'お金がないので行かない' }],
    }),
    resolve: (s, c, rng) => {
      if (c === 1) {
        s.weekLog.push('合宿に行かなかった。SNSに流れてくる合宿の写真を、バイト先の休憩室で見た。')
        return
      }
      s.money -= 40000
      s.dokiBond = clamp(s.dokiBond + 10)
      for (const id of classmatesOf(s)) tie(s, id, 6)
      for (const k of ['idea', 'expr', 'adlib'] as const) gain(s, k, 3)
      s.weekLog.push(
        s.teacherEval >= 55
          ? '行きのバスの隣は、ネタ見せでいつも上位の組ばかりだった。'
          : '行きのバスは、名前もよく知らない同期ばかりの最後尾だった。',
      )
      const avg = (s.stats.idea + s.stats.expr + s.stats.adlib + s.stats.guts) / 4
      if (avg + rng.int(0, 20) >= 55) {
        s.weekLog.push('最終日、合宿MVPに選ばれた。「MVPは必ず売れる」というジンクスがあるらしい。')
        s.motivation = clamp(s.motivation + 15)
        s.staffEval = clamp(s.staffEval + 10)
        count(s, 'mvp')
      }
    },
  },
  compliance: {
    view: () => ({
      title: 'コンプライアンス講習',
      lines: ['警察関係の人が来て、事務所を通さない仕事の危なさについて話した。', '「知り合いの知り合いからの仕事は、まず疑ってください」'],
      choices: [],
    }),
  },
  class_change: {
    view: (s) => ({
      title: 'クラス替え',
      lines: [
        '夏を過ぎて、ネタ見せの授業だけ実力別のクラスになった。松組は10組前後、竹組は15組前後、梅組はそれ以外の100組以上。',
        `${s.comboName}は「${{ none: '-', ume: '梅組', take: '竹組', matsu: '松組' }[s.classRank]}」。`,
        s.classRank === 'ume' ? '梅組の授業は、空気からしてなんだか悪い。' : '名前を覚えてもらえるようになってきた。',
        '昇格・降格は毎月。コンビを解散すると自動的に梅組に落ちる。',
      ],
      choices: [],
    }),
  },
  hikari_kage: {
    view: (s) => ({
      title: '光と影',
      lines: [
        `同期は${s.classmates}人になった。`,
        s.classRank === 'matsu'
          ? '授業後の溜まり場で、梅組の同期が少し距離を取るようになった。「あいつらは松組だから」。'
          : '松組の同期が、先輩の単独ライブに呼ばれたらしい。「あいつらは松組だから」と言い訳したくなる。',
        '一度も選抜に入らなかった人が、後で大会の決勝に行くこともある。そう信じるしかない。',
      ],
      choices: [],
    }),
  },
  tozai_select: {
    view: (s) => ({
      title: '東西寄席合戦の選考',
      lines:
        s.classRank === 'matsu'
          ? ['東西の養成所の対抗戦。出られるのは選抜された数組だけ。', `${s.comboName}が選ばれた。`]
          : ['東西の養成所の対抗戦。出られるのは選抜された数組だけ。', '選ばれたのは松組の組だった。客席から観た。'],
      choices: [],
    }),
    resolve: (s) => {
      if (s.classRank === 'matsu') {
        s.flags.tozai_chosen = true
        push(s, { type: 'stage', kind: 'tozai' })
      }
      else gain(s, 'idea', 2)
    },
  },
  audition: {
    view: () => ({
      title: '卒業公演のオーディション',
      lines: ['3月の卒業公演の演目決め。ネタ、ダンス、芝居、そして「その他大勢」。全員がどこかに1回は出る。'],
      choices: [{ label: 'ネタ枠を狙う', hint: '度胸＋' }, { label: 'ダンス枠', hint: '表現力＋・体力−' }, { label: '芝居枠', hint: '表現力＋' }, { label: 'その他大勢でいい', hint: '体調＋' }],
    }),
    resolve: (s, c) => {
      if (c === 0) gain(s, 'guts', 3)
      if (c === 1) {
        gain(s, 'expr', 3)
        s.condition = clamp(s.condition - 10)
      }
      if (c === 2) gain(s, 'expr', 3)
      if (c === 3) s.condition = clamp(s.condition + 10)
      s.flags[`audition_${c}`] = true
    },
  },
  grad_intro: {
    view: (s) => ({
      title: '卒業大会「門出」',
      lines: [
        `2月。同期${s.classmates}人、全組が1分ネタで競う卒業大会。`,
        '勝ち上がった数組がもう1本やり、優勝すると卒業総代になる。',
      ],
      choices: [],
    }),
    resolve: (s) => push(s, { type: 'stage', kind: 'grad_prelim' }),
  },
  // ここから通年のランダムイベント
  park: {
    view: (s) => ({
      title: '夜の公園',
      lines: [
        `深夜の公園で${s.partner?.name ?? '一人'}とネタ合わせ。人の気配がしたら「ちょっと止めよか」。`,
        '懐中電灯の光。「こんな時間に何してるの？」警察官だった。',
      ],
      choices: [{ label: '「芸人です。ネタ合わせしてました」', hint: '度胸＋' }, { label: '一から説明しようとして噛む', hint: '対応力＋' }],
    }),
    resolve: (s, c) => (c === 0 ? gain(s, 'guts', 2) : gain(s, 'adlib', 2)),
  },
  late_partner: {
    view: (s) => ({
      title: '相方が来ない',
      lines: [
        `ネタ合わせの約束の時間を過ぎても、${s.partner?.name}が来ない。`,
        '5時間後に現れた相方は、カレーを一口食べて「ちょっと辛すぎますね」と言い、「じゃ、帰りますか！」',
      ],
      choices: [{ label: '笑って許す', hint: '関係値＋・やる気−' }, { label: '本気で怒る', hint: '関係値−・尖り＋' }],
    }),
    resolve: (s, c) => {
      if (!s.partner) return
      if (c === 0) {
        s.partner.bond = clamp(s.partner.bond + 4)
        s.motivation = clamp(s.motivation - 5)
      } else {
        s.partner.bond = clamp(s.partner.bond - (has(s, 'aikata') ? 2 : 6))
        s.edge += 2
      }
    },
  },
  shinneta: {
    view: (s) => ({
      title: '「新ネタやろう！」',
      lines: [`ネタを書かない${s.partner?.name}に限って、ライブ前に「新ネタやろう！」と言い出した。`],
      choices: [{ label: '新ネタにする', hint: '完成度リセット・カード＋' }, { label: '「いつものでいこう」', hint: '関係値−' }],
    }),
    resolve: (s, c, rng) => {
      if (c === 0) {
        const fresh = CARDS.filter((x) => !s.cards.includes(x.id))
        if (fresh.length) {
          const card = rng.pick(fresh)
          s.cards.push(card.id)
          s.weekLog.push(`新しいネタの種「${card.name}」を手に入れた。`)
        }
        s.neta.polish = Math.round(s.neta.polish * 0.6)
      } else if (s.partner) s.partner.bond = clamp(s.partner.bond - 4)
    },
  },
  loan: {
    view: (s) => ({
      title: '貸した金',
      lines: [`先月${s.partner?.name}に貸した1万円が返ってこない。本番前だけ現れて、終わるとすぐ消える。`],
      choices: [{ label: '催促する', hint: 'お金＋・関係値−' }, { label: 'もう言わない', hint: '関係値＋' }],
    }),
    resolve: (s, c) => {
      if (!s.partner) return
      if (c === 0) {
        s.money += 5000
        s.partner.bond = clamp(s.partner.bond - 3)
        s.weekLog.push('半分だけ返ってきた。')
      } else s.partner.bond = clamp(s.partner.bond + 2)
    },
  },
  line_kidoku: {
    view: () => ({
      title: '同期LINE',
      lines: ['同期の大型グループに、好きなバンドの話を送った。', '52人全員が既読。返信はゼロ。'],
      choices: [],
    }),
    resolve: (s) => {
      s.motivation = clamp(s.motivation - (has(s, 'hagane') ? 1 : 5))
    },
  },
  barashi: {
    view: () => ({
      title: 'バラシ',
      lines: ['前日の夜、講師の都合で明日の授業がバラシ（休講）になった。', '空いた一日をどうする？'],
      choices: [{ label: 'ネタを書く', hint: '完成度＋' }, { label: '寝る', hint: '体調＋' }],
    }),
    resolve: (s, c) => {
      if (c === 0) s.neta.polish = clamp(s.neta.polish + 6)
      else s.condition = clamp(s.condition + 15)
    },
  },
  coin_shower: {
    view: (s) => ({
      title: '風呂なしアパート',
      lines: [
        '給湯器が壊れた。近所のコインシャワーは3分200円。',
        'キッチンで髪と体を洗ってから、流すためだけに行くことにした。',
        ...(affinity(s, 'hayase') >= 25 ? ['コインシャワーの前に、隣の部屋の早瀬が並んでいた。「お前んとこも？」'] : []),
      ],
      choices: [],
    }),
    resolve: (s) => {
      s.money -= 200
      gain(s, 'adlib', 1)
    },
  },
  hikkoshi: {
    view: (s, p) => ({
      title: '先輩の引っ越し',
      lines: [`${seniorName(s, p.senior)}さんから「今度の日曜、引っ越し手伝ってくれへん？」`, '先輩の引っ越しは、お下がりがもらえる狙い目らしい。'],
      choices: [{ label: '手伝う', hint: '仲の良さ＋・体調−' }, { label: 'バイトがあるので断る', hint: '仲の良さ−' }],
    }),
    resolve: (s, c, _r, p) => {
      const senior = s.seniors.find((x) => x.id === p.senior)
      if (!senior) return
      if (c === 0 || has(s, 'kotowarenai')) {
        senior.like = clamp(senior.like + 8)
        s.condition = clamp(s.condition - 15)
        s.weekLog.push('「これ、もらっていいですか？」と聞いたら、ジャケットを1着もらえた。')
        s.flags.jacket = true
      } else {
        senior.like = clamp(senior.like - 3)
        s.edge += 1
      }
    },
  },
  chokueigyou: {
    view: () => ({
      title: '知り合いの知り合いからの仕事',
      lines: ['一度連絡先を交換しただけの芸人から連絡が来た。', '「飲食店のオーナーの誕生日会で10分ネタやってくれへん？ギャラ3万、事務所には内緒で」'],
      choices: [{ label: '受ける', hint: 'お金＋' }, { label: '断る' }],
    }),
    resolve: (s, c) => {
      s.flags.chokueigyou_seen = true
      if (c === 0 || has(s, 'kotowarenai')) {
        s.money += 30000
        s.risk += 60
        s.weekLog.push('車で待機して、10分ネタをやって帰った。3万円が手元に残った。')
      } else s.edge += 2
    },
  },
  naitei: {
    view: (s) => ({
      title: '相方の内定',
      lines: [`${s.partner?.name}が言いにくそうに切り出した。「実は、広告会社から内定もらってて」`, '大学お笑い出身あるある。卒業とともにみんな就職していく。'],
      choices: [{ label: '説得する', hint: '関係値しだい' }, { label: '背中を押して、新しい相方を探す', hint: '梅組からやり直し' }],
    }),
    resolve: (s, c, rng) => {
      if (!s.partner) return
      if (c === 0 && s.partner.bond + rng.int(0, 30) >= 60) {
        s.partner.bond = clamp(s.partner.bond + 10)
        s.weekLog.push(`${s.partner.name}は内定を断った。「お前とやる方がおもろいわ」`)
      } else {
        s.weekLog.push(`${s.partner.name}は就職を選んだ。`)
        splitUp(s)
      }
    },
  },
  kaisan: {
    view: (s) => ({
      title: '解散の危機',
      lines: [`寄席の合間に、${s.partner?.name}が言った。「続ける自信がない」`],
      choices: [{ label: '朝まで話し合う', hint: '関係値＋・やる気−' }, { label: '解散する', hint: '梅組からやり直し' }],
    }),
    resolve: (s, c) => {
      if (c === 0 && s.partner) {
        s.partner.bond = clamp(s.partner.bond + 20)
        s.motivation = clamp(s.motivation - 10)
      } else splitUp(s)
    },
  },
  debt: {
    view: (s) => {
      const savior = s.seniors.find((x) => x.like >= 50)
      // バイト先の店長がお金を貸してくれる【research/02 店長が病院代を貸してくれた】
      const tencho = !savior && affinity(s, 'tencho') >= 40 && !s.flags.tencho_loan
      return {
        title: 'お金が尽きた',
        lines: savior
          ? [`家賃が払えない。それを聞いた${savior.name}さんが「しばらくうちに住めや」と言ってくれた。`]
          : tencho
            ? ['ナレーション：家賃が払えない。バイトの休憩中、通帳を見てため息をついたのを、店長に見られた。', '店長（ふつう）「なんぼ足りへんねん。……ええから、売れたら返せ」']
            : ['家賃が払えない。実家に電話した。母は何も聞かずに5万円を振り込んでくれた。'],
        choices: [],
      }
    },
    resolve: (s) => {
      const savior = s.seniors.find((x) => x.like >= 50)
      if (!savior && affinity(s, 'tencho') >= 40 && !s.flags.tencho_loan) {
        s.flags.tencho_loan = true
        s.money += 40000
        tie(s, 'tencho', 8)
        return
      }
      if (savior) {
        s.money += 30000
        savior.like = clamp(savior.like + 5)
        s.flags.isourou = true
      } else {
        s.money += 50000
        s.motivation = clamp(s.motivation - 10)
      }
    },
  },
}

Object.assign(STORIES, DEV_STORIES, YEAR_STORIES, PARTNER_STORIES)

export function storyView(s: GameState, key: string, params: Record<string, string | number> = {}): StoryView {
  const view = STORIES[key].view(s, params)
  // 譲れないものに関わる選択肢には印をつける
  const choices = view.choices.map((c, i) => (kodawariOf(s, key, i) === 'keep' ? { ...c, hint: c.hint ? `譲れない・${c.hint}` : '譲れない' } : c))
  return { ...view, choices }
}

export { yen }

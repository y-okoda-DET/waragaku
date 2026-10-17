import { DEV_STORIES, affinity, classmatesOf, tie } from './bonds'
import { kodawariOf } from './kodawari'
import { PARTNER_STORIES } from './partnerLines'
import { YEAR_STORIES } from './yearEvents'
import { RIVAL_STORIES, rivalOf } from './rivalEvents'
import { SENPAI_STORIES } from './senpaiEvents'
import { CARDS } from './data/cards'
import { PARTNER_CANDIDATES } from './data/people'
import { clamp, count, gain, has, push, story, yen } from './core'
import { makePartner, splitUp } from './partner'
import type { Rng } from './rng'
import type { GameState } from './types'

const me = (s: GameState) => s.player.callName

export interface Choice {
  label: string
  reply?: string | string[] // 選んだあとの相手の反応（台本形式）
  locked?: string // 選べない理由（お金が足りない、など）
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
        `ナレーション：大笑芸能学院、入学式。同期は${s.classmates}人。スーツの人もいれば、さっき起きたばかりのスウェットの人もいる。`,
        'ナレーション：壇上に1期上の「助手先輩」が並ぶ。真ん中の先輩がマイクを持った。',
        '灰原（ふつう）「助手の灰原です。最初に言うときます」',
        '灰原（ふつう）「今はたくさんいるけど、マジで今、自分の両隣にいる人、いなくなるから」',
        'ナレーション：講堂が静かになった。右隣の人と、少しだけ目が合った。',
        '灰原（笑い）「挨拶は夜でも“おはようございます”。授業の20分前におらんかったら遅刻。恋愛禁止」',
        '灰原（ふつう）「あと、出席は全部数えてます。足りん人は、どんだけおもろくても卒業させません。以上です」',
      ],
      choices: [{ reply: '灰原（笑い）「ええ声。ほんで今、夕方やで」', label: '「おはようございます！」と声を張る', hint: '度胸＋' }, { reply: '灰原（ふつう）「そこの見回してる人。両隣の顔、今のうちに覚えとき」', label: '黙って周りを見回す', hint: '発想力＋' }],
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
        `辻堂（ふつう）「${s.player.callName}と${s.partner?.name}。大学でずっとやってたんやろ」`,
        '辻堂（笑い）「4年もやってたら、もう芸歴9年やな」',
        'ナレーション：計算が合わない。でも教室の何人かが笑った。期待されているのか、試されているのか。',
      ],
      choices: [{ reply: '辻堂（ふつう）「謙遜は舞台でスベってからでええ」', label: '「そんなことないです」と笑う', hint: '先輩の印象＋' }, { reply: '辻堂（笑い）「ほな見とくわ。芸歴9年分な」', label: '「見ててください」と言い切る', hint: 'やる気＋・尖り＋' }],
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
          'ナレーション：教室に100人近くが集まる。司会は先輩芸人。まるでお見合いパーティー。',
          'ナレーション：自己紹介カードには「ボケ希望かツッコミ希望か」「ネタを書きたいか、書いてほしいか」。',
          '灰原（笑い）「この人と組んでみたい人、手ぇ挙げて！ 挙げへんかったら、ずっとひとりやで！」',
          ...ids.map((i) => `ナレーション：${PARTNER_CANDIDATES[i].name}。${PARTNER_CANDIDATES[i].blurb}`),
          `ナレーション：${ids.map((i) => PARTNER_CANDIDATES[i].name).join('、')}。誰に手を挙げるか。`,
        ],
        choices: ids.map((i) => ({ reply: '灰原（笑い）「おっ、手ぇ挙がった！ あとは向こうが挙げるかどうかや」', label: `${PARTNER_CANDIDATES[i].name}に手を挙げる` })),
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
        `ナレーション：${s.partner?.name}と、ファミレスでコンビ名を出し合う。お互い20案ずつ出して、かぶったのは1つだけ。`,
        `${s.partner?.name}（怒り）「カタカナやろ」`,
        `${s.player.callName}（怒り）「ひらがなやろ」`,
        'ナレーション：そこから2時間揉めた。ドリンクバーは4周した。',
      ],
      choices: [],
      input: { placeholder: 'ここにコンビ名を入力', suggestions: ['ニッチモサッチモ', 'ドロップキック', '夜行バス', '三角定規', 'ミッドナイト短パン'] },
    }),
    resolve: (s, _c, _r, _p, text) => {
      s.comboName = (text ?? '').trim() || 'ニッチモサッチモ'
      s.weekLog.push(`コンビ名は「${s.comboName}」に決まった。`)
    },
  },
  queue: {
    view: (s) => ({
      title: 'ネタ見せの順番',
      // 2回目からは1行だけ【読む量を減らす】
      lines: s.flags.queue_seen
        ? ['ナレーション：今月もネタ見せの日。列はもう廊下に伸びている。']
        : [
            'ナレーション：ネタ見せは並んだ順。授業時間内に見てもらえるのは15組前後。',
            '灰原（ふつう）「後ろの方ほど、辻堂さんの機嫌が悪なるで。15組目くらいから“おもんない”の“お”しか言わへん」',
          ],
      choices: [
        { reply: '灰原（驚き）「早っ。私より先に来てるやん。鍵、まだ開いてへんで」', label: '2時間前から最前列に並ぶ', hint: '体調−・講師の機嫌＋' },
        { reply: '灰原（ふつう）「1時間前は、だいたい20番目くらいやな」', label: '1時間前に並ぶ', hint: '体調−' },
        { reply: '灰原（ふつう）「ギリギリの人は、辻堂さんの“お”を聞くことになるで」', label: 'ギリギリに行く' },
        { reply: '灰原（考え中）「わざと後ろ？ ……辻堂さんが疲れて笑うの狙いか。たまに効くねん、それ」', label: 'わざと列の後ろに並ぶ', hint: '見てもらえないかも' },
      ],
    }),
    resolve: (s, c, rng) => {
      s.flags.queue_seen = true
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
      lines: s.flags.orei_seen
        ? [`ナレーション：昨日は${seniorName(s, p.senior)}さんにごちそうになった。朝7時、頭が割れるように痛い。`]
        : [
            `ナレーション：昨日は${seniorName(s, p.senior)}さんにごちそうになった。`,
            'ナレーション：お礼は3回が鉄則。別れ際に直接、翌朝にメッセージ、次に会ったときは開口一番「この前はご馳走様でした」。',
            'ナレーション：いまは朝7時。頭が割れるように痛い。',
          ],
      choices: [{ reply: `${seniorName(s, p.senior)}（笑い）「早いな。こっちはまだ寝てたわ」`, label: '翌朝一番にお礼を送る' }, { reply: `ナレーション：昼過ぎにスマホを見ると、${seniorName(s, p.senior)}さんから「生きてる？」とだけ来ていた。`, label: '二日酔いで昼まで寝てしまう' }],
    }),
    resolve: (s, c, _r, p) => {
      s.flags.orei_seen = true
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
    view: (s, p) => ({
      title: p.kind === 'contest_conte' ? 'コント頂のエントリー' : '漫才天下一のエントリー',
      lines: [
        p.kind === 'contest_conte'
          ? 'ナレーション：コントの大会「コント頂」の予選が始まる。在学生でもエントリーできる。'
          : 'ナレーション：漫才の大会「漫才天下一」の1回戦。結成15年以内ならプロもアマも出られる。2分ネタ。',
        '辻堂（ふつう）「在学中に1個でも勝ったら、見る目変わるで。……俺のな」',
        'ナレーション：エントリー料はコンビで2,000円。',
      ],
      choices: [{ reply: '辻堂（ふつう）「2,000円で客になるか、出る側になるか。出る側にしとけ」', label: 'エントリーする', hint: '2,000円', locked: s.money < 2000 ? 'お金が足りない' : undefined }, { reply: '辻堂（ふつう）「見送るんも判断や。客席から勝ったやつの顔、よう見とけ」', label: '今年は見送る' }],
    }),
    resolve: (s, c, _r, p) => {
      if (c === 0 && s.money >= 2000) {
        s.money -= 2000
        push(s, { type: 'stage', kind: p.kind as 'contest_conte' | 'contest_manzai' })
      }
    },
  },
  gasshuku: {
    view: (s) => ({
      title: '夏の強化合宿',
      lines: [
        'ナレーション：夏の強化合宿。東西合同、2泊3日。自由参加。',
        'ナレーション：参加費4万円は、出発の朝に集合場所で現金で払う。払えなければ、バスには乗れない。',
        `ナレーション：財布の中は${yen(s.money)}。`,
        '灰原（ふつう）「行きのバスの席順な、秋のクラス替えと関係あるって噂。……噂やで。毎年当たってるけど」',
      ],
      choices: [{ reply: '灰原（笑い）「バスの席、一番前だけはやめとき。講師の隣やで」', label: '払って行く', hint: '−40,000円', locked: s.money < 40000 ? 'お金が足りない' : undefined }, { reply: '灰原（ふつう）「4万あったら家賃やもんな。合宿のネタ、あとで動画見せたるわ」', label: 'お金がないので行かない' }],
    }),
    resolve: (s, c) => {
      if (c === 1 || s.money < 40000) {
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
      story(s, 'gasshuku_dame')
    },
  },
  // 合宿2日目の中間発表で止められ、その夜に直して、最終日にもう一度やる【合宿の山場】
  gasshuku_dame: {
    view: (s) => {
      const p = s.partner?.name
      return {
        title: '合宿2日目 中間発表',
        place: 'kyoushitsu',
        lines: [
          'ナレーション：2日目の夜。大広間に座布団が並び、1組ずつネタを見せる。',
          `ナレーション：${s.comboName ?? s.player.callName}の番。ツカミが終わったところで、辻堂が手を上げた。`,
          '辻堂（怒り）「……やめ。もうええ」',
          '辻堂（怒り）「合宿に何しに来たんや。いつものネタを、いつもどおりやっただけやろ。2泊3日、何を持って帰るつもりや」',
          '辻堂（ふつう）「明日の最終発表で同じもん持ってきたら、帰りのバスは一番前や。俺の隣でな」',
          'ナレーション：大広間が静かになった。同期の視線が、背中に刺さる。',
          p ? `${p}（落ち込み）「……部屋、戻ろか」` : 'ナレーション：ひとりで、部屋に戻った。',
          'ナレーション：消灯まであと2時間。最終発表は、明日の朝10時。',
        ],
        choices: [
          { reply: p ? `${p}（考え中）「頭からか。……ええよ。寝るのは帰りのバスでええ」` : `${me(s)}（考え中）「頭から書く。寝るのは帰りのバスでいい」`, label: '一晩で、頭から書き直す', hint: '発想力＋・体調−' },
          { reply: p ? `${p}（笑い）「ほな廊下でやろ。自販機の前、明るいし」` : `${me(s)}（考え中）「廊下の自販機の前なら、明るい」`, label: '朝まで、今のネタを合わせ込む', hint: 'ネタの完成度＋・体調−' },
          { reply: p ? `${p}（ふつう）「止められたとこだけ、か。……それで足りるかな」` : `${me(s)}（ふつう）「止められたところだけ。それで足りるか」`, label: '止められたところだけ直して、寝る', hint: '体調はそのまま' },
        ],
      }
    },
    resolve: (s, c) => {
      if (c === 0) {
        gain(s, 'idea', 3)
        s.neta.polish = Math.max(0, s.neta.polish - 5)
        s.condition = clamp(s.condition - 12)
      }
      if (c === 1) {
        s.neta.polish = Math.min(100, s.neta.polish + 15)
        s.condition = clamp(s.condition - 12)
      }
      if (c === 2) s.neta.polish = Math.min(100, s.neta.polish + 5)
      s.flags[`gasshuku_${c}`] = true
      push(s, { type: 'stage', kind: 'gasshuku' })
    },
  },
  class_change: {
    view: (s) => ({
      title: 'クラス替え',
      lines: [
        'ナレーション：夏が終わり、ネタ見せが実力別のクラスになった。松組10組、竹組15組、梅組はそれ以外の100組以上。',
        `ナレーション：${s.comboName}は「${{ none: '-', ume: '梅組', take: '竹組', matsu: '松組' }[s.classRank]}」。`,
        s.classRank === 'ume' ? '三宅（笑い）「梅組へようこそ！ 梅はな、いちばん寒い時期に咲くんやで」' : '辻堂（ふつう）「名前、覚えたぞ。覚えたからには、忘れさせんなよ」',
        'ナレーション：昇格・降格は毎月。コンビを解散すると、自動的に梅組に落ちる。',
      ],
      choices: [],
    }),
  },
  tozai_select: {
    view: (s) => ({
      title: '東西寄席合戦の選考',
      lines: s.classRank === 'matsu'
          ? ['ナレーション：東西の養成所の対抗戦。出られるのは選抜された数組だけ。', `ナレーション：${s.comboName}が選ばれた。`, '辻堂（ふつう）「アウェイや。向こうの客は、お前らの名前を一人も知らん。それが普通や」']
          : ['ナレーション：東西の養成所の対抗戦。出られるのは選抜された数組だけ。', 'ナレーション：選ばれたのは松組の組だった。客席から観た。', 'ナレーション：こっちの組がスベるたびに、少しほっとした。そんな自分が嫌になった。'],
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
      lines: ['ナレーション：3月の卒業公演の演目決め。ネタ、ダンス、芝居、そして「その他大勢」。全員がどこかに1回は出る。', '三宅（笑い）「カンフー演舞の枠もあるで！ 去年は希望者ゼロやったけど」'],
      choices: [{ reply: '三宅（笑い）「ネタ枠は倍率高いで！ そのぶん燃えるやろ」', label: 'ネタ枠を狙う', hint: '度胸＋' }, { reply: '三宅（爆笑）「ダンス！ 筋肉痛で漫才のテンポ変わっても知らんで！」', label: 'ダンス枠', hint: '表現力＋・体力−' }, { reply: '三宅（笑い）「芝居枠は岸辺が仕切るで。泣かされる覚悟しとき」', label: '芝居枠', hint: '表現力＋' }, { reply: '三宅（爆笑）「その他大勢、毎年いちばん目立つやつが出るねん。なんでやろな」', label: 'その他大勢でいい', hint: '体調＋' }],
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
        `ナレーション：2月。同期${s.classmates}人、全組が1分ネタで競う卒業大会。`,
        'ナレーション：勝ち上がった数組がもう1本やり、優勝すると卒業総代になる。',
        rivalOf(s) === 'mido' ? '御堂（笑い）「1分なら、フリとオチだけで足りる。……君らの名前、予選の3つ後ろだね」' : '真壁（ふつう）「……決勝で」',
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
        `ナレーション：深夜の公園で${s.partner?.name ?? '一人'}とネタ合わせ。人の気配がしたら「ちょっと止めよか」。`,
        'ナレーション：懐中電灯の光。',
        '警察官（ふつう）「こんな時間に、何してるの？」',
      ],
      choices: [{ reply: '警察官（考え中）「芸人さん……。今の、どのへんが面白いところ？」', label: '「芸人です。ネタ合わせしてました」', hint: '度胸＋' }, { reply: '警察官（笑い）「落ち着いて。……今の噛み方は、ちょっと面白かった」', label: '一から説明しようとして噛む', hint: '対応力＋' }],
    }),
    resolve: (s, c) => (c === 0 ? gain(s, 'guts', 2) : gain(s, 'adlib', 2)),
  },
  late_partner: {
    view: (s) => ({
      title: '相方が来ない',
      lines: [
        `ナレーション：ネタ合わせの約束の時間を過ぎても、${s.partner?.name}が来ない。待つ間にカレーを作った。`,
        'ナレーション：5時間後、現れた。カレーを一口食べた。',
        `${s.partner?.name}（ふつう）「……ちょっと辛すぎますね」`,
        `${s.partner?.name}（笑い）「じゃ、帰りますか！」`,
      ],
      choices: [{ reply: `${s.partner?.name}（笑い）「カレー、次は甘口でお願いします」`, label: '笑って許す', hint: '関係値＋・やる気−' }, { reply: `${s.partner?.name}（驚き）「……そんな怒る？ ……ごめん。次から30分前に来る」`, label: '本気で怒る', hint: '関係値−・尖り＋' }],
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
      lines: [
        'ナレーション：ライブの2日前。',
        `${s.partner?.name}（笑い）「新ネタやろう！」`,
        `ナレーション：言い出したのは、ネタを一行も書かない${s.partner?.name}だった。`,
      ],
      choices: [{ reply: `${s.partner?.name}（爆笑）「よっしゃ！ ほな、書くのは任せた！」`, label: '新ネタにする', hint: '完成度リセット・カード＋' }, { reply: `${s.partner?.name}（落ち込み）「……いつものな。いつもの、ええよな」`, label: '「いつものでいこう」', hint: '関係値−' }],
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
      lines: [
        `ナレーション：先月${s.partner?.name}に貸した1万円が、まだ返ってこない。`,
        `${s.partner?.name}（笑い）「おはようございます！ 今日もがんばろな！」`,
        'ナレーション：本番前だけ現れて、終わるとすぐ消える。',
      ],
      choices: [{ reply: `${s.partner?.name}（驚き）「あっ！ ……来月！ 来月の頭！ 絶対！」`, label: '催促する', hint: 'お金＋・関係値−' }, { reply: `ナレーション：言わないと決めた日から、${s.partner?.name}は少しだけ早く来るようになった。`, label: 'もう言わない', hint: '関係値＋' }],
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
  // 仲がいいときほど起きる、ささいな喧嘩。放っておくと関係値が下がる【research/06 ネタ合わせで3時間無視】
  kenka: {
    view: (s, p) => {
      const pn = s.partner?.name ?? '相方'
      const v = Number(p.v ?? 0) % 3
      return [
        {
          title: '言い方',
          lines: [
            `ナレーション：ネタ合わせの途中。${pn}が、同じところで3回目の言い直しをした。`,
            `${s.player.callName}（怒り）「そこ、さっきも言うたやん」`,
            `${pn}（怒り）「言い方あるやろ」`,
            'ナレーション：ファミレスのテーブルが静かになった。ドリンクバーの氷だけが鳴っている。',
          ],
          choices: [
            { reply: `${pn}（落ち込み）「……いや、俺も悪い。もう1回やろ」`, label: '「ごめん、言い方悪かった」と先に謝る', hint: '関係値＋' },
            { reply: `ナレーション：その日、${pn}は帰るまで一言もしゃべらなかった。`, label: '「事実やろ」と言い返す', hint: '関係値−・尖り＋' },
            { reply: `ナレーション：外の空気を吸って戻ると、${pn}がドリンクを2つ取ってきていた。`, label: '黙って一回、外に出る', hint: '関係値−' },
          ],
        },
        {
          title: '既読スルー',
          lines: [
            `ナレーション：${pn}に送った新ネタの台本。既読がついてから、半日たっても返事がない。`,
            `ナレーション：同期のストーリーに、${pn}が別の同期と飲んでいる写真が上がっていた。`,
          ],
          choices: [
            { reply: `${pn}（照れ）「……ごめん、ちゃんと読みたくて寝かせてた。おもろかった」`, label: '電話して、感想を聞く', hint: '関係値＋' },
            { reply: `ナレーション：翌日、${pn}は何も言わずに台本を返してきた。赤字が一個もなかった。`, label: '「読んだ？」とだけ送る', hint: '関係値−' },
            { reply: `ナレーション：その写真に「いいね」だけつけた。${pn}からの返事は、次の日の昼に来た。`, label: '写真に「いいね」だけする', hint: '関係値−・度胸＋' },
          ],
        },
        {
          title: 'ネタの取り分',
          lines: [
            `ナレーション：同期に「あのネタ、どっちが書いたん？」と聞かれた。`,
            `${pn}（笑い）「ほぼ俺やな」`,
            'ナレーション：ほぼ半分は、こっちが書いた。',
          ],
          choices: [
            { reply: `${pn}（笑い）「……せやな。半分な。いや、6対4やな」`, label: '笑って「半分やろ」とツッコむ', hint: '関係値＋・対応力＋' },
            { reply: `ナレーション：同期が気まずそうに席を外した。${pn}は「冗談やん」と言ったが、目が笑っていなかった。`, label: '「いや、オチは全部こっちやろ」と言い返す', hint: '関係値−' },
            { reply: 'ナレーション：何も言わなかった。帰りの電車で、そのことばかり考えていた。', label: '黙っておく', hint: 'やる気−' },
          ],
        },
      ][v]
    },
    resolve: (s, c, _r, p) => {
      if (!s.partner) return
      const v = Number(p.v ?? 0) % 3
      if (c === 0) {
        s.partner.bond = clamp(s.partner.bond + 3)
        if (v === 2) gain(s, 'adlib', 2)
      } else if (c === 1) {
        s.partner.bond = clamp(s.partner.bond - (has(s, 'aikata') ? 4 : 10))
        if (v === 0) s.edge += 2
      } else if (v === 2) s.motivation = clamp(s.motivation - 5)
      else {
        s.partner.bond = clamp(s.partner.bond - (has(s, 'aikata') ? 2 : 6))
        if (v === 1) gain(s, 'guts', 2)
      }
    },
  },
  line_kidoku: {
    view: () => ({
      title: '同期LINE',
      lines: [
        'ナレーション：同期の大型グループに、好きなバンドの話を送った。',
        'ナレーション：52人全員が既読。返信はゼロ。',
        'ナレーション：1時間後、誰かが「明日の授業、何時から？」と送った。3人が返信した。',
      ],
      choices: [],
    }),
    resolve: (s) => {
      s.motivation = clamp(s.motivation - (has(s, 'hagane') ? 1 : 5))
    },
  },
  barashi: {
    view: () => ({
      title: 'バラシ',
      lines: ['ナレーション：前日の夜、講師の都合で明日の授業がバラシ（休講）になった。', 'ナレーション：空いた一日をどうする？'],
      choices: [{ reply: 'ナレーション：休講の日に書いたネタは、なぜかいつもより伸び伸びしていた。', label: 'ネタを書く', hint: '完成度＋' }, { reply: 'ナレーション：起きたら夕方だった。体だけは、少し軽くなった。', label: '寝る', hint: '体調＋' }],
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
        'ナレーション：給湯器が壊れた。近所のコインシャワーは3分200円。',
        'ナレーション：キッチンで髪と体を洗ってから、流すためだけに行くことにした。',
        ...(affinity(s, 'hayase') >= 25 ? ['ナレーション：コインシャワーの前に、隣の部屋の早瀬が並んでいた。', '早瀬（笑い）「お前んとこもか」'] : []),
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
      lines: [
        seniorName(s, p.senior) === 'ナカジ' ? 'ナカジ（笑い）「今度の日曜、引っ越し手伝ってくれない？」' : `${seniorName(s, p.senior)}（笑い）「今度の日曜、引っ越し手伝ってくれへん？」`,
        'ナレーション：先輩の引っ越しは、お下がりがもらえる狙い目らしい。',
      ],
      choices: [{ reply: `${seniorName(s, p.senior)}（笑い）「助かるわ。冷蔵庫と、あとネタ帳以外は全部持って帰ってええで」`, label: '手伝う', hint: '仲の良さ＋・体調−' }, { reply: `${seniorName(s, p.senior)}（ふつう）「そっか。バイトは大事にせえよ」`, label: 'バイトがあるので断る', hint: '仲の良さ−' }],
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
      lines: [
        'ナレーション：一度連絡先を交換しただけの芸人から、連絡が来た。',
        'ナレーション：「飲食店のオーナーの誕生日会で、10分ネタやってくれへん？ ギャラ3万。事務所には内緒で」',
      ],
      choices: [{ reply: 'ナレーション：「よろしくお願いします」と返した。ギャラ3万。送ってから、少しだけ胸がざわついた。', label: '受ける', hint: 'お金＋' }, { reply: 'ナレーション：「了解。またの機会に」。それきり、その芸人からの連絡は来なかった。', label: '断る' }],
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
      lines: [`${s.partner?.name}（落ち込み）「実は……広告会社から、内定もらってて」`, 'ナレーション：大学お笑い出身あるある。卒業とともに、みんな就職していく。'],
      choices: [{ reply: `${s.partner?.name}（考え中）「……1年だけ、待ってもらえるか聞いてみる」`, label: '説得する', hint: '関係値しだい' }, { reply: `${s.partner?.name}（照れ）「ごめん。……テレビで見たら、会社のみんなに自慢するわ」`, label: '背中を押して、新しい相方を探す', hint: '梅組からやり直し' }],
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
      lines: ['ナレーション：寄席の合間。', `${s.partner?.name}（落ち込み）「……続ける自信がない」`],
      choices: [{ reply: `${s.partner?.name}（落ち込み）「……始発、もう出てもうたな。……もうちょっと、やってみる」`, label: '朝まで話し合う', hint: '関係値＋・やる気−' }, { reply: `${s.partner?.name}（ふつう）「……ありがとう。おもろかったで、ほんまに」`, label: '解散する', hint: '梅組からやり直し' }],
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
          ? ['ナレーション：家賃が払えない。', savior.name === 'ナカジ' ? 'ナカジ（ふつう）「しばらく、うちに住めば？」' : `${savior.name}（ふつう）「しばらく、うちに住めや」`]
          : tencho
            ? ['ナレーション：家賃が払えない。バイトの休憩中、通帳を見てため息をついたのを、店長に見られた。', '店長（ふつう）「なんぼ足りへんねん。……ええから、売れたら返せ」']
            : ['ナレーション：家賃が払えない。実家に電話した。', 'ナレーション：母は何も聞かずに5万円を振り込んでくれた。振込名義が「ガンバレ」になっていた。'],
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

Object.assign(STORIES, DEV_STORIES, YEAR_STORIES, PARTNER_STORIES, RIVAL_STORIES, SENPAI_STORIES)

export function storyView(s: GameState, key: string, params: Record<string, string | number> = {}): StoryView {
  const view = STORIES[key].view(s, params)
  // 譲れないものに関わる選択肢には印をつける
  const choices = view.choices.map((c, i) => (kodawariOf(s, key, i) === 'keep' ? { ...c, hint: c.hint ? `譲れない・${c.hint}` : '譲れない' } : c))
  return { ...view, choices }
}

export { yen }

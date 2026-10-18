import { clamp, count, gain, has } from './core'
import type { StoryDef } from './events'
import type { GameState } from './types'

// 経歴ごとのシナリオ（周回の動機）。1周目は高校卒業だけで、卒業するたびに次の経歴が開く
// 1年の骨組みは同じにして、要所だけ書き分ける：入学、その経歴だけの出来事3つ、御堂・真壁との関係の入り方と2月の夜の一言、卒業式と芸人1年目の締め
// 大学お笑い：相方の佐倉と組んだまま入学。御堂とは学生の大会の準決勝で当たって負けている
// 元会社員：28歳、営業を6年。御堂と真壁から敬語を使われる。会社と芸人のあいだで揺れる話を、御堂の相方の就職の話に重ねる

export type CareerId = 'fresh' | 'circle' | 'salaryman'

// 開く順。卒業した回数だけ、先頭から開く
export const CAREERS: { id: CareerId; label: string }[] = [
  { id: 'fresh', label: '高校卒業' },
  { id: 'circle', label: '大学お笑い' },
  { id: 'salaryman', label: '元会社員' },
]

export const careerLabel = (id: string) => CAREERS.find((c) => c.id === id)?.label ?? '高校卒業'
// 共有画像の札。高校卒業はつけない
export const careerBadge = (id: string | undefined) => (id === 'circle' ? '大学お笑い出身' : id === 'salaryman' ? '元会社員' : '')

// 卒業した回数で、選べる経歴が決まる
export function unlockedCareers(runs: number): CareerId[] {
  return CAREERS.slice(0, Math.min(CAREERS.length, 1 + runs)).map((c) => c.id)
}

// テストプレイ用のモックでは、卒業しなくても全部の経歴を選べる（ユーザー指示）。本番では false にする
export const MOCK_ALL_OPEN = true
export const openCareers = (runs: number): CareerId[] => (MOCK_ALL_OPEN ? CAREERS.map((c) => c.id) : unlockedCareers(runs))

const career = (s: GameState): string => s.player.background
const sakura = (s: GameState) => s.partner?.name === '佐倉'

export const CAREER_STORIES: Record<string, StoryDef> = {
  // ---- 大学お笑いサークル出身 ----

  // 7月：サークルの後輩が、学生の大会に出すネタを見てほしいと待っている
  c_kouhai: {
    view: (s) => ({
      title: '後輩のネタ',
      place: 'kouen',
      lines: [
        'ナレーション：授業の帰り。駅前で、サークルの後輩のコンビが待っていた。',
        '後輩（笑い）「先輩！ 夏の学生大会のネタ、見てもらえませんか。プロの目で！」',
        'ナレーション：公園の街灯の下で、ネタを1本見た。フリもボケも天丼も、全部入っている。去年の自分たちに、そっくりだった。',
        ...(sakura(s) ? ['佐倉（考え中）「……なんか、言うたって」'] : []),
      ],
      choices: [
        { reply: ['ナレーション：「正しいけど、おもんない」。辻堂に言われて、いちばん効いた言葉をそのまま言った。', '後輩（落ち込み）「……はい」', 'ナレーション：言いながら、自分の胸にも刺さった。'], label: '辻堂に言われたことを、そのまま言う', hint: 'ワード力＋' },
        { reply: '後輩（笑い）「ほんまですか！ 決勝、配信あるんで観てください！」', label: '「おもろいやん」と笑って返す', hint: 'やる気＋' },
        { reply: ['ナレーション：夜中まで、4人でボケを1個ずつ削った。後輩のネタなのに、いちばん粘ったのは自分だった。'], label: '一緒に書き直す', hint: '発想力＋・体調−' },
      ],
    }),
    resolve: (s, c) => {
      s.flags.c_kouhai = true
      if (c === 0) {
        gain(s, 'word', 3)
        s.flags.c_kouhai_dame = true
      } else if (c === 1) s.motivation = clamp(s.motivation + 6)
      else {
        gain(s, 'idea', 3)
        s.condition = clamp(s.condition - 6)
        if (has(s, 'gakusei')) count(s, 'generalUke')
      }
    },
  },

  // 8月：学生お笑いの全国大会の決勝を、配信で観る
  c_haishin: {
    view: (s) => ({
      title: '決勝の配信',
      place: 'heya',
      lines: [
        `ナレーション：夏の終わり。学生お笑いの全国大会の決勝が、配信で流れている。${sakura(s) ? '佐倉と2人で、' : ''}スマホを立てて観た。`,
        'ナレーション：去年まで、自分たちがいた舞台だ。サークルの後輩のコンビが、決勝に残っていた。',
        ...(sakura(s) ? [s.flags.c_kouhai_dame ? '佐倉（笑い）「あいつら、お前が言うたとこ、全部直してきてるやん」' : '佐倉（笑い）「あいつら、俺らのツカミそのまま使ってるやん」'] : []),
        'ナレーション：後輩は優勝できなかった。審査員の講評は「正しい漫才でした」だった。',
        s.player.style === 'manzai' ? 'ナレーション：御堂のコンビが準優勝した年も、たしか同じ講評だった。' : 'ナレーション：正しい。学生のときは、いちばんうれしい褒め言葉だった。',
      ],
      choices: [
        { reply: ['ナレーション：「おもろかった」と送った。すぐに既読がついた。', 'ナレーション：「先輩、来年そっち行きます」。止めるべきか、少しだけ迷った。'], label: '後輩にLINEを送る', hint: 'やる気＋' },
        { reply: sakura(s) ? '佐倉（笑い）「せやな。正しくないやつ、作りに行こ」' : 'ナレーション：配信を閉じて、ひとりで公園に行った。街灯の下で、正しくないボケを10個考えた。', label: '配信を閉じて、公園でネタ合わせ', hint: '対応力＋・相方の関係＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) s.motivation = clamp(s.motivation + 6)
      else {
        gain(s, 'adlib', 2)
        if (s.partner) s.partner.bond = clamp(s.partner.bond + 4)
      }
    },
  },

  // 11月：母校の学祭にOBとして呼ばれる。客席の半分は知り合い、半分は通りがかり
  c_bokou: {
    view: () => ({
      title: '母校の学祭',
      place: 'kyoushitsu',
      lines: [
        'ナレーション：母校の学祭に、OBとして呼ばれた。サークルの教室ライブ。去年まで、ここが自分たちの劇場だった。',
        'ナレーション：客席は、後輩と、後輩の友だちと、たまたま通りがかった家族連れ。',
        '後輩（笑い）「先輩、プロのネタ見せてくださいよ！ “芸歴9年”のやつ！」',
      ],
      choices: [
        { reply: ['ナレーション：後輩たちは首をかしげた。家族連れの子どもが、いちばん笑った。', 'ナレーション：帰りの電車で、子どもが笑ったところだけ、ネタ帳に丸をつけた。'], label: '養成所で作った新しいネタをやる', hint: '対応力＋・ファン＋' },
        { reply: ['ナレーション：教室が揺れるほどウケた。後輩たちは、全部のボケを知っていた。', 'ナレーション：家族連れは、途中で出ていった。'], label: '学生時代の鉄板をやる', hint: 'やる気＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        gain(s, 'adlib', 3)
        s.fans += 2
        if (has(s, 'gakusei')) count(s, 'generalUke')
      } else s.motivation = clamp(s.motivation + 8)
    },
  },

  // ---- 元会社員 ----

  // 4月：癖で名刺を出してしまう
  s_meishi: {
    view: () => ({
      title: '名刺',
      place: 'rouka',
      lines: [
        'ナレーション：最初の授業の日。廊下で灰原に頭を下げた。',
        'ナレーション：気づいたら、両手で名刺を差し出していた。「ミナト物流株式会社 第二営業部」。先月まで毎日配っていた、前の会社の名刺だ。',
        '灰原（驚き）「……え、何これ。もろてええの？」',
        '灰原（笑い）「“お世話になっております”の顔してる。助手に名刺くれた人、初めてや」',
      ],
      choices: [
        { reply: '灰原（ふつう）「ええよ。ここでは、名前だけで勝負や」', label: '「すみません、癖で」と引っ込める', hint: '度胸＋' },
        { reply: '灰原（爆笑）「そこまでやるんや！ ……これ、ネタにし。もろとくわ」', label: '「つまらないものですが」と渡しきる', hint: '発想力＋・先輩の印象＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) gain(s, 'guts', 2)
      else {
        gain(s, 'idea', 2)
        const h = s.seniors.find((x) => x.id === 'haibara')
        if (h) h.like = clamp(h.like + 4)
      }
    },
  },

  // 7月：前の会社の同期から、ボーナスで奢ると連絡が来る
  s_bonus: {
    view: () => ({
      title: 'ボーナスの日',
      place: 'izakaya',
      lines: [
        'ナレーション：7月。前の会社の同期から、LINEが来た。「ボーナス出た。飲もう。おごる」',
        'ナレーション：店は、駅前の焼き鳥屋。会社員のころは、月に2回は来ていた。',
      ],
      choices: [
        { reply: ['ナレーション：同期は、部長の悪口と住宅ローンの話をした。こっちは、ネタ見せで「おもんない」と言われた話をした。', '同期（笑い）「……お前のほうが、顔色いいな」'], label: '飲みに行く', hint: 'やる気＋・体調−' },
        { reply: 'ナレーション：部長の口ぐせを、全部メモした。同期は「それ、俺が言ったって言うなよ」と3回言った。', label: '「ネタの取材させて」と行く', hint: 'ワード力＋・体調−' },
        { reply: 'ナレーション：「今週ネタ合わせやから」と返した。既読のまま、返事はなかった。', label: '断って、ネタを書く', hint: '発想力＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.motivation = clamp(s.motivation + 8)
        s.condition = clamp(s.condition - 6)
      } else if (c === 1) {
        gain(s, 'word', 3)
        s.condition = clamp(s.condition - 6)
      } else gain(s, 'idea', 3)
    },
  },

  // 11月：月イチ寄席の終演後、前の会社の上司が待っている
  s_joushi: {
    view: () => ({
      title: '前の上司',
      place: 'ekimae',
      lines: [
        'ナレーション：月イチ寄席の終演後。劇場の出口に、見覚えのあるスーツが立っていた。前の会社の課長だった。',
        '課長（ふつう）「チケットは自分で買ったからな。……2回、笑った」',
        '課長（考え中）「来年の4月、営業部に欠員が出る。戻る気があるなら、席は空けておく。答えは今じゃなくていい」',
        'ナレーション：課長は新しい名刺を1枚置いて、帰っていった。肩書きが「部長」に変わっていた。',
      ],
      choices: [
        { reply: '課長（笑い）「そう言うと思った。……次は3回、笑わせろ」', label: '「戻りません」とその場で言う', hint: 'やる気＋' },
        { reply: 'ナレーション：名刺は、財布のいちばん奥にしまった。捨てられなかった。', label: '名刺を、財布にしまう', hint: '体調＋' },
        { reply: '課長（驚き）「……2回じゃ足りんか。……やっぱり、営業向きだよ」', label: '「次は、ネタで3回笑わせます」', hint: '度胸＋' },
      ],
    }),
    resolve: (s, c) => {
      if (c === 0) {
        s.motivation = clamp(s.motivation + 10)
        s.flags.joushi_no = true
      } else if (c === 1) {
        s.condition = clamp(s.condition + 6)
        s.flags.joushi_keep = true
      } else gain(s, 'guts', 3)
    },
  },
}

// その経歴だけの出来事が起きる週。決まった行事の少ない週を選んでいる（前の上司は11月の寄席のあと）
export const CAREER_SCHEDULE: { career: CareerId; month: number; week: number; key: string; when?: (s: GameState) => boolean }[] = [
  { career: 'circle', month: 7, week: 4, key: 'c_kouhai' },
  { career: 'circle', month: 8, week: 4, key: 'c_haishin' },
  { career: 'circle', month: 11, week: 2, key: 'c_bokou' },
  { career: 'salaryman', month: 4, week: 3, key: 's_meishi' },
  { career: 'salaryman', month: 7, week: 4, key: 's_bonus' },
  { career: 'salaryman', month: 11, week: 4, key: 's_joushi' },
]

// アルバムに出す、経歴ごとの場面の名前と選択肢の数（見ていない場面は名前を伏せて数だけ見せる）
export const CAREER_SCENES: { career: CareerId; key: string; title: string; choices: number }[] = [
  { career: 'circle', key: 'c_kouhai', title: '後輩のネタ', choices: 3 },
  { career: 'circle', key: 'c_haishin', title: '決勝の配信', choices: 2 },
  { career: 'circle', key: 'c_bokou', title: '母校の学祭', choices: 2 },
  { career: 'salaryman', key: 's_meishi', title: '名刺', choices: 2 },
  { career: 'salaryman', key: 's_bonus', title: 'ボーナスの日', choices: 3 },
  { career: 'salaryman', key: 's_joushi', title: '前の上司', choices: 3 },
]
// 選んだ選択肢の印（アルバムに「場面:番号」で残す）
export const pickFlag = (key: string, choice: number) => `cpick_${key}_${choice}`

export function careerEvents(s: GameState, month: number, week: number): string[] {
  return CAREER_SCHEDULE.filter((e) => e.career === career(s) && e.month === month && e.week === week && (!e.when || e.when(s))).map((e) => e.key)
}

// ---- 共通の場面に差し込む、経歴ごとの行 ----

// 入学式。1行目のあとに足す
export function nyugakuLines(s: GameState): string[] {
  if (career(s) === 'circle') return [`ナレーション：隣には${s.partner?.name ?? '相方'}。サークルの卒業ライブから、まだ3週間。同じ大学から来たのは、自分たちだけだ。`]
  if (career(s) === 'salaryman') return ['ナレーション：スーツで来たのは、自分を入れて3人だけ。先月まで毎朝着ていたスーツだ。まわりは、ほとんど10歳下に見える。']
  return []
}

// 入学式で声を張ったときの灰原の返し
export function ohayoReply(s: GameState): string {
  if (career(s) === 'salaryman') return '灰原（驚き）「……ええ声。朝礼で鍛えたん？ その声、卒業まで出し続けや」'
  return '灰原（笑い）「ええ声。その声、卒業まで出し続けや」'
}

// 卒業式。相方が隣にいるときの説明と、灰原の「両隣、見てみ」のあとに足す行
export function gradPartnerLine(s: GameState): string | undefined {
  if (career(s) === 'circle' && sakura(s) && !s.flags.reform) return 'サークルの部室から数えて、5年目の隣だ。'
  return undefined
}

export function gradLines(s: GameState): string[] {
  if (career(s) === 'circle') return ['ナレーション：大学の卒業式から、ちょうど1年。あの日、サークルの同期はみんな就職の話をしていた。']
  if (career(s) === 'salaryman') return ['ナレーション：入学式は、スーツで来た。今日は、いつもの服で来た。']
  return []
}

// 芸人1年目の3月に足す一文
export function epilogueTail(s: GameState): string {
  if (career(s) === 'circle') return 'サークルの後輩が2人、大笑芸能学院に入ってきた。「先輩、芸歴10年ですよね」と言われた。'
  if (career(s) === 'salaryman')
    return s.flags.joushi_keep
      ? '財布の奥の名刺は、まだ捨てていない。前の会社の同期から、結婚式の余興を頼まれた。'
      : '前の会社の同期から、結婚式の余興を頼まれた。ご祝儀より高いギャラを言われた。'
  return ''
}

import type { StatKey } from '../types'

// 予定の画面には書いていない、たまに起きる能力アップ（だいたい10回に1回）
// その行動で起きそうなことだけを書く。文の最後に上がった能力を添える
export interface Lucky {
  line: string
  stat: StatKey
  amount: number
}

export const LUCKY_CHANCE = 0.1

export const LUCKY: Record<string, Lucky[]> = {
  neta: [
    { line: '電車で隣の親子の会話を聞いていたら、そのままネタの設定になった。', stat: 'word', amount: 3 },
    { line: 'ノートの端に書いた落書きから、ボケが3つ生まれた。', stat: 'idea', amount: 3 },
    { line: 'ネタを声に出して読んだら、自分で笑ってしまった。どこが面白いか分かった気がする。', stat: 'expr', amount: 2 },
  ],
  awase: [
    { line: '合わせの途中で相方が噛んだ。そのまま拾ったら、元の台本より面白くなった。', stat: 'adlib', amount: 3 },
    { line: '通りがかりの小学生が足を止めて笑った。初めての「知らない客」だった。', stat: 'guts', amount: 3 },
    { line: '相方のツッコミの言い方を一語変えたら、急に締まった。', stat: 'word', amount: 2 },
  ],
  jishuren: [
    { line: '練習のあと、通りすがりのおじいさんに「声がええな」と言われた。', stat: 'expr', amount: 2 },
    { line: 'いつもより一往復長く続いた。体が少し慣れてきた。', stat: 'stamina', amount: 3 },
    { line: '鏡に映った自分の顔が、思ったより死んでいた。直したら、急に表情が出るようになった。', stat: 'expr', amount: 3 },
  ],
  baito: [
    { line: '酔ったお客さんに無茶ぶりされて、とっさに返したら店中が笑った。', stat: 'adlib', amount: 3 },
    { line: '店長に「お前、声通るな」と言われて、注文を通す係になった。', stat: 'expr', amount: 2 },
    { line: '常連さんの話がとにかく長い。相づちだけで30分もたせた。', stat: 'adlib', amount: 2 },
  ],
  jishulive: [
    { line: '前の組がスベって客席が冷えきった。それでも最後まで声を張れた。', stat: 'guts', amount: 3 },
    { line: 'マイクの電源が切れた。地声でやったら、そっちのほうがウケた。', stat: 'adlib', amount: 3 },
  ],
  kangeki: [
    { line: 'トリの漫才の「間」が忘れられない。帰りの電車で何度も頭の中で再生した。', stat: 'word', amount: 3 },
    { line: '終演後、出待ちの列で同じ芸人を好きな人と話した。何がウケるのか、客の側から少し分かった。', stat: 'idea', amount: 2 },
  ],
  tetsudai: [
    { line: '出番前の先輩が、袖で一人ずっとブツブツ言っていた。あれが本番の準備なんだと分かった。', stat: 'guts', amount: 3 },
    { line: '先輩が客席の空気を見て、ネタの順番をその場で入れ替えた。', stat: 'adlib', amount: 3 },
  ],
  rest: [
    { line: '一日寝ていたら、夢の中でボケを思いついた。起きてもまだ面白かった。', stat: 'idea', amount: 2 },
    { line: '久しぶりに何もしない日。散歩の途中で、変な看板を見つけた。', stat: 'idea', amount: 2 },
  ],
  nomi: [
    { line: '先輩が酔って、昔の失敗談を全部話してくれた。どれも笑えて、どれも勉強になった。', stat: 'word', amount: 2 },
    { line: '飲み会で急に「一発ギャグ」を振られた。なんとか乗り切った。', stat: 'guts', amount: 3 },
  ],
  douki: [
    { line: '同期の飲み会で大喜利が始まった。終電まで続いて、なぜか全勝した。', stat: 'word', amount: 3 },
    { line: '同期が真剣に自分のネタの悪いところを言ってくれた。悔しいけど、当たっていた。', stat: 'idea', amount: 2 },
  ],
  netacho: [
    { line: '夜中にネタ帳を読み返したら、半年前のボケに今ならオチがつけられると気づいた。', stat: 'idea', amount: 3 },
    { line: '一行を三通りに書き直した。三つ目が一番短くて、一番強かった。', stat: 'word', amount: 3 },
  ],
  egosa: [
    { line: '「あの人、間が独特」という書き込みを見つけた。自分では気づいていなかった。', stat: 'expr', amount: 2 },
  ],
  jikka: [
    { line: '母に今のネタを電話で聞かせたら、意外なところで笑った。', stat: 'word', amount: 2 },
    { line: '父が電話口で「お前は小さい頃から目立ちたがりやった」と言った。少し勇気が出た。', stat: 'guts', amount: 2 },
  ],
  sleep: [
    { line: 'ぐっすり眠れた。朝、体が軽い。', stat: 'stamina', amount: 2 },
  ],
}

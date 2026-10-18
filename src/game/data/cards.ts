import type { Card } from '../types'

// ネタを組み立てるカード。最初は基本カードだけ持ち、ネタ作りやイベントで増える
export const CARDS: Card[] = [
  // ツカミ
  { id: 't_jikoshoukai', name: '自己紹介でボケる', slot: 'tsukami', power: 6, style: 'both' },
  { id: 't_mitame', name: '見た目いじり', slot: 'tsukami', power: 8, style: 'manzai', tags: ['body'] },
  { id: 't_ippatsu', name: '一発ギャグ', slot: 'tsukami', power: 9, style: 'both', tags: ['body'] },
  { id: 't_jiji', name: '最近のニュースから', slot: 'tsukami', power: 10, style: 'manzai', tags: ['jiji'] },
  { id: 't_settei', name: 'いきなり設定に入る', slot: 'tsukami', power: 10, style: 'conte' },
  { id: 't_kyakuijiri', name: '客席いじり', slot: 'tsukami', power: 12, style: 'manzai' },
  { id: 't_sakuhin', name: '作り込んだ一言目', slot: 'tsukami', power: 14, style: 'both', tags: ['word'] },
  { id: 't_aisatsu', name: '挨拶をしくじる', slot: 'tsukami', power: 7, style: 'both' },
  { id: 't_kodougu', name: '小道具を出す', slot: 'tsukami', power: 8, style: 'conte', tags: ['body'] },
  { id: 't_kotowaza', name: 'ことわざの言い間違い', slot: 'tsukami', power: 9, style: 'manzai', tags: ['word'] },
  { id: 't_tension', name: 'テンション差で入る', slot: 'tsukami', power: 10, style: 'manzai' },
  { id: 't_chinmoku', name: '無言の三秒', slot: 'tsukami', power: 11, style: 'conte', tags: ['body'] },
  { id: 't_midashi', name: '見出し風の第一声', slot: 'tsukami', power: 12, style: 'manzai', tags: ['jiji', 'word'] },
  { id: 't_ireko', name: '入り方からコント', slot: 'tsukami', power: 13, style: 'conte', tags: ['niche'] },
  { id: 't_tsubushi', name: 'ツカミを相方が潰す', slot: 'tsukami', power: 15, style: 'both', tags: ['niche', 'word'] },
  // 展開
  { id: 'k_aruaru', name: 'あるある', slot: 'tenkai', power: 8, style: 'both' },
  { id: 'k_shabekuri', name: 'しゃべくり', slot: 'tenkai', power: 9, style: 'manzai', tags: ['word'] },
  { id: 'k_konbini', name: 'コンビニ店員コント', slot: 'tenkai', power: 9, style: 'conte' },
  { id: 'k_tendon', name: '天丼（くり返し）', slot: 'tenkai', power: 11, style: 'both' },
  { id: 'k_kanchigai', name: '勘違いが広がる', slot: 'tenkai', power: 12, style: 'conte' },
  { id: 'k_intelli', name: '英単語と歴史のボケ', slot: 'tenkai', power: 13, style: 'manzai', tags: ['niche', 'word'] },
  { id: 'k_kyousei', name: '強めの設定ボケ', slot: 'tenkai', power: 14, style: 'conte', tags: ['niche'] },
  { id: 'k_wordsen', name: 'ワード勝負', slot: 'tenkai', power: 16, style: 'manzai', tags: ['word'] },
  { id: 'k_iiwake', name: '言い訳が長くなる', slot: 'tenkai', power: 8, style: 'both' },
  { id: 'k_densha', name: '電車の中コント', slot: 'tenkai', power: 9, style: 'conte' },
  { id: 'k_mensetsu', name: '面接コント', slot: 'tenkai', power: 10, style: 'conte' },
  { id: 'k_noritsukkomi', name: 'ノリツッコミ', slot: 'tenkai', power: 11, style: 'manzai', tags: ['body'] },
  { id: 'k_rule', name: 'ルール説明が狂う', slot: 'tenkai', power: 12, style: 'both', tags: ['niche'] },
  { id: 'k_hayakuchi', name: '早口でまくし立てる', slot: 'tenkai', power: 12, style: 'manzai', tags: ['word'] },
  { id: 'k_jijiboke', name: '時事の言い換え', slot: 'tenkai', power: 14, style: 'manzai', tags: ['jiji', 'word'] },
  { id: 'k_sekaikan', name: '世界観の積み上げ', slot: 'tenkai', power: 15, style: 'conte', tags: ['niche'] },
  // オチ
  { id: 'o_mouee', name: '「もうええわ」', slot: 'ochi', power: 6, style: 'manzai' },
  { id: 'o_hanten', name: '立場が逆転', slot: 'ochi', power: 10, style: 'conte' },
  { id: 'o_fukusen', name: '伏線回収', slot: 'ochi', power: 13, style: 'both', tags: ['word'] },
  { id: 'o_meta', name: 'メタなオチ', slot: 'ochi', power: 12, style: 'both', tags: ['niche'] },
  { id: 'o_taiatari', name: '体を張って終わる', slot: 'ochi', power: 11, style: 'both', tags: ['body'] },
  { id: 'o_kanzen', name: '全部つながるオチ', slot: 'ochi', power: 16, style: 'both', tags: ['word'] },
  { id: 'o_shitsurei', name: '「失礼しました」で去る', slot: 'ochi', power: 7, style: 'conte' },
  { id: 'o_hashiru', name: '走って逃げる', slot: 'ochi', power: 8, style: 'conte', tags: ['body'] },
  { id: 'o_kimetsukkomi', name: '決めツッコミ', slot: 'ochi', power: 10, style: 'manzai', tags: ['word'] },
  { id: 'o_saisho', name: '最初のボケに戻る', slot: 'ochi', power: 11, style: 'both' },
  { id: 'o_kyakuseki', name: '客席を巻き込む', slot: 'ochi', power: 12, style: 'both' },
  { id: 'o_news', name: '今日のニュースで締める', slot: 'ochi', power: 12, style: 'manzai', tags: ['jiji'] },
  { id: 'o_nidan', name: '二段オチ', slot: 'ochi', power: 14, style: 'both', tags: ['word'] },
  { id: 'o_kurayami', name: '暗転の一言', slot: 'ochi', power: 15, style: 'conte', tags: ['niche'] },
]

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]))

export const STARTER_CARDS = ['t_jikoshoukai', 't_mitame', 't_settei', 'k_aruaru', 'k_konbini', 'k_shabekuri', 'o_mouee', 'o_hanten']

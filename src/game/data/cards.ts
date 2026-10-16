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
  // 展開
  { id: 'k_aruaru', name: 'あるある', slot: 'tenkai', power: 8, style: 'both' },
  { id: 'k_shabekuri', name: 'しゃべくり', slot: 'tenkai', power: 9, style: 'manzai', tags: ['word'] },
  { id: 'k_konbini', name: 'コンビニ店員コント', slot: 'tenkai', power: 9, style: 'conte' },
  { id: 'k_tendon', name: '天丼（くり返し）', slot: 'tenkai', power: 11, style: 'both' },
  { id: 'k_kanchigai', name: '勘違いが広がる', slot: 'tenkai', power: 12, style: 'conte' },
  { id: 'k_intelli', name: '英単語と歴史のボケ', slot: 'tenkai', power: 13, style: 'manzai', tags: ['niche', 'word'] },
  { id: 'k_kyousei', name: '強めの設定ボケ', slot: 'tenkai', power: 14, style: 'conte', tags: ['niche'] },
  { id: 'k_wordsen', name: 'ワード勝負', slot: 'tenkai', power: 16, style: 'manzai', tags: ['word'] },
  // オチ
  { id: 'o_mouee', name: '「もうええわ」', slot: 'ochi', power: 6, style: 'manzai' },
  { id: 'o_hanten', name: '立場が逆転', slot: 'ochi', power: 10, style: 'conte' },
  { id: 'o_fukusen', name: '伏線回収', slot: 'ochi', power: 13, style: 'both', tags: ['word'] },
  { id: 'o_meta', name: 'メタなオチ', slot: 'ochi', power: 12, style: 'both', tags: ['niche'] },
  { id: 'o_taiatari', name: '体を張って終わる', slot: 'ochi', power: 11, style: 'both', tags: ['body'] },
  { id: 'o_kanzen', name: '全部つながるオチ', slot: 'ochi', power: 16, style: 'both', tags: ['word'] },
]

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]))

export const STARTER_CARDS = ['t_jikoshoukai', 't_mitame', 't_settei', 'k_aruaru', 'k_konbini', 'k_shabekuri', 'o_mouee', 'o_hanten']

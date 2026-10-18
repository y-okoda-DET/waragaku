// キャラクリの見た目の選択肢
export const HAIR = ['#2b2b2b', '#6b4a2e', '#c99a5b', '#9a9a9a', '#b8463c', '#3d5a8a']
export const OUTFITS: { id: string; label: string; color: string }[] = [
  { id: 'parka', label: 'パーカー', color: '#7a8b6f' },
  { id: 'suit', label: 'スーツ', color: '#30343f' },
  { id: 'jacket', label: '古着ジャケット', color: '#c0703a' },
  { id: 'shirt', label: '柄シャツ', color: '#5f8fb0' },
  { id: 'jersey', label: 'ジャージ', color: '#a33b3b' },
  { id: 'tshirt', label: '白T', color: '#d8d2c4' },
]

export function outfitColor(id: string): string {
  return OUTFITS.find((o) => o.id === id)?.color ?? '#888'
}

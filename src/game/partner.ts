import { affinity } from './bonds'
import { PARTNER_CANDIDATES } from './data/people'
import { count, story } from './core'
import type { GameState, Partner } from './types'

const BOND_ID: Record<string, string> = { 向井: 'mukai', 堂島: 'dojima', 岸辺: 'kishibe', 早瀬: 'hayase' }

export function makePartner(base: Omit<Partner, 'bond' | 'role'>, s: GameState, bond: number): Partner {
  return { ...base, stats: { ...base.stats }, skills: [...base.skills], bond, role: s.player.role === 'boke' ? 'tsukkomi' : 'boke' }
}

// 組み直す相手。いま相方でない候補のうち、いちばん仲のいい人【research/02「笑いのツボが同じ」で組み直す】
export function nextPartnerBase(s: GameState): Omit<Partner, 'bond' | 'role'> {
  const pool = PARTNER_CANDIDATES.filter((c) => c.name !== s.partner?.name)
  return [...pool].sort((a, b) => affinity(s, BOND_ID[b.name]) - affinity(s, BOND_ID[a.name]))[0]
}

export function splitUp(s: GameState): void {
  const next = nextPartnerBase(s)
  s.partner = makePartner(next, s, 25)
  s.classRank = s.classRank === 'none' ? 'none' : 'ume'
  s.neta.polish = 10
  count(s, 'kaisan')
  s.weekLog.push(`${next.name}と新しくコンビを組んだ。「笑いのツボが同じやから」。名義が変わったので梅組からやり直し。`)
  story(s, 'combo_name')
}

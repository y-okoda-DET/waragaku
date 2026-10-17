import type { ReactNode } from 'react'
import { SKILL_BY_ID } from '../game/data/skills'
import type { Gender, PlayerProfile } from '../game/types'
import { heroKey, portrait } from './art'
import { outfitColor } from './looks'

export function Avatar({ hair, outfit, size = 48, long = false }: { hair: string; outfit: string; size?: number; long?: boolean }) {
  return (
    <svg width={size} height={(size * 140) / 120} viewBox="0 0 120 140" aria-hidden="true" className="avatar">
      {long && <path d="M28 58 C22 82 26 100 36 108 L44 70 Z M92 58 C98 82 94 100 84 108 L76 70 Z" fill={hair} stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />}
      <path d="M8 140 C12 108 34 98 60 98 C86 98 108 108 112 140 Z" fill={outfit} stroke="var(--ink)" strokeWidth="3" />
      <ellipse cx="60" cy="60" rx="28" ry="32" fill="var(--skin)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M30 64 C24 30 42 16 62 16 C86 16 100 34 92 68 C90 54 86 46 78 42 C72 52 56 54 44 48 C40 54 34 58 30 64 Z" fill={hair} stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="50" cy="66" rx="3.6" ry="5" fill="var(--ink)" />
      <ellipse cx="70" cy="66" rx="3.6" ry="5" fill="var(--ink)" />
      <ellipse cx="44" cy="76" rx="5" ry="2.6" fill="var(--coral)" opacity=".5" />
      <ellipse cx="76" cy="76" rx="5" ry="2.6" fill="var(--coral)" opacity=".5" />
      <path d="M53 80 Q60 87 67 80" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

// 主人公の顔。見た目は性別と経歴で決まる。絵があれば絵、なければ仮の似顔絵
export function HeroFace({ gender, career, size = 48 }: { gender: Gender | undefined; career?: string; size?: number }) {
  const src = portrait(heroKey(gender, career), 'normal')
  if (!src) return null
  return <img className="avatar hero-face" src={src} alt="" width={size} height={(size * 140) / 120} draggable={false} />
}

export function PlayerAvatar({ player, size }: { player: PlayerProfile; size?: number }) {
  if (portrait(heroKey(player.gender, player.background), 'normal')) return <HeroFace gender={player.gender} career={player.background} size={size} />
  return <Avatar hair={player.hairColor} outfit={outfitColor(player.outfit)} size={size} long={player.gender === 'female'} />
}

// tone="level" は値で色が変わる（〜24 赤、〜49 黄、〜74 緑、75〜 青）。人間関係のゲージに使う
export function Bar({ label, value, max = 100, tone }: { label: string; value: number; max?: number; tone?: 'warn' | 'good' | 'level' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const cls = tone === 'level' ? `lv${Math.min(3, Math.floor(pct / 25))}` : (tone ?? '')
  return (
    <div className="bar">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="bar-value">{Math.round(value)}</span>
    </div>
  )
}

export function SkillBadge({ id }: { id: string }) {
  const def = SKILL_BY_ID[id]
  if (!def) return null
  const shape = def.kind === 'buki' ? '●' : def.kind === 'kuse' ? '▲' : def.kind === 'gift' ? '◆' : '★'
  return (
    <span className={`skill skill-${def.kind}`} title={def.desc}>
      <span className="skill-shape" aria-hidden="true">
        {shape}
      </span>
      {def.name}
    </span>
  )
}

export function Modal({ title, children, onNext, nextLabel = '次へ' }: { title: string; children: ReactNode; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <button className="primary" onClick={onNext}>
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

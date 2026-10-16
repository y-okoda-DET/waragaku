import type { ReactNode } from 'react'
import { SKILL_BY_ID } from '../game/data/skills'

export function Avatar({ hair, outfit, size = 48 }: { hair: string; outfit: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="avatar">
      <rect x="6" y="34" width="36" height="14" rx="7" fill={outfit} />
      <circle cx="24" cy="22" r="12" fill="var(--skin)" />
      <path d="M12 21c0-9 6-13 12-13s12 4 12 13c-3-4-7-6-12-6s-9 2-12 6z" fill={hair} />
      <circle cx="19.5" cy="23" r="1.4" fill="var(--ink)" />
      <circle cx="28.5" cy="23" r="1.4" fill="var(--ink)" />
      <path d="M20 28c2 1.6 6 1.6 8 0" stroke="var(--ink)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Bar({ label, value, max = 100, tone }: { label: string; value: number; max?: number; tone?: 'warn' | 'good' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="bar">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill ${tone ?? ''}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="bar-value">{Math.round(value)}</span>
    </div>
  )
}

export function SkillBadge({ id }: { id: string }) {
  const def = SKILL_BY_ID[id]
  if (!def) return null
  const shape = def.kind === 'buki' ? '●' : def.kind === 'kuse' ? '▲' : '★'
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

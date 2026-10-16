import { useMemo, useState } from 'react'
import { buildEpilogue } from '../game/epilogue'
import { STAT_KEYS, STAT_LABEL, type GameState } from '../game/types'
import { Bar, PlayerAvatar, SkillBadge } from './parts'

export function ResultScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const ep = useMemo(() => buildEpilogue(state), [state])
  const [shown, setShown] = useState(0)
  const [copied, setCopied] = useState(false)
  const allShown = shown >= ep.months.length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ep.shareText)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(ep.shareText)}`

  return (
    <div className="screen">
      <section className="card result-head">
        <div className="small">卒業</div>
        <div className="result-row">
          <PlayerAvatar player={state.player} size={64} />
          <div>
            <div className="me-name">{state.player.name}</div>
            <div className="combo">「{state.comboName}」</div>
          </div>
          <div className="rank">{ep.rank}</div>
        </div>
        <p className="small">
          卒業大会：{ep.gradText} ／ 同期 300人 → {state.classmates}人 ／ ファン {state.fans}人
        </p>
        {state.contestResults.map((c) => (
          <p key={c.name} className="small">
            {c.name}（在学中）：{c.result}
          </p>
        ))}
      </section>

      <section className="card">
        <h2>能力</h2>
        {STAT_KEYS.map((k) => (
          <Bar key={k} label={STAT_LABEL[k]} value={state.stats[k]} />
        ))}
        <div className="skills">
          {state.skills.map((id) => (
            <SkillBadge key={id} id={id} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>芸人1年目</h2>
        <ol className="months">
          {ep.months.slice(0, shown).map((m) => (
            <li key={m.label}>
              <span className="month">{m.label}</span>
              <span>{m.text}</span>
            </li>
          ))}
        </ol>
        {!allShown ? (
          <button className="primary" onClick={() => setShown((v) => v + 1)}>
            {shown === 0 ? '1年目を見る' : '次の月へ'}
          </button>
        ) : (
          <p className="route">{ep.route}</p>
        )}
      </section>

      {allShown && (
        <section className="card">
          <h2>結果をシェア</h2>
          <pre className="share">{ep.shareText}</pre>
          <div className="row">
            <button onClick={copy}>{copied ? 'コピーしました' : 'テキストをコピー'}</button>
            <a className="button" href={tweetUrl} target="_blank" rel="noreferrer">
              Xに投稿
            </a>
          </div>
        </section>
      )}

      <button className="primary big" onClick={onRestart}>
        もう一度入学する
      </button>
    </div>
  )
}

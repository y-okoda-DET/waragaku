import { Fragment, useMemo, useState } from 'react'
import { buildEpilogue, scoreParts } from '../game/epilogue'
import type { GameState } from '../game/types'
import { portrait } from './art'
import { PlayerAvatar, SkillBadge } from './parts'

export function ResultScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const ep = useMemo(() => buildEpilogue(state), [state])
  const [shown, setShown] = useState(0)
  const [copied, setCopied] = useState(false)
  const allShown = shown >= ep.months.length
  const rv = ep.review
  const parts = useMemo(() => scoreParts(state), [state])
  const tsujido = portrait('tsujido', 'think')

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
        <div className="small">卒業 ／ 通信簿</div>
        <div className="result-row">
          <PlayerAvatar player={state.player} size={64} />
          <div>
            <div className="me-name">{state.player.name}</div>
            {state.comboName && <div className="combo">「{state.comboName}」</div>}
          </div>
          <div className="rank">{ep.rank}</div>
        </div>
        <div className="result-title">
          <span className="small">称号</span>
          <strong>{rv.title}</strong>
        </div>
        <dl className="score-parts" aria-label="総合評価の内訳">
          {parts.map((p) => (
            <div key={p.label}>
              <dt>{p.label}</dt>
              <dd>{p.value > 0 && p.label !== '能力' ? `+${p.value}` : p.value}</dd>
            </div>
          ))}
          <div className="sum">
            <dt>合計</dt>
            <dd>{ep.total}点</dd>
          </div>
        </dl>
        <div className="grades">
          {rv.grades.map((g) => (
            <div key={g.key} className="grade-tile">
              <span className={`grade grade-${g.grade}`}>{g.grade}</span>
              <span className="grade-label">{g.label}</span>
              <span className="grade-value">{g.value}</span>
            </div>
          ))}
        </div>
        <div className="review">
          {tsujido && <img src={tsujido} alt="" className="review-face" draggable={false} />}
          <div>
            <div className="small">講師・辻堂の寸評</div>
            <p>{rv.comment}</p>
          </div>
        </div>
        <dl className="result-facts">
          {rv.kodawari && (
            <>
              <dt>譲れないもの</dt>
              <dd>{rv.kodawari}</dd>
            </>
          )}
          <dt>卒業式の隣</dt>
          <dd>{rv.neighbor}</dd>
          <dt>同期</dt>
          <dd>300人 → {state.classmates}人</dd>
          <dt>卒業大会</dt>
          <dd>{ep.gradText}</dd>
          <dt>ファン</dt>
          <dd>{state.fans}人</dd>
          {state.contestResults.map((c) => (
            <Fragment key={c.name}>
              <dt>{c.name}</dt>
              <dd>{c.result}</dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <section className="card">
        <h2>芸風と特殊能力</h2>
        <div className="skills">
          {state.skills.map((id) => (
            <SkillBadge key={id} id={id} />
          ))}
        </div>
        {rv.gifts.length > 0 && (
          <ul className="gifts">
            {rv.gifts.map((g) => (
              <li key={g.name}>
                「{g.name}」は{g.from}から受け継いだ
              </li>
            ))}
          </ul>
        )}
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

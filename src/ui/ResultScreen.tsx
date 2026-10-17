import { Fragment, useEffect, useMemo, useState } from 'react'
import { buildEpilogue, nextGoal, scoreParts } from '../game/epilogue'
import type { GameState } from '../game/types'
import { portrait } from './art'
import { PlayerAvatar, SkillBadge } from './parts'
import { drawShareCard } from './shareCard'

// claude.ai の公開ページで使える保存の仕組み（ないときは null。ふつうのブラウザでは window.claude がない）
type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> }
type ClaudeRuntime = { use: (name: 'downloads') => Promise<Downloads | null> }
const runtime = (): ClaudeRuntime | undefined => (window as unknown as { claude?: ClaudeRuntime }).claude

export function ResultScreen({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const ep = useMemo(() => buildEpilogue(state), [state])
  const [shown, setShown] = useState(0)
  const [copied, setCopied] = useState(false)
  const allShown = shown >= ep.months.length
  const rv = ep.review
  const parts = useMemo(() => scoreParts(state), [state])
  const goal = useMemo(() => nextGoal(state, parts.reduce((a, p) => a + p.value, 0)), [state, parts])
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

  // シェア用の画像は、1年目を見終わってから作る
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null)
  const [downloads, setDownloads] = useState<Downloads | null>(null)
  const [saveNote, setSaveNote] = useState('')
  useEffect(() => {
    if (!allShown) return
    let url = ''
    let alive = true
    drawShareCard(state, ep).then((blob) => {
      if (!alive || !blob) return
      url = URL.createObjectURL(blob)
      setCard({ blob, url })
    })
    runtime()
      ?.use('downloads')
      .then((d) => alive && setDownloads(d))
      .catch(() => {})
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [allShown, state, ep])
  const fileName = `waragaku_${ep.rank}.png`
  const file = card ? new File([card.blob], fileName, { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  const saveImage = async () => {
    if (!card || !downloads) return
    try {
      await downloads.save({ filename: fileName, data: card.blob })
      setSaveNote('保存しました')
    } catch (e) {
      setSaveNote((e as { code?: string }).code === 'declined' ? '' : '保存できませんでした。画像を長押しして保存してください')
    }
  }
  const shareImage = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: ep.shareText })
    } catch {
      // 共有をやめたときは何もしない
    }
  }

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
        {goal && (
          <div className="next-goal">
            <b>
              {goal.rank}まで、あと{goal.need}点
            </b>
            {goal.tips.length > 0 && (
              <ul>
                {goal.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}
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
                ◆「{g.name}」は{g.from}から受け継いだ
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
          {card ? (
            <img className="share-card" src={card.url} alt={`ワラガク！卒業の結果。総合${ep.rank}、称号「${rv.title}」`} />
          ) : (
            <div className="share-card loading">画像を作っています…</div>
          )}
          {(downloads || canShareFile) && (
            <div className="row">
              {downloads && (
                <button onClick={saveImage} disabled={!card}>
                  画像を保存
                </button>
              )}
              {canShareFile && <button onClick={shareImage}>画像をシェア</button>}
            </div>
          )}
          {saveNote ? <p className="small">{saveNote}</p> : !downloads && !canShareFile && <p className="small">画像は長押し（右クリック）で保存できます</p>}
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

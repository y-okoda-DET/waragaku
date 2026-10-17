import { KIND_ORDER, KIWAMI_HINT, RIVAL_ENDINGS, ROUTES, type Album } from '../game/album'
import { SKILLS } from '../game/data/skills'
import { CAREERS } from '../game/careers'
import { SkillBadge } from './parts'

// 卒業アルバム。見たもの・取ったものを周をまたいで並べ、まだのところは伏せて数だけ見せる
export function AlbumScreen({ album, onBack }: { album: Album; onBack: () => void }) {
  const total = SKILLS.length + ROUTES.length + RIVAL_ENDINGS.length + CAREERS.length
  const have = album.skills.length + album.routes.length + album.rivals.length + album.careers.length
  return (
    <div className="screen album">
      <section className="card">
        <div className="small">大笑芸能学院</div>
        <h2>卒業アルバム</h2>
        <dl className="result-facts">
          <dt>卒業した回数</dt>
          <dd>{album.runs}回</dd>
          <dt>いちばん良い評価</dt>
          <dd>{album.bestRank ? `${album.bestRank}${album.bestScore !== undefined ? `（${album.bestScore}点）` : ''}` : '-'}</dd>
          <dt>卒業大会</dt>
          <dd>{album.bestGrad ? (album.bestGrad === 1 ? '優勝（卒業総代）' : `${album.bestGrad}位`) : '-'}</dd>
          <dt>うめた数</dt>
          <dd>
            {have} / {total}
          </dd>
        </dl>
      </section>

      <section className="card">
        <h2>キャラクター</h2>
        <ul className="album-list">
          {CAREERS.map((c, i) => (
            <li key={c.id} className={album.careers.includes(c.id) ? '' : 'locked'}>
              {i > album.runs ? `？？？（あと${i - album.runs}回卒業すると）` : album.careers.includes(c.id) ? `${c.label}で卒業` : `${c.label}（まだ卒業していない）`}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>同期の結末</h2>
        {(['mido', 'makabe'] as const).map((r) => {
          const list = RIVAL_ENDINGS.filter((e) => e.rival === r)
          const seen = list.filter((e) => album.rivals.includes(e.id)).length
          return (
            <div key={r} className="album-group">
              <h3>
                {r === 'mido' ? '御堂' : '真壁'}
                <span className="small">
                  {seen} / {list.length}
                  {!seen && (r === 'mido' ? '（漫才で入学すると）' : '（コントで入学すると）')}
                </span>
              </h3>
              <ul className="album-list">
                {list.map((e) => (
                  <li key={e.id} className={album.rivals.includes(e.id) ? '' : 'locked'}>
                    {album.rivals.includes(e.id) ? e.name : '？？？'}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <section className="card">
        <h2>芸人1年目</h2>
        <ul className="album-list">
          {ROUTES.map((r) => (
            <li key={r} className={album.routes.includes(r) ? '' : 'locked'}>
              {album.routes.includes(r) ? r : '？？？'}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>特殊能力</h2>
        {KIND_ORDER.map(({ kind, label }) => {
          const list = SKILLS.filter((d) => d.kind === kind)
          const got = list.filter((d) => album.skills.includes(d.id))
          return (
            <div key={kind} className="album-group">
              <h3>
                {label}
                <span className="small">
                  {got.length} / {list.length}
                </span>
              </h3>
              <div className="skills">
                {list.map((d) =>
                  album.skills.includes(d.id) ? (
                    <SkillBadge key={d.id} id={d.id} />
                  ) : (
                    <span key={d.id} className="skill skill-locked">
                      ？？？
                    </span>
                  ),
                )}
              </div>
              {kind === 'kiwami' && got.length < list.length && (
                <ul className="album-hints">
                  {list
                    .filter((d) => !album.skills.includes(d.id))
                    .map((d) => (
                      <li key={d.id}>{KIWAMI_HINT[d.id]}</li>
                    ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>

      <button className="big" onClick={onBack}>
        もどる
      </button>
    </div>
  )
}

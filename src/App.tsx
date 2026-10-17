import { useEffect, useState } from 'react'
import { clearSave, createGame, doStage, endEvents, load, resolveStory, runWeek, save, type NewGameInput } from './game/engine'
import { STAT_KEYS, type GameState, type StatKey, type Stats } from './game/types'
import { CreateScreen } from './ui/CreateScreen'
import { StageIntro, StageResultView, StoryScreen } from './ui/EventScreens'
import { AdvScreen } from './ui/Adv'
import { ResultScreen } from './ui/ResultScreen'
import { ShowcaseScreen } from './ui/ShowcaseScreen'
import { pickScenes, type Scene } from './game/showcase'
import { WeekScreen } from './ui/WeekScreen'
import { AlbumScreen } from './ui/AlbumScreen'
import { loadAlbum } from './game/album'

type Popup = { title: string; lines: string[]; dayLines?: number } | null

export default function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [creating, setCreating] = useState(false)
  const [popup, setPopup] = useState<Popup>(null)
  const [stageShown, setStageShown] = useState(false)
  const [scenes, setScenes] = useState<Scene[] | null>(null)
  // 最後に行動選択の画面を見せた週と、そのときの能力。週が変わったら切り替えの演出を入れ、上がった能力を光らせる
  const [shown, setShown] = useState<{ turn: number; stats: Stats } | null>(null)
  const [albumOpen, setAlbumOpen] = useState(false)
  const saved = load()

  useEffect(() => {
    if (game) save(game)
  }, [game])

  const onWeek = !!game && game.phase === 'week' && !popup && !stageShown
  useEffect(() => {
    if (onWeek && game && shown?.turn !== game.turn) setShown({ turn: game.turn, stats: { ...game.stats } })
  }, [onWeek, game, shown])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [game?.turn, game?.pending.length, game?.phase])

  // エンジンの処理結果を反映し、ログがあればポップアップで見せる
  const apply = (next: GameState, title: string, week = false) => {
    if (next.weekLog.length) setPopup({ title, lines: next.weekLog, dayLines: week ? next.dayLines : undefined })
    if (!next.pending.length && next.phase === 'event' && !next.weekLog.length) {
      const after = endEvents(next)
      setGame(after)
      if (after.weekLog.length) setPopup({ title: 'お知らせ', lines: after.weekLog })
      return
    }
    setGame(next)
  }

  const closePopup = () => {
    setPopup(null)
    if (game && !game.pending.length && game.phase === 'event' && !stageShown) {
      const next = endEvents(game)
      setGame(next)
      if (next.weekLog.length) setPopup({ title: 'お知らせ', lines: next.weekLog })
    }
  }

  useEffect(() => {
    if (albumOpen) window.scrollTo(0, 0)
  }, [albumOpen])
  if (albumOpen) return <AlbumScreen album={loadAlbum()} onBack={() => setAlbumOpen(false)} />

  if (!game) {
    if (creating)
      return (
        <CreateScreen
          runs={loadAlbum().runs}
          onBack={() => setCreating(false)}
          onStart={(input: NewGameInput) => {
            setCreating(false)
            setGame(createGame(input))
          }}
        />
      )
    return (
      <div className="screen title">
        <span className="blob" style={{ right: -80, top: 40, width: 260, height: 260, background: 'var(--sun)' }} />
        <span className="blob" style={{ left: -70, bottom: 80, width: 200, height: 200, background: 'var(--coral-light)' }} />
        <div className="title-mark">大笑芸能学院</div>
        <h1 className="title-logo">
          ワラガク<span className="bang">！</span>
          <small>とあるお笑い養成所の一年</small>
        </h1>
        <p className="title-lead">
          入学から卒業までの1年。
          <br />
          同期は300人。
          <br />
          卒業するころには、
          <br />
          両隣はいなくなっている。
        </p>
        <button className="primary big" onClick={() => setCreating(true)}>
          入学する
        </button>
        {saved && (
          <button className="big" onClick={() => setGame(saved)}>
            続きから（{saved.player.callName}）
          </button>
        )}
        {loadAlbum().runs > 0 && (
          <button className="big" onClick={() => setAlbumOpen(true)}>
            卒業アルバム
          </button>
        )}
        <p className="small center">登場する養成所・事務所・劇場・大会・人物はすべて架空です。</p>
      </div>
    )
  }

  const restart = () => {
    clearSave()
    setGame(null)
    setCreating(true)
  }

  let body
  if (game.phase === 'result') body = <ResultScreen state={game} onRestart={restart} onAlbum={() => setAlbumOpen(true)} />
  else if (stageShown && game.lastStage)
    body = (
      <div className="screen event">
        <StageResultView result={game.lastStage} />
        <button
          className="primary big"
          onClick={() => {
            setStageShown(false)
            if (!game.pending.length) {
              const next = endEvents(game)
              setGame(next)
              if (next.weekLog.length) setPopup({ title: 'お知らせ', lines: next.weekLog })
            }
          }}
        >
          次へ
        </button>
      </div>
    )
  else if (game.phase === 'week') {
    const fresh = shown?.turn !== game.turn
    const gains: Partial<Record<StatKey, number>> = {}
    if (fresh && shown)
      for (const k of STAT_KEYS) {
        const d = Math.round(game.stats[k]) - Math.round(shown.stats[k])
        if (d > 0) gains[k] = d
      }
    body = (
      <WeekScreen
        key={game.turn}
        state={game}
        intro={fresh}
        gains={gains}
        onNeta={setGame}
        onRun={(d, n, label) => apply(runWeek(game, d, n), label, true)}
      />
    )
  }
  else {
    const ev = game.pending[0]
    if (!ev) body = <div className="screen" />
    else if (ev.type === 'story')
      body = <StoryScreen key={`${game.turn}-${ev.key}-${game.pending.length}`} state={game} eventKey={ev.key} params={ev.params} onChoose={(c, t) => apply(resolveStory(game, c, t), 'その結果')} />
    else if (scenes)
      body = (
        <ShowcaseScreen
          key={`${game.turn}-${game.pending.length}`}
          state={game}
          kind={ev.kind}
          scenes={scenes}
          onDone={(grades) => {
            setScenes(null)
            setGame(doStage(game, grades))
            setStageShown(true)
          }}
        />
      )
    else body = <StageIntro state={game} kind={ev.kind} onNeta={setGame} onPerform={() => setScenes(pickScenes(game, ev.kind))} />
  }

  // 結果は会話画面で読み切ってから、次のイベントに進む
  if (popup) return <AdvScreen key={`${game.turn}-${popup.title}-${popup.lines.join('').length}-${game.pending.length}`} state={game} title={popup.title} lines={popup.lines} dayLines={popup.dayLines} onEnd={closePopup} />
  return body
}

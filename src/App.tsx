import { useEffect, useState } from 'react'
import { clearSave, createGame, doStage, endEvents, load, resolveStory, runWeek, save, type NewGameInput } from './game/engine'
import type { GameState } from './game/types'
import { CreateScreen } from './ui/CreateScreen'
import { StageIntro, StageResultView, StoryScreen } from './ui/EventScreens'
import { Modal } from './ui/parts'
import { ResultScreen } from './ui/ResultScreen'
import { PracticeScreen } from './ui/PracticeScreen'
import { ShowcaseScreen } from './ui/ShowcaseScreen'
import { pickScenes, type Scene } from './game/showcase'
import { WeekScreen } from './ui/WeekScreen'

type Popup = { title: string; lines: string[] } | null

export default function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [creating, setCreating] = useState(false)
  const [practice, setPractice] = useState(false)
  const [popup, setPopup] = useState<Popup>(null)
  const [stageShown, setStageShown] = useState(false)
  const [scenes, setScenes] = useState<Scene[] | null>(null)
  const saved = load()

  useEffect(() => {
    if (game) save(game)
  }, [game])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [game?.turn, game?.pending.length, game?.phase])

  // エンジンの処理結果を反映し、ログがあればポップアップで見せる
  const apply = (next: GameState, title: string) => {
    if (next.weekLog.length) setPopup({ title, lines: next.weekLog })
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

  if (!game) {
    if (practice) return <PracticeScreen onBack={() => setPractice(false)} />
    if (creating)
      return (
        <CreateScreen
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
          ワラガク！
          <small>お笑い養成所の1年</small>
        </h1>
        <p className="title-lead">入学から卒業までの1年。同期は300人。卒業するころには、両隣はいなくなっている。</p>
        <button className="primary big" onClick={() => setCreating(true)}>
          入学する
        </button>
        {saved && (
          <button className="big" onClick={() => setGame(saved)}>
            続きから（{saved.player.callName}）
          </button>
        )}
        <button className="big" onClick={() => setPractice(true)}>
          ミニゲームだけ遊ぶ
        </button>
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
  if (game.phase === 'result') body = <ResultScreen state={game} onRestart={restart} />
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
  else if (game.phase === 'week') body = <WeekScreen state={game} onNeta={setGame} onRun={(d, n) => apply(runWeek(game, d, n), '今週のできごと')} />
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

  return (
    <>
      {body}
      {popup && (
        <Modal title={popup.title} onNext={closePopup}>
          {popup.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </Modal>
      )}
    </>
  )
}

// 効果音とBGM。スマホのブラウザは最初のタップまで音を出せないので、タップされた時点で鳴らす準備をする
// BGMは前後に0.1秒の余白をつけて書き出してあり、余白の内側をループする（つなぎ目は書き出すときに重ねてある）
import { useEffect, useSyncExternalStore } from 'react'

const FILES = import.meta.glob('../assets/audio/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>
const URLS: Record<string, string> = {}
for (const [path, url] of Object.entries(FILES)) URLS[path.slice(path.lastIndexOf('/') + 1, -'.mp3'.length)] = url

export type Bgm = 'title' | 'daily' | 'stage' | 'night' | 'grad'
export type Se = 'tap' | 'decide' | 'laugh_big' | 'laugh_small' | 'clap' | 'cheer' | 'suberi' | 'tsukkomi' | 'buzzer' | 'rank'

// ループの長さ（秒）。scripts/audio_loop.py が出した値（効果音は scripts/audio_se.py で加工）
const LOOP: Record<Bgm | 'zawa', number> = { title: 31.689, daily: 63.271, stage: 44.448, night: 45.163, grad: 56.89, zawa: 10 }
const PAD = 0.1

type Settings = { on: boolean; bgm: number; se: number }
const KEY = 'waragaku_sound_v1'
let settings: Settings = { on: true, bgm: 0.6, se: 0.8 }
try {
  const raw = localStorage.getItem(KEY)
  if (raw) settings = { ...settings, ...JSON.parse(raw) }
} catch {
  // 保存できない環境では、遊んでいる間だけ覚える
}
const listeners = new Set<() => void>()

export function setSound(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // 同上
  }
  applyVolumes()
  listeners.forEach((f) => f())
}

export function useSound(): Settings {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => settings,
  )
}

let ctx: AudioContext | null = null
let bgmGain: GainNode | null = null
let seGain: GainNode | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()

function buffer(name: string): Promise<AudioBuffer | null> {
  let b = buffers.get(name)
  if (!b) {
    const c = ctx!
    b = fetch(URLS[name])
      .then((r) => r.arrayBuffer())
      .then((a) => c.decodeAudioData(a))
      .catch(() => null)
    buffers.set(name, b)
  }
  return b
}

function applyVolumes() {
  if (!ctx || !bgmGain || !seGain) return
  const t = ctx.currentTime
  bgmGain.gain.setTargetAtTime(settings.on ? settings.bgm : 0, t, 0.1)
  seGain.gain.setTargetAtTime(settings.on ? settings.se : 0, t, 0.02)
}

// 最初のタップで音の準備をして、待っていたBGMを鳴らし始める
function unlock() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    bgmGain = ctx.createGain()
    seGain = ctx.createGain()
    bgmGain.connect(ctx.destination)
    seGain.connect(ctx.destination)
    applyVolumes()
    for (const n of ['tap', 'decide']) void buffer(`se_${n}`)
  }
  if (ctx.state !== 'running') void ctx.resume()
  sync()
}

// ボタンの音は、画面ごとに書かずにまとめて鳴らす。選択肢と大きいボタンは決定音、それ以外は軽い音
function onClick(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  const btn = el?.closest('button')
  if (btn?.disabled) return
  if (btn?.classList.contains('option') || btn?.classList.contains('primary')) se('decide')
  else if (btn || el?.closest('.adv') || el?.closest('.chip')) se('tap')
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
  window.addEventListener('click', onClick, true)
}

// 流したい曲（画面が決める）と、いま流れている曲
type Track = { name: string; src: AudioBufferSourceNode; gain: GainNode }
let wantBgm: Bgm | null = null
let wantAmb: 'zawa' | null = null
let curBgm: Track | null = null
let curAmb: Track | null = null
let syncing = 0

function stop(t: Track | null) {
  if (!t || !ctx) return
  const now = ctx.currentTime
  t.gain.gain.setTargetAtTime(0, now, 0.25)
  t.src.stop(now + 1.5)
}

async function start(name: string, file: string, level: number): Promise<Track | null> {
  const b = await buffer(file)
  if (!b || !ctx || !bgmGain) return null
  const src = ctx.createBufferSource()
  src.buffer = b
  src.loop = true
  src.loopStart = PAD
  src.loopEnd = Math.min(PAD + LOOP[name as Bgm], b.duration)
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.gain.setTargetAtTime(level, ctx.currentTime, 0.3)
  src.connect(gain).connect(bgmGain)
  src.start(0, PAD)
  return { name, src, gain }
}

async function sync() {
  if (!ctx) return
  const id = ++syncing
  if (curBgm?.name !== (wantBgm ?? '')) {
    stop(curBgm)
    curBgm = null
    if (wantBgm) {
      const t = await start(wantBgm, `bgm_${wantBgm}`, 1)
      if (id !== syncing) return stop(t)
      curBgm = t
    }
  }
  if (curAmb?.name !== (wantAmb ?? '')) {
    stop(curAmb)
    curAmb = null
    if (wantAmb) {
      const t = await start(wantAmb, 'se_zawa', 0.8)
      if (id !== syncing) return stop(t)
      curAmb = t
    }
  }
}

// 画面が流したい曲を伝える。null で止める
export function playBgm(name: Bgm | null, ambient: 'zawa' | null = null) {
  if (name === wantBgm && ambient === wantAmb) return
  wantBgm = name
  wantAmb = ambient
  void sync()
}

export function se(name: Se, delay = 0) {
  if (!ctx || !seGain || !settings.on) return
  const out = seGain
  const c = ctx
  void buffer(`se_${name}`).then((b) => {
    if (!b) return
    const src = c.createBufferSource()
    src.buffer = b
    src.connect(out)
    src.start(c.currentTime + delay)
  })
}

// 画面ごとの曲。undefined なら何もしない（中の画面に任せる）
export function useBgm(name: Bgm | null | undefined, ambient: 'zawa' | null = null) {
  useEffect(() => {
    if (name !== undefined) playBgm(name, ambient)
  }, [name, ambient])
}

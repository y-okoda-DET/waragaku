import type { ResultSummary } from '../game/epilogue'
import type { GameState } from '../game/types'
import { careerBadge } from '../game/careers'
import { charaKey, heroKey, portrait } from './art'

// 卒業の結果を、Xに貼れる横長の画像（1200×675）にする
const W = 1200
const H = 675
const INK = '#1a1a1a'
const CREAM = '#fffaf0'
const SUN = '#ffc93c'
const CORAL = '#ff6b57'
const MINCHO = "'Tsukuhou Shogo Mincho'"
const DISPLAY = "'Dela Gothic One', 'M PLUS Rounded 1c', sans-serif"
const ROUND = "'M PLUS Rounded 1c', sans-serif"
const GRADE_BG: Record<string, [string, string]> = {
  S: ['#d99a00', '#fff'],
  A: [CORAL, '#fff'],
  B: [SUN, INK],
  C: ['#9fd8a8', INK],
  D: ['#a9c8ec', INK],
}

function loadImage(src: string | undefined): Promise<HTMLImageElement | undefined> {
  if (!src) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(undefined)
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

// 太い黒枠と、右下に落ちる黒い影（ゲームのカードと同じ見た目）
function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 18) {
  roundRect(ctx, x + 6, y + 6, w, h, r)
  ctx.fillStyle = INK
  ctx.fill()
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = INK
  ctx.stroke()
}

// 縁取りと影つきの文字（タイトルロゴや評価の文字）
function boldText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, stroke: number, shadow: number) {
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke * 2
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.strokeText(text, x + shadow, y + shadow)
  ctx.fillText(text, x + shadow, y + shadow)
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

// 1行に収まらないときは文字を小さくする
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, size: number, maxWidth: number, min = 18): number {
  let s = size
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) break
  }
  return s
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    // 句読点や閉じかっこは行の頭に置かない（前の行にはみ出させる）
    if (ctx.measureText(cur + ch).width > maxWidth && !'。、」）！？…'.includes(ch)) {
      lines.push(cur)
      cur = ch
      if (lines.length === maxLines) break
    } else cur += ch
  }
  if (lines.length < maxLines) lines.push(cur)
  else lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'
  return lines
}

export async function drawShareCard(state: GameState, ep: ResultSummary): Promise<Blob | null> {
  const rv = ep.review
  const name = state.player.name
  const combo = state.comboName ? `「${state.comboName}」` : ''
  const facts = `同期300人 → ${state.classmates}人\u3000卒業大会 ${ep.gradText}`
  await Promise.all(
    [`40px ${MINCHO}`, `40px ${DISPLAY}`, `900 40px ${ROUND}`, `700 40px ${ROUND}`].map((f) =>
      document.fonts.load(f, `ワラガク！${rv.title}${name}${combo}${facts}${rv.oneLine}${ep.rank}SABCDEFG卒業称号講師の寸評#`).catch(() => []),
    ),
  )
  const r = 'SABCDEFG'.indexOf(ep.rank)
  const expr = r <= 2 ? 'laugh' : r <= 4 ? 'smile' : 'think'
  const partnerKey = state.partner ? charaKey(state, state.partner.name) : undefined
  const [hero, partner] = await Promise.all([loadImage(portrait(heroKey(state.player.gender, state.player.background), expr)), loadImage(portrait(partnerKey, 'smile'))])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.textBaseline = 'alphabetic'

  // 背景：クリーム地に、黄とコーラルの丸
  ctx.fillStyle = CREAM
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = SUN
  ctx.beginPath()
  ctx.arc(1010, 300, 330, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffe3dc'
  ctx.beginPath()
  ctx.arc(-40, 690, 200, 0, Math.PI * 2)
  ctx.fill()

  // 右：相方と主人公の立ち絵（下を画像の端で切る）
  const drawChara = (img: HTMLImageElement, cx: number, h: number) => {
    const w = (img.width / img.height) * h
    ctx.drawImage(img, cx - w / 2, H - h + h * 0.08, w, h)
  }
  if (partner) {
    ctx.save()
    ctx.filter = 'brightness(0.9)'
    drawChara(partner, 1080, 400)
    ctx.restore()
  }
  if (hero) drawChara(hero, partner ? 900 : 980, 470)

  // 右上：総合評価
  ctx.font = `150px ${DISPLAY}`
  ctx.textAlign = 'center'
  boldText(ctx, ep.rank, 1060, 190, CORAL, 6, 7)
  ctx.font = `900 22px ${ROUND}`
  card(ctx, 1005, 205, 110, 36, CREAM, 18)
  ctx.fillStyle = INK
  ctx.fillText('総合評価', 1060, 231)
  ctx.textAlign = 'left'

  // 左上：ロゴ
  ctx.font = `900 20px ${ROUND}`
  roundRect(ctx, 60, 44, 196, 36, 18)
  ctx.fillStyle = INK
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText('大笑芸能学院 卒業', 78, 69)
  // 経歴（高校卒業以外のときだけ）
  const career = careerBadge(state.player.background)
  if (career) {
    const cw = ctx.measureText(career).width + 36
    card(ctx, 272, 44, cw, 36, '#fff', 18)
    ctx.fillStyle = INK
    ctx.fillText(career, 290, 69)
  }
  ctx.font = `64px ${MINCHO}`
  boldText(ctx, 'ワラガク', 60, 152, CORAL, 4, 5)
  const lw = ctx.measureText('ワラガク').width
  boldText(ctx, '！', 60 + lw - 12, 152, CORAL, 4, 5)

  // 名前とコンビ名
  fitFont(ctx, `${name}\u3000${combo}`, ROUND, '900', 38, 640)
  ctx.fillStyle = INK
  ctx.fillText(`${name}\u3000${combo}`, 62, 214)

  // 称号（めくり風の白い札）
  card(ctx, 60, 240, 660, 128, '#fff')
  ctx.font = `900 18px ${ROUND}`
  ctx.fillStyle = CORAL
  ctx.fillText('称号', 84, 272)
  fitFont(ctx, rv.title, MINCHO, '400', 58, 610)
  ctx.fillStyle = INK
  ctx.fillText(rv.title, 84, 342)

  // 能力の評価
  const tw = 100
  rv.grades.forEach((g, i) => {
    const x = 60 + i * (tw + 12)
    const [bg, fg] = GRADE_BG[g.grade] ?? ['#e6e2d8', INK]
    card(ctx, x, 392, tw, 92, bg, 14)
    ctx.textAlign = 'center'
    ctx.fillStyle = fg
    ctx.font = `44px ${DISPLAY}`
    ctx.fillText(g.grade, x + tw / 2, 442)
    ctx.font = `900 15px ${ROUND}`
    ctx.fillText(`${g.label} ${g.value}`, x + tw / 2, 472)
    ctx.textAlign = 'left'
  })

  // 同期の数と卒業大会
  fitFont(ctx, facts, ROUND, '900', 26, 660)
  ctx.fillStyle = INK
  ctx.fillText(facts, 62, 532)

  // 講師の寸評
  ctx.font = `700 22px ${ROUND}`
  const lines = wrap(ctx, `講師の寸評「${rv.oneLine}」`, 660, 2)
  lines.forEach((l, i) => ctx.fillText(l, 62, 572 + i * 32))

  ctx.font = `900 22px ${ROUND}`
  ctx.fillStyle = CORAL
  ctx.fillText('#ワラガク', 62, 648)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

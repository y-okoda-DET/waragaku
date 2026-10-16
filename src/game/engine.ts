import { BACKGROUND_BY_ID } from './data/backgrounds'
import { CARDS, STARTER_CARDS } from './data/cards'
import { TOTAL_TURNS, expectedClassmates, turnOf, weekInfo } from './data/calendar'
import { CIRCLE_PARTNER, INITIAL_SENIORS, PARTNER_CANDIDATES } from './data/people'
import { addSkill, clamp, count, gain, has, push, removeSkill, story, yen } from './core'
import { STORIES } from './events'
import { Rng } from './rng'
import { STAGES, performStage } from './stage'
import type { CardSlot, GameState, Origin, Role, Stats, Style } from './types'

export interface NewGameInput {
  name: string
  callName: string
  background: string
  origin: Origin
  role: Role
  style: Style
  hairColor: string
  outfit: string
  seed?: number
}

export type DayAction =
  | { type: 'neta' }
  | { type: 'awase'; place: 'park' | 'karaoke' | 'family' }
  | { type: 'jishuren'; kind: 'hassei' | 'kintore' | 'dance' }
  | { type: 'baito'; kind: 'izakaya' | 'karaoke' | 'hikkoshi' | 'call' }
  | { type: 'jishulive' }
  | { type: 'kangeki' }
  | { type: 'rest' }

export type NightAction = { type: 'nomi'; senior: string } | { type: 'douki' } | { type: 'netacho' } | { type: 'egosa' } | { type: 'sleep' }

const clone = (s: GameState): GameState => structuredClone(s)

function withRng(s: GameState, fn: (rng: Rng) => void): void {
  const rng = new Rng(s.rng)
  fn(rng)
  s.rng = rng.seed
}

export function createGame(input: NewGameInput): GameState {
  const bg = BACKGROUND_BY_ID[input.background]
  const base: Stats = { idea: 15, word: 15, expr: 15, guts: 15, adlib: 15, stamina: 15, ...bg.stats }
  const s: GameState = {
    version: 1,
    rng: (input.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0,
    player: { ...input },
    stats: base,
    condition: 80,
    motivation: 60,
    money: bg.money,
    skills: [...bg.skills],
    partner: null,
    comboName: '',
    seniors: INITIAL_SENIORS.map((x) => ({ ...x })),
    dokiBond: 20,
    staffEval: 10,
    outsideRep: input.background === 'chika' ? 25 : input.background === 'circle' ? 20 : 5,
    fans: 0,
    safePlay: 0,
    edge: 0,
    risk: 0,
    cards: [...STARTER_CARDS, ...(bg.cards ?? [])],
    neta: { cards: { tsukami: 't_jikoshoukai', tenkai: input.style === 'conte' ? 'k_konbini' : 'k_aruaru', ochi: input.style === 'conte' ? 'o_hanten' : 'o_mouee' }, polish: 15 },
    teacherEval: 20,
    classRank: 'none',
    classmates: 300,
    turn: 0,
    queueChoice: null,
    counters: {},
    flags: {},
    pending: [],
    weekLog: [],
    lastStage: null,
    stageHistory: [],
    contestResults: [],
    gradRank: null,
    phase: 'event',
  }
  s.flags.intro = true
  story(s, 'nyugaku')
  if (bg.startsWithPartner) {
    s.partner = { ...CIRCLE_PARTNER, stats: { ...CIRCLE_PARTNER.stats }, skills: [...CIRCLE_PARTNER.skills], bond: 60, role: input.role === 'boke' ? 'tsukkomi' : 'boke' }
    s.comboName = 'ヤマアラシの午後'
    story(s, 'jissai')
  }
  return s
}

// ---- 1週間の行動 ----

function applyDay(s: GameState, a: DayAction, rng: Rng): void {
  const log = s.weekLog
  switch (a.type) {
    case 'neta': {
      gain(s, 'idea', 3)
      gain(s, 'word', 1.5)
      s.neta.polish = clamp(s.neta.polish + (has(s, 'ryousan') ? 12 : 8))
      s.condition = clamp(s.condition - 8)
      count(s, 'neta')
      log.push(rng.pick(['深夜のファミレスでネタを書いた。ドリンクバーで5時間。', 'バイトの休憩中にネタ帳を広げた。', '「お笑い向いてないのかな…」と思いながら、それでも書いた。']))
      if (rng.chance(0.4)) {
        const fresh = CARDS.filter((c) => !s.cards.includes(c.id))
        if (fresh.length) {
          // 発想力が高いほど強いカードを引きやすい
          const sorted = [...fresh].sort((x, y) => x.power - y.power)
          const idx = Math.min(sorted.length - 1, Math.floor(rng.next() * sorted.length * (0.4 + s.stats.idea / 120)))
          s.cards.push(sorted[idx].id)
          log.push(`ネタの種「${sorted[idx].name}」を思いついた。`)
        }
      }
      break
    }
    case 'awase': {
      if (!s.partner) {
        log.push('相方がまだいない。一人で壁に向かってネタを言った。')
        gain(s, 'expr', 1)
        break
      }
      s.neta.polish = clamp(s.neta.polish + 10)
      s.partner.bond = clamp(s.partner.bond + 4)
      gain(s, 'expr', 1.5)
      s.condition = clamp(s.condition - 6)
      count(s, 'awase')
      if (a.place === 'park') {
        log.push('夜の公園でネタ合わせ。タダだけど、人目が気になる。')
        if (rng.chance(0.3)) story(s, 'park')
        else if (weekInfo(s.turn).month >= 6 && weekInfo(s.turn).month <= 9 && rng.chance(0.5)) log.push('短パンで行ったら蚊に刺されまくった。足がパイナップルみたいになった。')
      } else if (a.place === 'karaoke') {
        s.money -= 2000
        s.neta.polish = clamp(s.neta.polish + 3)
        log.push('カラオケの個室でネタ合わせ。一曲も歌わずに2時間。')
      } else {
        s.money -= 800
        s.partner.bond = clamp(s.partner.bond + 2)
        log.push('ファミレスでネタ合わせ。気づけばネタより雑談の方が長かった。')
      }
      if (rng.chance(0.08)) story(s, 'late_partner')
      break
    }
    case 'jishuren': {
      s.condition = clamp(s.condition - 10)
      if (a.kind === 'hassei') {
        gain(s, 'expr', 2)
        gain(s, 'guts', 1)
        count(s, 'hassei')
        log.push('腹式呼吸と滑舌の練習。外郎売りを3周した。')
      } else if (a.kind === 'kintore') {
        gain(s, 'stamina', 3)
        log.push('筋トレ。ボイストレーニングという名の筋トレの予習。')
      } else {
        gain(s, 'expr', 2)
        gain(s, 'stamina', 1.5)
        log.push('ダンスの自主練。真面目にやってもふざけているように見えるのが悩み。')
      }
      break
    }
    case 'baito': {
      const pay = { izakaya: 18000, karaoke: 15000, hikkoshi: 25000, call: 20000 }[a.kind]
      const bonus = has(s, 'kugaku') ? 1.25 : 1
      s.money += Math.round(pay * bonus)
      count(s, 'baito')
      if (a.kind === 'izakaya') {
        s.condition = clamp(s.condition - 10)
        s.money += 2500 // まかないで食費が浮く
        log.push('居酒屋バイト。まかないで食費が浮いた。')
      } else if (a.kind === 'karaoke') {
        s.condition = clamp(s.condition - 8)
        if (s.partner && rng.chance(0.5)) {
          s.neta.polish = clamp(s.neta.polish + 3)
          log.push('深夜のカラオケバイト。暇な時間に裏でこっそりネタを考えた。')
        } else log.push(s.player.background === 'forty' ? 'カラオケバイト。大学生の客に「おじさん頑張れ！」と言われた。' : 'カラオケの深夜バイト。')
      } else if (a.kind === 'hikkoshi') {
        s.condition = clamp(s.condition - 25)
        gain(s, 'stamina', 1)
        log.push('引越しバイト。稼げるが、翌日は寝たきりだった。')
      } else {
        s.condition = clamp(s.condition - 8)
        s.motivation = clamp(s.motivation - 3)
        gain(s, 'adlib', 0.5)
        log.push('コールセンター。顔を見られず座っていられるのは落ち着く。')
      }
      break
    }
    case 'jishulive': {
      s.money -= 2000
      s.condition = clamp(s.condition - 6)
      gain(s, 'guts', 1.5)
      gain(s, 'adlib', 2)
      s.outsideRep = clamp(s.outsideRep + 3)
      count(s, 'jishulive')
      const audience = rng.int(3, 18)
      const good = s.stats.adlib + s.stats.guts + s.neta.polish / 2 + rng.int(-20, 20) > 75
      if (good) {
        s.fans += rng.int(1, 3)
        log.push(`自主ライブに出た。エントリー料2,000円、客席${audience}人。ランク戦で1位を取った。`)
      } else log.push(`自主ライブに出た。エントリー料2,000円、客席${audience}人。ウケた記憶がない。`)
      if (rng.chance(0.1)) log.push('受付で初めて、今日はエントリー料が5,000円だと知った。')
      break
    }
    case 'kangeki': {
      s.money -= 1500
      gain(s, 'idea', 2)
      gain(s, 'word', 1.5)
      s.motivation = clamp(s.motivation + 6)
      log.push('劇場で先輩のライブを観た。勉強のつもりが、普通に笑ってしまった。')
      break
    }
    case 'rest':
      s.condition = clamp(s.condition + 30)
      s.motivation = clamp(s.motivation + 5)
      log.push('一日寝ていた。1000円カットに行った。')
      break
  }
}

function applyNight(s: GameState, a: NightAction, rng: Rng): void {
  const log = s.weekLog
  switch (a.type) {
    case 'nomi': {
      const senior = s.seniors.find((x) => x.id === a.senior)
      if (!senior) break
      senior.like = clamp(senior.like + (has(s, 'kawaigarare') ? 11 : 7))
      s.condition = clamp(s.condition - 10)
      s.money += 2500 // ごちそうになった分、食費が浮く
      s.safePlay += 1
      count(s, 'nomi')
      log.push(`${senior.name}さんの飲みについて行った。会計は全部先輩持ち。終電を逃した。`)
      if (senior.respect >= 40) {
        s.neta.polish = clamp(s.neta.polish + 5)
        log.push(`「お前らのあのネタ、オチもう一個先あるで」と${senior.name}さん。`)
      } else if (senior.like >= 50) log.push('楽しかった。ただ、ネタの話は一度も出なかった。')
      if (has(s, 'orei')) {
        senior.like = clamp(senior.like + 3)
        count(s, 'orei')
      } else story(s, 'orei', { senior: senior.id })
      break
    }
    case 'douki':
      s.money -= 3000
      s.dokiBond = clamp(s.dokiBond + 6)
      s.motivation = clamp(s.motivation + 6)
      s.condition = clamp(s.condition - 5)
      log.push('同期と安いチェーン店で飲んだ。売れたら何をするかの話で朝になった。')
      break
    case 'netacho':
      s.neta.polish = clamp(s.neta.polish + 4)
      gain(s, 'idea', 1)
      s.condition = clamp(s.condition - 3)
      log.push('家でネタ帳を書いた。')
      break
    case 'egosa': {
      if (s.fans < 3) {
        log.push('コンビ名でエゴサした。まだ誰も呟いていない。')
        break
      }
      const delta = rng.int(-8, 8)
      s.motivation = clamp(s.motivation + delta)
      log.push(delta >= 0 ? '「◯◯ちゃん」で検索したら褒め言葉が出てきた。' : '「◯◯さん」で検索したら丁寧な悪口が出てきた。眠れない。')
      break
    }
    case 'sleep':
      s.condition = clamp(s.condition + 12)
      break
  }
}

function weeklyUpkeep(s: GameState): void {
  const rent = s.player.origin === 'tokyo' && !s.flags.isourou ? 10000 : 0
  const food = 5000
  const extra = has(s, 'rouhi') ? 3000 : 0
  s.money -= rent + food + extra
  s.condition = clamp(s.condition - 3 + s.stats.stamina / 40)
  // やる気は少しずつ50に戻る
  s.motivation = clamp(s.motivation + (50 - s.motivation) * 0.08)
}

// その週の行事
function scheduleEvents(s: GameState, rng: Rng): void {
  const { month, week } = weekInfo(s.turn)
  const t = s.turn

  if (t === turnOf(4, 4) && !s.partner) {
    const idx = [0, 1, 2, 3].sort(() => rng.next() - 0.5).slice(0, 3)
    story(s, 'aikata_kai', { c0: idx[0], c1: idx[1], c2: idx[2] })
  }
  // ネタ見せ授業は毎月第2週（5月〜1月）
  if (week === 2 && month !== 4 && month !== 2) {
    story(s, 'queue')
    push(s, { type: 'stage', kind: 'netamise' })
  }
  if (week === 4 && [6, 9, 11, 1].includes(month)) push(s, { type: 'stage', kind: 'live' })
  if (month === 7 && week === 3) story(s, 'contest_entry', { kind: 'contest_conte' })
  if (month === 8 && week === 3) story(s, 'contest_entry', { kind: 'contest_manzai' })
  if (month === 9 && week === 2) story(s, 'gasshuku')
  if (month === 10 && week === 1) story(s, 'compliance')
  if (month === 11 && week === 1) story(s, 'hikari_kage')
  if (month === 12 && week === 1 && s.player.background === 'circle' && !s.flags.naitei_done) {
    s.flags.naitei_done = true
    story(s, 'naitei')
  }
  if (month === 12 && week === 3) story(s, 'tozai_select')
  if (month === 1 && week === 2) story(s, 'audition')
  if (month === 2 && week === 2) story(s, 'grad_intro')

  // ランダムイベント（週に1つまで）
  if (s.pending.length === 0 && rng.chance(0.35)) {
    const pool: [string, Record<string, string | number>?][] = []
    if (s.partner) pool.push(['shinneta'], ['loan'])
    pool.push(['line_kidoku'], ['barashi'])
    if (s.player.origin === 'tokyo') pool.push(['coin_shower'])
    const friend = s.seniors.find((x) => x.like >= 40)
    if (friend) pool.push(['hikkoshi', { senior: friend.id }])
    if (s.outsideRep >= 30 && !s.flags.chokueigyou_seen && month >= 10) pool.push(['chokueigyou'], ['chokueigyou'])
    const [key, params] = rng.pick(pool)
    story(s, key, params)
  }
  if (s.partner && s.partner.bond < 12 && !s.flags.kaisan_warned) {
    s.flags.kaisan_warned = true
    story(s, 'kaisan')
  }
  if (s.money < 0) story(s, 'debt')
}

export function runWeek(prev: GameState, day: DayAction, night: NightAction): GameState {
  const s = clone(prev)
  s.weekLog = []
  s.queueChoice = null
  withRng(s, (rng) => {
    applyDay(s, day, rng)
    applyNight(s, night, rng)
    weeklyUpkeep(s)
    scheduleEvents(s, rng)
  })
  s.phase = 'event'
  return s
}

// ---- イベント処理 ----

export function resolveStory(prev: GameState, choice: number, text?: string): GameState {
  const s = clone(prev)
  const ev = s.pending.shift()
  if (!ev || ev.type !== 'story') return prev
  s.weekLog = []
  withRng(s, (rng) => STORIES[ev.key].resolve?.(s, choice, rng, ev.params ?? {}, text))
  return s
}

export function doStage(prev: GameState): GameState {
  const s = clone(prev)
  const ev = s.pending.shift()
  if (!ev || ev.type !== 'stage') return prev
  s.weekLog = []
  withRng(s, (rng) => {
    const r = performStage(s, ev.kind, rng)
    applyStageEffects(s, r, rng)
    s.lastStage = r
    s.stageHistory.push(r)
  })
  return s
}

function applyStageEffects(s: GameState, r: GameState['lastStage'] & {}, rng: Rng): void {
  const spec = STAGES[r.kind]
  count(s, `level${r.level}`)
  if (r.level === 0) count(s, 'suberi')
  if (spec.audience === 'general' && r.level >= 2) count(s, 'generalUke')
  if (r.level >= 2 && s.neta.cards.tsukami) count(s, 'tsukamiUke')

  // やる気
  if (r.level === 0) s.motivation = clamp(s.motivation - (has(s, 'hagane') ? 3 : 8))
  if (r.level >= 2) s.motivation = clamp(s.motivation + 5)
  gain(s, 'guts', 0.5 + r.level * 0.3)

  // 見ていた人の評価（認められ度は、ウケたときだけ上がる）
  if (r.level >= 2) for (const sr of s.seniors) sr.respect = clamp(sr.respect + (r.level === 3 ? 5 : 3))

  switch (r.kind) {
    case 'netamise': {
      let d = r.level * 4 - 2
      if (has(s, 'shiagari')) d = Math.round(d / 2)
      s.teacherEval = clamp(s.teacherEval + d)
      if (r.level === 0) count(s, 'dame')
      if (r.level === 3 && has(s, 'shiagari')) removeSkill(s, 'shiagari', '結果を出したら、講師が細かく見てくれるようになった。「仕上がってる扱い」が解けた。')
      break
    }
    case 'live':
      s.fans += r.level * 3 + (r.level === 3 ? 5 : 0)
      s.staffEval = clamp(s.staffEval + r.level * 2)
      if (r.level >= 2) r.lines.push(`作家票・社員票で上位${r.level === 3 ? '1' : '3'}組に入った。`)
      break
    case 'contest_conte':
    case 'contest_manzai': {
      const passed = r.score >= spec.difficulty + 8
      r.passed = passed
      const name = r.kind === 'contest_conte' ? 'コント頂' : '漫才天下一'
      s.contestResults.push({ name, result: passed ? '1回戦通過（2回戦敗退）' : '1回戦敗退' })
      r.lines.push('夜、公式サイトの結果ページを何度も更新した。')
      r.lines.push(passed ? `${s.comboName}の名前があった。` : `${s.comboName}の名前は、なかった。`)
      if (passed) {
        s.teacherEval = clamp(s.teacherEval + 10)
        s.staffEval = clamp(s.staffEval + 8)
        count(s, 'contestPass')
      }
      break
    }
    case 'tozai':
      s.staffEval = clamp(s.staffEval + r.level * 4)
      s.fans += r.level * 4
      break
    case 'grad_prelim': {
      const groups = Math.round(s.classmates / 2)
      const p = 1 / (1 + Math.exp(-(r.score - 72) / 9))
      const rank = Math.max(1, Math.min(groups, Math.round((1 - p) * groups) + rng.int(0, 2)))
      r.rank = rank
      r.lines.push(`予選の順位は${groups}組中${rank}位。`)
      if (rank <= 8) {
        r.lines.push('決勝進出。2本目をやる。')
        push(s, { type: 'stage', kind: 'grad_final' })
      } else s.gradRank = rank
      break
    }
    case 'grad_final': {
      const p = 1 / (1 + Math.exp(-(r.score - 84) / 7))
      const rank = Math.max(1, Math.min(8, Math.round((1 - p) * 8) + 1))
      r.rank = rank
      s.gradRank = rank
      r.lines.push(rank === 1 ? '優勝。卒業総代に選ばれた。' : `決勝${rank}位。`)
      if (rank === 1) s.fans += 30
      break
    }
  }
}

// イベントが全部終わったときに呼ぶ。入学直後のイベントなら1週目を始め、それ以外は次の週へ進める
export function endEvents(prev: GameState): GameState {
  if (prev.phase === 'result') return prev
  if (prev.flags.intro) {
    const s = clone(prev)
    s.flags.intro = false
    s.phase = 'week'
    return s
  }
  return finishWeek(prev)
}

export function finishWeek(prev: GameState): GameState {
  const s = clone(prev)
  s.weekLog = []
  withRng(s, (rng) => {
    checkSkills(s)
    // 月初のクラス更新（10月から）
    const { month, week } = weekInfo(s.turn)
    if (week === 2 && [10, 11, 12, 1].includes(month)) {
      const before = s.classRank
      s.classRank = s.teacherEval >= 55 ? 'matsu' : s.teacherEval >= 35 ? 'take' : 'ume'
      if (s.classRank === 'ume') count(s, 'ume')
      if (month === 10) story(s, 'class_change')
      else if (before !== s.classRank) s.weekLog.push(`クラスが${{ none: '', ume: '梅組', take: '竹組', matsu: '松組' }[s.classRank]}に変わった。`)
    }
    s.turn += 1
    s.classmates = Math.max(90, expectedClassmates(s.turn) + rng.int(-3, 3))
    if (s.turn >= TOTAL_TURNS) {
      s.turn = TOTAL_TURNS
      story(s, 'sotsugyo')
    }
  })
  s.lastStage = null
  s.phase = s.pending.length ? 'event' : 'week'
  return s
}

function checkSkills(s: GameState): void {
  const c = (k: string) => s.counters[k] ?? 0
  if (c('tsukamiUke') >= 3) addSkill(s, 'tsukami', '芸風スキル「ツカミ名人」を覚えた。')
  if (c('neta') >= 8) addSkill(s, 'ryousan', '芸風スキル「量産型」を覚えた。')
  if (c('level3') >= 2) addSkill(s, 'honban', '芸風スキル「本番に強い」を覚えた。')
  if (c('hassei') >= 4) addSkill(s, 'kamanai', '芸風スキル「噛まない」を覚えた。')
  if (c('hassei') >= 8) addSkill(s, 'koega', '芸風スキル「声がデカい」を覚えた。')
  if (s.player.style === 'conte' && s.stats.expr >= 45) addSkill(s, 'hyoui', '芸風スキル「憑依型」を覚えた。')
  if (s.player.style === 'manzai' && s.stats.word >= 45) addSkill(s, 'hayakuchi', '芸風スキル「早口」を覚えた。')
  if (c('contestPass') >= 1) addSkill(s, 'battle', '芸風スキル「バトル脳」を覚えた。')
  if (c('nomi') >= 6) addSkill(s, 'kawaigarare', '芸風スキル「かわいがられ」を覚えた。')
  if (c('orei') >= 4) addSkill(s, 'orei', '芸風スキル「お礼が早い」を覚えた。')
  if (c('dame') >= 4) addSkill(s, 'hagane', 'ダメ出しに慣れてきた。芸風スキル「鋼のメンタル」を覚えた。')
  if (c('baito') >= 10) addSkill(s, 'kugaku', '芸風スキル「苦学生」を覚えた。')
  if (s.partner && s.partner.bond >= 80) addSkill(s, 'aikata', '芸風スキル「相方思い」を覚えた。')
  if (c('ume') >= 2) addSkill(s, 'zassou', '梅組の空気にも慣れた。芸風スキル「雑草魂」を覚えた。')
  if (c('suberi') >= 3 && s.stats.adlib >= 35) addSkill(s, 'suberikaeshi', '芸風スキル「スベり返し」を覚えた。')
  if (has(s, 'gakusei') && c('generalUke') >= 2 && s.stats.adlib >= 40) {
    removeSkill(s, 'gakusei', '一般のお客さんの笑いどころがつかめてきた。')
    addSkill(s, 'kurouto', '「学生お笑い臭」が化けて、芸風スキル「玄人殺し」になった。')
  }
  if (has(s, 'agari') && s.stats.guts >= 50) removeSkill(s, 'agari', '舞台に慣れて「あがり症」が消えた。')
  if (has(s, 'honban') && has(s, 'tsukami')) addSkill(s, 'bakushou', '極み「爆笑請負人」に到達した。')
  const patron = s.seniors.find((x) => x.like >= 75 && x.respect >= 60)
  if (patron && !has(s, 'kumi')) {
    addSkill(s, 'kumi', `極み「秘蔵っ子」に到達した。${patron.name}さんに引き上げてもらえる。`)
    s.flags[`patron_${patron.id}`] = true
  }
}

export function currentEvent(s: GameState) {
  return s.pending[0] ?? null
}

export function nextCandidates(): string[] {
  return PARTNER_CANDIDATES.map((p) => p.name)
}

export function moneyText(s: GameState): string {
  return yen(s.money)
}

// ---- セーブ ----
const SAVE_KEY = 'lough-academy-save-v1'

export function save(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // 保存できない環境でも遊べるようにする
  }
}

export function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    return s.version === 1 ? s : null
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    // 何もしない
  }
}

// ネタのカードを差し替える。ネタを変えると完成度は少し下がる
export function setNetaCard(prev: GameState, slot: CardSlot, cardId: string): GameState {
  if (prev.neta.cards[slot] === cardId || !prev.cards.includes(cardId)) return prev
  const s = clone(prev)
  s.neta.cards[slot] = cardId
  s.neta.polish = Math.round(s.neta.polish * 0.75)
  return s
}

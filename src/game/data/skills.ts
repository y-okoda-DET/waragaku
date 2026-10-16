// 芸風スキル（最小版の25個）。kind で武器・クセ・極みを見分ける
// gift は発展イベントで人から受け継ぐ特殊能力
export type SkillKind = 'buki' | 'kuse' | 'kiwami' | 'gift'

export interface SkillDef {
  id: string
  name: string
  kind: SkillKind
  desc: string
}

export const SKILLS: SkillDef[] = [
  { id: 'tsukami', name: 'ツカミ名人', kind: 'buki', desc: 'ツカミのカードが強くなる' },
  { id: 'kotoba', name: '言葉選び', kind: 'buki', desc: 'ワード系のカードが強くなる' },
  { id: 'ryousan', name: '量産型', kind: 'buki', desc: 'ネタ作りで完成度が上がりやすい' },
  { id: 'honban', name: '本番に強い', kind: 'buki', desc: '本番でブレが上振れしやすい' },
  { id: 'kamanai', name: '噛まない', kind: 'buki', desc: 'セリフ飛びが起きにくい' },
  { id: 'koega', name: '声がデカい', kind: 'buki', desc: '大きい会場でウケが落ちない' },
  { id: 'hyoui', name: '憑依型', kind: 'buki', desc: 'コントの評価が上がる' },
  { id: 'hayakuchi', name: '早口', kind: 'buki', desc: '漫才の評価が上がる' },
  { id: 'suberikaeshi', name: 'スベり返し', kind: 'buki', desc: 'スベった時に挽回することがある' },
  { id: 'battle', name: 'バトル脳', kind: 'buki', desc: '大会・バトルで強い' },
  { id: 'kawaigarare', name: 'かわいがられ', kind: 'buki', desc: '先輩との仲が深まりやすい' },
  { id: 'orei', name: 'お礼が早い', kind: 'buki', desc: 'ごちそうのお礼を忘れない' },
  { id: 'hagane', name: '鋼のメンタル', kind: 'buki', desc: 'ダメ出しでやる気が下がりにくい' },
  { id: 'kugaku', name: '苦学生', kind: 'buki', desc: 'バイトの稼ぎが増える' },
  { id: 'aikata', name: '相方思い', kind: 'buki', desc: '相方との関係が下がりにくい' },
  { id: 'zassou', name: '雑草魂', kind: 'buki', desc: '梅組にいる間、成長が早い' },
  { id: 'agari', name: 'あがり症', kind: 'kuse', desc: '本番で実力が出にくい' },
  { id: 'gakusei', name: '学生お笑い臭', kind: 'kuse', desc: '一般のお客さんにウケにくい' },
  { id: 'shiagari', name: '仕上がってる扱い', kind: 'kuse', desc: '講師のアドバイスが減る。結果を出すと解ける' },
  { id: 'chikoku', name: '遅刻魔', kind: 'kuse', desc: 'たまに授業に入れない' },
  { id: 'rouhi', name: '浪費家', kind: 'kuse', desc: 'お金が減りやすい' },
  { id: 'kotowarenai', name: '断れない', kind: 'kuse', desc: '誘いを断れない' },
  { id: 'kurouto', name: '玄人殺し', kind: 'buki', desc: '作家・審査員に強く刺さる（学生お笑い臭が化けた）' },
  { id: 'bakushou', name: '爆笑請負人', kind: 'kiwami', desc: '大舞台で爆発しやすい' },
  { id: 'kumi', name: '秘蔵っ子', kind: 'kiwami', desc: '先輩に引き上げてもらえる' },
  // 入学時に、たまに最初から持っている
  { id: 'koukou_sho', name: '高校お笑い賞', kind: 'buki', desc: '高校生の大会で賞をとった。最初から度胸と発想力が高く、先輩にも名前を知られている' },
  // 発展イベントで受け継ぐ特殊能力（data/bonds の人ごとに1つ）
  { id: 'hitorashi', name: '人たらし', kind: 'gift', desc: '同期や先輩と仲良くなりやすい' },
  { id: 'netacho_oni', name: 'ネタ帳の鬼', kind: 'gift', desc: 'ネタ作りでネタの種を思いつきやすい' },
  { id: 'gekidan', name: '劇団仕込み', kind: 'gift', desc: '表現力が伸びやすく、大きい会場に強い' },
  { id: 'awasema', name: 'ネタ合わせ魔', kind: 'gift', desc: 'ネタ合わせで完成度が上がりやすく、疲れにくい' },
  { id: 'yomi', name: '講師の読み', kind: 'gift', desc: 'ネタ見せで講師の評価が上がりやすい' },
  { id: 'mitomesase', name: 'ネタで認めさせる', kind: 'gift', desc: 'ウケたとき、先輩に認められやすい' },
  { id: 'chika', name: '地下の顔', kind: 'gift', desc: '自主ライブでファンと外の縁が増えやすい' },
  { id: 'kyuushuu', name: 'ダメ出し吸収', kind: 'gift', desc: 'ネタ見せでスベるほど発想とワードが伸びる' },
  { id: 'homerare', name: '褒められ上手', kind: 'gift', desc: 'やる気が下がりにくい' },
  { id: 'makezu', name: '負けず嫌い', kind: 'gift', desc: '講師や審査員の前で実力が出る' },
  { id: 'kansatsu', name: '人間観察', kind: 'gift', desc: '発想力が伸びやすい' },
  { id: 'makanai', name: 'まかない', kind: 'gift', desc: '居酒屋バイトで疲れにくく、お金も浮く' },
  { id: 'kaonajimi', name: '劇場の顔なじみ', kind: 'gift', desc: 'ライブでお客さんが温かい。卒業後のオーディションにも効く' },
]

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]))

// ネタ見せの「見せ場」。ネタ全体は見せず、1〜2か所だけをミニゲームにする
import { CARD_BY_ID } from './data/cards'
import { STAGES, type Audience } from './stage'
import type { GameState, StageKind, Style } from './types'

export type ShowcaseGrade = 'great' | 'good' | 'miss'
export type ShowcaseKind = 'word' | 'tsukkomi' | 'conte'

// ボケの芸風の寄り。どちらが正解かは、自分の芸風と客層の組み合わせで決まる
export type Lean = 'shuru' | 'oudou'
export const LEAN_LABEL: Record<Lean, string> = { shuru: 'シュール寄り', oudou: '王道寄り' }

// コントの設定。me は自分の役、you は相方の役
export interface ConteSetting {
  place: string
  me: string
  you: string
}

// ワード選び（ボケ担当）: 相方のフリに3択で返す
// 選択肢はシュール・王道・平凡の3つ。平凡はいつ選んでもスベる
// コントのときは、相方が役のままフリを言い、役のままボケで返す
export interface WordScene {
  kind: 'word'
  furi: string
  options: { text: string; flavor: Lean | 'flat'; react: string }[]
  conte?: ConteSetting
}

// ツッコミのタイミング（ツッコミ担当）: 相方のボケのあと、間を見てツッコむ
// center はちょうどいい間の位置。短いボケは早め、溜めるボケは遅め
export interface TsukkomiScene {
  kind: 'tsukkomi'
  boke: string
  tsukkomi: string
  center: number
  conte?: ConteSetting
}

// コントの見せ場（担当によらず共通）。漫才と違い、1本のコントを3つの山で見せる
// 1. 設定に入る：最初の一言・一動作で、どこで誰なのかを見せる（説明セリフはスベる）
// 2. 役を演じ切る：相方のボケの間、役の濃さをゲージの帯に保つ（薄いと素が出る、濃すぎるとやりすぎ）
// 3. 暗転前のオチ：最後のセリフの余韻を見て、暗転のきっかけを出す
export interface ConteScene {
  kind: 'conte'
  conte: ConteSetting
  open: { text: string; flavor: Lean | 'flat' }[]
  role: string
  uke: string
  ochi: string
}

export type Scene = WordScene | TsukkomiScene | ConteScene

type Opt = [text: string, react: string]
function w(furi: string, shuru: Opt, oudou: Opt, flat: Opt, conte?: ConteSetting): WordScene {
  return {
    kind: 'word',
    furi,
    options: [
      { text: shuru[0], flavor: 'shuru', react: shuru[1] },
      { text: oudou[0], flavor: 'oudou', react: oudou[1] },
      { text: flat[0], flavor: 'flat', react: flat[1] },
    ],
    ...(conte ? { conte } : {}),
  }
}
function t(boke: string, tsukkomi: string, center: number, conte?: ConteSetting): TsukkomiScene {
  return { kind: 'tsukkomi', boke, tsukkomi, center, ...(conte ? { conte } : {}) }
}
const set = (place: string, me: string, you: string): ConteSetting => ({ place, me, you })

// 漫才のフリ。相方が素のまま振ってくる
export const WORD_SCENES: WordScene[] = [
  w('将来の夢は？', ['定年退職', '「ゴールが早すぎるやろ！」'], ['総理大臣になって、祝日を全部月曜にする', '「三連休作りたいだけやん！」'], ['お笑い芸人', '「……今なってるやん」']),
  w('コンビニのバイトで、何が大変やった？', ['客に「ポイントカードありますか」って聞かれる', '「お前が聞く側や！」'], ['おでんの卵を数え間違えて、店長と朝まで数え直した', '「どんだけ卵あんねん！」'], ['レジ打ち', '「普通やな」']),
  w('好きな食べ物は？', ['消費期限', '「食べ物ちゃうわ！」'], ['母が作ったカップラーメン', '「お湯入れただけや！」'], ['カレー', '「……うん」']),
  w('最近ハマってることある？', ['知らない人の結婚式の二次会', '「誰やねんお前！」'], ['エレベーターの「閉」を連打して、自分が挟まる', '「せっかちの末路や！」'], ['サウナ', '「流行ってるな」']),
  w('休みの日は何してるん？', ['休みを探してる', '「もう見つかってるやん」'], ['平日のことを考えて、胃が痛くなってる', '「休めてへんやないか！」'], ['寝てる', '「まあ、せやな」']),
  w('初めて買ったCDは？', ['CD-R', '「何も入ってへん！」'], ['お経', '「渋すぎるやろ」'], ['アニメの主題歌', '「かわいいな」']),
  w('引っ越したんやろ？ 新しい家どう？', ['前の家が、ずっとついてくる', '「ホラーやないか！」'], ['駅から徒歩5分。オリンピック選手の', '「お前の足で測れ！」'], ['日当たりがいい', '「ええやん、普通に」']),
  w('一番怖いものは？', ['自動ドアに無視されること', '「存在感の問題や！」'], ['まんじゅう。あと熱いお茶も怖い', '「落語のパクリや！」'], ['おばけ', '「まあ、怖いな」']),
  w('なんか特技ある？', ['まばたきを我慢できる。最長4秒', '「誰でもできるわ！」'], ['3秒で寝られる。面接中でも', '「落ちる理由それや！」'], ['料理', '「ふーん」']),
  w('彼女できたら、どこ行きたい？', ['彼女の実家。彼女抜きで', '「誰と行くねん！」'], ['水族館。で、魚の値段を全部当てる', '「市場の目で見るな！」'], ['遊園地', '「定番やな」']),
  w('最近、何か買った？', ['空気清浄機の、空気だけ', '「どうやって買うねん！」'], ['ダイエット器具。今は洗濯物干しとして大活躍', '「一番あるあるや！」'], ['スニーカー', '「おしゃれやん」']),
  w('朝ごはん何食べた？', ['朝', '「時間帯を食うな！」'], ['昨日の晩ごはんの残りの、そのまた残り', '「何日目やねん！」'], ['パン', '「……で？」']),
  w('自分の性格を一言で言うと？', ['取扱説明書が分厚い', '「家電か！」'], ['人見知り。ただし初対面の人にだけ', '「それが人見知りや！」'], ['マイペース', '「よう聞くやつやな」']),
  w('宝くじで3億当たったらどうする？', ['銀行に預けて、毎日会いに行く', '「ペットか！」'], ['3億円分、宝くじを買う', '「懲りてへん！」'], ['貯金する', '「堅実やな」']),
  w('修学旅行の思い出は？', ['バスガイドさんと、今も文通してる', '「どんな仲やねん！」'], ['木刀買って、帰りの新幹線で没収された', '「お前が持ったら危ないねん！」'], ['京都に行った', '「ふつうや」']),
  w('自分を動物にたとえたら？', ['ナマケモノの、休日', '「もう何もしてへん！」'], ['ゴリラ。でもバナナより焼肉が好き', '「ほな人間や！」'], ['猫', '「かわいらしいな」']),
  w('得意な科目は？', ['道徳。点数は0点', '「道徳に点数ないねん！」'], ['給食', '「科目ちゃうわ！」'], ['体育', '「元気やな」']),
  w('最近、泣いたことある？', ['ATMに「またのご利用を」って言われて', '「優しさに飢えすぎや！」'], ['玉ねぎ切ってて泣いて、そのまま3時間泣いた', '「途中から別の涙や！」'], ['映画で', '「ええ話やな」']),
  w('ご両親はどんな人？', ['父と、母と、あと誰か', '「誰やねん、その人！」'], ['オカンは、電話に出る時だけ声が高い', '「全国のオカンそうや！」'], ['優しいです', '「ええ家族やな」']),
  w('ストレス解消法は？', ['知らない人の引っ越しを手伝う', '「業者か！」'], ['カラオケで、店員さんが入ってきた瞬間だけ全力で歌う', '「見られたいんかい！」'], ['運動', '「健康的やな」']),
  w('自分へのご褒美は？', ['自分あての手紙。差出人も自分', '「全部自分や！」'], ['コンビニの高いほうのプリン。3日に1回', '「ご褒美多すぎるやろ！」'], ['焼肉', '「ええな」']),
  w('地元って、何が有名なん？', ['何もないことで有名。逆に観光客が来る', '「何しに来てんねん！」'], ['たぬき。人口より多い', '「たぬきの町やないか！」'], ['お米', '「おいしいよな」']),
  w('今いちばん欲しいものは？', ['家の近くの、知らない駅', '「どこに作る気や！」'], ['月曜日をなくすボタン', '「火曜が月曜になるだけや！」'], ['お金', '「みんなそうや」']),
  w('芸人になろうと思ったきっかけは？', ['養成所のパンフレットの紙質が良かった', '「理由が薄すぎる！」'], ['学校で一番おもろいって言われた。言うてたのはオカンだけ', '「学校関係ないやん！」'], ['テレビを見て', '「みんなそうやな」']),
]

// 漫才のボケ。相方が素のまま言う
export const TSUKKOMI_SCENES: TsukkomiScene[] = [
  t('僕、高所恐怖症なんで、2階建てバスの1階にしか乗れないんですよ', '1階はただのバスや！', 0.5),
  t('早起きするために、毎晩夜ふかししてるんですよ', '順番おかしいやろ！', 0.38),
  t('本番で緊張しないように、さっき楽屋で緊張しておきました', '先払いすな！', 0.62),
  t('お会計は……思い出で、お願いします', '払えるか！', 0.72),
  t('趣味は貯金です。残高は今、7円です', '向いてへんで！', 0.66),
  t('うちの実家、太いんですよ。柱が', '建物の話すな！', 0.44),
  t('健康のために、毎朝ジョギングしてるんですよ。タクシーで', '走ってるのは車や！', 0.6),
  t('僕、方向音痴なんで、ナビにも道を聞かれます', 'ナビが迷うな！', 0.5),
  t('昨日ダイエット始めました。今日やめました', '一日坊主か！', 0.35),
  t('初デートの待ち合わせ、相手のお母さんが来ました', '代理出席すな！', 0.6),
  t('僕、猫舌なんで、冷たいものも冷ましてから食べます', 'もう常温や！', 0.55),
  t('うちの犬、賢いんですよ。お手、おかわり、確定申告', '税理士か！', 0.42),
  t('寝坊の言い訳を考えてたら、また寝坊しました', '言い訳で遅刻すな！', 0.58),
  t('昔はモテたんですよ。幼稚園で。先生に', 'それは仕事や！', 0.48),
  t('マラソン大会、1位でした。後ろから数えて', 'ビリや！', 0.4),
  t('家賃を浮かすために、大家さんの家に住んでます', 'ただの居候や！', 0.52),
  t('料理得意なんですよ。特に、お湯を沸かすのが', 'それ料理ちゃう！', 0.46),
  t('人の名前を覚えるのは得意です。顔は全部忘れますけど', '会っても分からんやん！', 0.5),
  t('休みの日は図書館で、本を……見てます。背表紙を', '読め！', 0.68),
  t('うちのおじいちゃん、100歳なんですよ。……あ、62でした', '38年盛るな！', 0.62),
  t('雨の日は傘をささないんです。濡れるのが怖いんで', '理屈が逆や！', 0.36),
  t('節約のために、スマホの充電は全部コンビニでしてます', 'ただの迷惑や！', 0.5),
  t('目覚まし5個かけてるんで、毎朝5回起きて、5回寝ます', '1個で起きろ！', 0.56),
  t('将来は、宇宙飛行士か……実家の酒屋です', '振れ幅えぐいな！', 0.7),
]

// コントの芯になるボケ。相方が役のままボケて、自分は役のまま受ける
const CONTE_BASE: TsukkomiScene[] = [
  t('お箸は何膳おつけしますか？……300膳でよろしいですか？', '何人で食うねん！', 0.6, set('コンビニ', '客', '店員')),
  t('長所は、時間を守ることです。……あ、今日は遅刻しました', '今証明できてへん！', 0.62, set('面接', '面接官', '志望者')),
  t('レントゲンの結果ですが……いい写真が撮れました', '写りの話すな！', 0.55, set('病院', '患者', '医者')),
  t('かゆいところはございませんか？……僕は背中がかゆいです', 'お前の話か！', 0.5, set('美容院', '客', '美容師')),
  t('近道しときますね。……知らない道ですけど', 'ほな遠回りや！', 0.6, set('タクシー', '客', '運転手')),
  t('署まで来てもらえますか。……道がわからないんで', '案内させるな！', 0.58, set('職務質問', '通行人', '警察官')),
  t('へい、大トロお待ち！ 握ったのは機械です', '大将の意味ないやろ！', 0.45, set('寿司屋', '客', '大将')),
  t('先生、トイレ行っていいですか？……家の', '帰りたいだけや！', 0.66, set('教室', '先生', '生徒')),
  t('では誓いのキスを。……いや、まずは握手から', '段階踏むな！', 0.52, set('結婚式', '新婦', '神父')),
  t('来年、運命の人に出会います。……たぶん、私です', '営業すな！', 0.64, set('占いの館', '客', '占い師')),
  t('お荷物、全部運び終わりました。前の家に', '戻してどうすんねん！', 0.48, set('引っ越し', '依頼主', '業者')),
  t('お口開けてください。もっと。もっと。……そこまでは結構です', 'お前が言わせたんや！', 0.7, set('歯医者', '患者', '歯医者')),
  t('刑事さん、カツ丼まだですか？ 大盛りで', '自分で頼むな！', 0.4, set('取調室', '刑事', '容疑者')),
  t('こちら当館自慢の露天風呂です。……屋根は去年飛びました', '台風の被害や！', 0.62, set('旅館', '客', '仲居')),
  t('会議資料できました。白紙ですけど、内容は頭に入ってます', '紙に書け！', 0.56, set('会社', '部長', '新入社員')),
  t('ご注文のウーロン茶です。……あと、僕から一曲', '歌うな！', 0.6, set('カラオケ', '客', '店員')),
  t('こちらキリンです。首が長いのは、ウソをつくたびに伸びたからです', 'それピノキオや！', 0.66, set('動物園', '客', '飼育員')),
  t('うらめしや〜。……あ、出口はあっちです', '親切か！', 0.42, set('お化け屋敷', '客', 'お化け')),
  t('じゃあ席替えしまーす。……僕と、店長が', '店長巻き込むな！', 0.58, set('合コン', '参加者', '幹事')),
  t('お荷物です。ハンコか、サインか……モノマネをお願いします', '何の受け取り方や！', 0.7, set('宅配便', '住人', '配達員')),
  t('玉ねぎを切ります。涙が出たら……それが隠し味です', '入れるな！', 0.55, set('料理教室', '生徒', '先生')),
  t('サイズいかがでした？……あ、そっちは私の服です', '試着室に私物置くな！', 0.6, set('試着室', '客', '店員')),
  t('当選したあかつきには、皆さんのことを……たまに思い出します', '毎日思え！', 0.68, set('選挙演説', '聴衆', '候補者')),
  t('観覧車は一周15分です。途中で降りたい方は……勇気を出してください', '飛び降りさすな！', 0.64, set('遊園地', '客', '係員')),
]

// 入りの3択（王道・シュール・説明）とオチ。CONTE_BASE と同じ並び
const CONTE_EXTRA: Record<string, [oudou: string, shuru: string, flat: string, ochi: string]> = {
  コンビニ: ['すいません、これ温めてもらえます？（弁当を差し出す）', '（無言で、弁当をレジに正座させる）', 'えー、ここはコンビニで、僕は客です', '温め終わりました。……お箸300膳のほうを'],
  面接: ['では、お名前からどうぞ（書類をめくる）', '（志望者の椅子に、先に座っておく）', 'ここは面接会場で、僕は面接官です', '以上です。あ、合否はこちらから連絡しますね'],
  病院: ['先生、最近ずっとお腹が痛くて……（お腹を押さえて座る）', '（松葉杖を4本ついて、診察室に入ってくる）', 'ここは病院で、僕は患者の役です', 'では、こちら焼き増ししておきますね'],
  美容院: ['今日は、毛先を揃える感じで（鏡越しに）', '（ケープを、マントのように翻して座る）', '美容院に来た客です。髪を切りに来ました', 'はい、仕上がりました。……後ろ、見ます？ 僕の'],
  タクシー: ['（手を挙げて）すいません、駅まで！', '（タクシーの屋根に向かって、行き先を言う）', '今からタクシーに乗るところです', '着きました。……出発したところに'],
  職務質問: ['（イヤホンをして、普通に歩いてくる）', '（警察官の前を、3回往復する）', 'ここは夜道で、僕はただの通行人です', 'ご協力ありがとうございました。……で、ここどこですか？'],
  寿司屋: ['（のれんをくぐって）大将、おまかせで！', '（のれんを、一枚ずつめくって数えながら入る）', 'ここはお寿司屋さんという設定です', 'お会計です。……機械のほうにお願いします'],
  教室: ['はい、出席とるぞー（出席簿を開く）', '（黒板に、自分の名前を毛筆で書く）', '僕は先生役で、ここは教室です', '先生、ただいま戻りました。……家から'],
  結婚式: ['（ベールを直して、一歩ずつ歩いてくる）', '（バージンロードを、ムーンウォークで歩いてくる）', '結婚式で、私は新婦の役です', 'では、お二人は……まず、文通から始めてください'],
  占いの館: ['（そっとカーテンを開けて）あの……占ってもらえますか', '（水晶玉を、自分で持ってくる）', '占いの館に来たお客さんです', '以上で鑑定は終わりです。……連絡先は、こちらに'],
  引っ越し: ['（段ボールの山を見て）今日はよろしくお願いします！', '（段ボールに入ったまま、業者を出迎える）', '今日は引っ越しの日という設定です', 'またのご利用を。……来週、こっちに運び直しに来ます'],
  歯医者: ['（震えながら診察台に座る）よ、よろしくお願いします', '（自分で診察台を倒して、もう寝ている）', 'ここは歯医者で、僕は患者です', 'はい、終わりです。今日は、口を開ける練習でした'],
  取調室: ['（机を叩いて）そろそろ、話してもらおうか', '（デスクライトを、自分の顔に当てる）', 'ここは警察の取調室で、僕は刑事です', '刑事さん。……僕がやりました。カツ丼の注文'],
  旅館: ['（荷物を置いて）いやあ、いい部屋ですねえ', '（浴衣を、上下逆さまに着て入ってくる）', '旅館に泊まりに来た客という設定です', 'お布団は、去年飛ばなかったほうをご用意しました'],
  会社: ['（腕時計を見て）おい、会議始まるぞ', '（デスクの上に、正座して待っている）', 'ここは会社で、僕は部長の役です', 'では、プレゼンを始めます。……頭の中で'],
  カラオケ: ['（マイクを持って）よし、1曲目いくかー', '（マイクに向かって、注文を叫ぶ）', 'カラオケボックスにいる客です', '採点は98点でした。……僕の'],
  動物園: ['（檻をのぞいて）うわー、でっかいなあ', '（檻の中から、外をのぞいている）', '動物園に来た客という設定です', 'ちなみに私の鼻が長いのも……同じ理由です'],
  お化け屋敷: ['（腕を組んで）ぜんぜん怖くないわー', '（入口で、お化けに入場料を払う）', 'お化け屋敷に入る客の役です', 'またのお越しを。……次は、もっと怖がってくださいね'],
  合コン: ['（グラスを持って）えー、かんぱーい！', '（ひとりだけ、スーツに名札で座っている）', '今日は合コンで、僕は参加者です', 'それでは、今日のカップルを発表します。……僕と、店長です'],
  宅配便: ['（インターホンが鳴る）はーい、今出まーす', '（ドアの覗き穴から、こっちを覗き返す）', '家にいる住人の役です。荷物を待っています', 'ありがとうございました。……今のモノマネ、誰ですか？'],
  料理教室: ['（エプロンを締めて）先生、今日もよろしくお願いします！', '（包丁を、両手で拝むように持って入ってくる）', '料理教室に来た生徒の役です', 'では、試食です。……しょっぱいのは、先生の涙です'],
  試着室: ['（カーテンを開けて）どうですか、これ', '（カーテンを開けたら、もう一枚カーテンがある）', '洋服屋の試着室にいる客です', 'お会計は、こちらです。……私の服のほうも'],
  選挙演説: ['（ビラを受け取って）おっ、演説始まるで', '（ひとりだけ、候補者の真横で拍手している）', '駅前で演説を聞いている人の役です', '清き一票を。……できれば、二票'],
  遊園地: ['（チケットを渡して）観覧車、2人で！', '（観覧車の列に、ひとりで3回並び直す）', '遊園地の観覧車に乗る客という設定です', 'お疲れさまでした。……2周目は、自費です'],
}

export const CONTE_SCENES: ConteScene[] = CONTE_BASE.map((sc) => {
  const [oudou, shuru, flat, ochi] = CONTE_EXTRA[sc.conte!.place]
  return {
    kind: 'conte',
    conte: sc.conte!,
    open: [
      { text: oudou, flavor: 'oudou' },
      { text: shuru, flavor: 'shuru' },
      { text: flat, flavor: 'flat' },
    ],
    role: sc.boke,
    uke: sc.tsukkomi,
    ochi,
  }
})

// 担当で見せ場の種類が決まる。タイプの仕組みが入るまでの仮
export function showcaseKind(state: GameState): ShowcaseKind {
  if (state.player.style === 'conte') return 'conte'
  return state.player.role === 'boke' ? 'word' : 'tsukkomi'
}

// 見せ場の山。担当と芸風（漫才・コント）で分ける
export function scenePool(kind: ShowcaseKind, style: Style): Scene[] {
  if (style === 'conte' || kind === 'conte') return CONTE_SCENES
  return kind === 'word' ? WORD_SCENES : TSUKKOMI_SCENES
}

export function showcaseCount(kind: StageKind): number {
  return STAGES[kind].big ? 2 : 1
}

// これまでの舞台で遊んだ見せ場の数
function playedCount(state: GameState): number {
  return state.stageHistory.reduce((n, r) => n + (r.showcase?.length || showcaseCount(r.kind)), 0)
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0
  return h
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a
}

// 山を一周するまで同じ見せ場は出ない。並び順（出だしと歩幅）は主人公ごとに変える
export function pickScenes(state: GameState, kind: StageKind): Scene[] {
  const pool = scenePool(showcaseKind(state), state.player.style)
  const len = pool.length
  const seed = hash(`${state.player.name}/${state.player.background}`)
  const offset = seed % len
  let stride = 1 + ((seed >>> 8) % Math.max(1, len - 1))
  while (gcd(stride, len) !== 1) stride++
  const played = playedCount(state)
  return Array.from({ length: showcaseCount(kind) }, (_, i) => pool[(offset + (played + i) * stride) % len])
}

// 選択肢の並びは毎回変える。位置で覚えられないように
export function shuffledOptions<T>(scene: { options: T[] }, seed: number): T[] {
  const order = [0, 1, 2]
  let x = (seed * 2654435761) >>> 0
  for (let i = order.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) >>> 0
    const j = x % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.map((i) => scene.options[i])
}

// 芸風の寄り。ネタ帳のマニアックな札、玄人向けのスキル、発想と表現の差で決まる
export function playerLean(state: GameState): Lean {
  let p = 0
  for (const id of Object.values(state.neta.cards)) if (id && CARD_BY_ID[id]?.tags?.includes('niche')) p++
  if (state.skills.includes('gakusei') || state.skills.includes('kurouto')) p++
  if (state.stats.idea - state.stats.expr >= 10) p++
  return p >= 1 ? 'shuru' : 'oudou'
}

// 客層ごとの好み。講師と一般客は王道、審査員と身内客はシュールを買う
export const AUDIENCE_TASTE: Record<Audience, { lean: Lean; label: string }> = {
  teacher: { lean: 'oudou', label: '講師は、型ができているかを見ている' },
  uchiwa: { lean: 'shuru', label: '客席はほぼ芸人仲間。ひねったボケが好き' },
  judge: { lean: 'shuru', label: '審査員は、見たことのないボケを探している' },
  general: { lean: 'oudou', label: '一般のお客さん。わかりやすい笑いが好き' },
}

// 芸風と客層の両方に合えばドッ、片方ならクスッ、平凡なら必ずシーン
export function gradeWord(state: GameState, kind: StageKind, flavor: Lean | 'flat'): ShowcaseGrade {
  if (flavor === 'flat') return 'miss'
  const mine = flavor === playerLean(state)
  const crowd = flavor === AUDIENCE_TASTE[STAGES[kind].audience].lean
  if (mine && crowd) return 'great'
  return mine || crowd ? 'good' : 'miss'
}

// ツッコミの「間」のゲージ（0〜1）。狭いドッ帯の両側に、広めのクスッ帯がある
// 表現力とワード力で帯が広がる。大きい舞台ほど帯は狭く、針は速く、度胸が低いと針がブレる
export interface TsukkomiZones {
  great: { from: number; to: number }
  good: { from: number; to: number }
}

export function stagePressure(kind: StageKind): number {
  if (kind === 'grad_final') return 2
  if (STAGES[kind].big) return 1.5
  if (STAGES[kind].audience === 'judge') return 1
  return 0
}

export function tsukkomiZones(state: GameState, scene: TsukkomiScene, kind: StageKind): TsukkomiZones {
  const skill = (state.stats.expr + state.stats.word) / 2
  const shrink = 1 - stagePressure(kind) * 0.15
  const great = Math.min(0.11, 0.035 + skill * 0.0011) * shrink
  const good = Math.min(0.3, 0.14 + skill * 0.0022) * shrink
  const c = scene.center
  return {
    great: { from: c - great / 2, to: c + great / 2 },
    good: { from: c - good / 2, to: c + good / 2 },
  }
}

// 針が端まで行く時間（ミリ秒）
export function maDuration(kind: StageKind): number {
  return 1500 - stagePressure(kind) * 200
}

// 針のブレ幅。大きい舞台で度胸が低いほど大きい
export function needleShake(state: GameState, kind: StageKind): number {
  return stagePressure(kind) * Math.max(0, 80 - state.stats.guts) * 0.00036
}

// 発想力が高いと、一番いいボケが「ピンとくる」
export function wordHint(state: GameState): boolean {
  return state.stats.idea >= 45
}

export function gradeTsukkomi(state: GameState, scene: TsukkomiScene, kind: StageKind, at: number | null): { grade: ShowcaseGrade; label: string } {
  if (at === null) return { grade: 'miss', label: 'ツッコミ忘れ' }
  const z = tsukkomiZones(state, scene, kind)
  if (at >= z.great.from && at <= z.great.to) return { grade: 'great', label: 'ドンピシャ' }
  if (at < z.great.from) return at >= z.good.from ? { grade: 'good', label: '少し食い気味' } : { grade: 'miss', label: '食い気味' }
  return at <= z.good.to ? { grade: 'good', label: '少し間延び' } : { grade: 'miss', label: '間延び' }
}

// コントの「役を演じ切る」。ゲージの帯（役の濃さ）の中に針を保つ。押している間は濃く、離すと薄くなる
// 帯は表現力で広がり、大舞台ほど狭く、度胸が低いほど針が勝手に揺れる
export function roleBand(state: GameState, kind: StageKind): { from: number; to: number } {
  const half = Math.min(0.17, 0.1 + state.stats.expr * 0.0012) * (1 - stagePressure(kind) * 0.12)
  return { from: 0.55 - half, to: 0.55 + half }
}

export function roleDrift(state: GameState, kind: StageKind): number {
  return 0.04 + stagePressure(kind) * 0.05 + Math.max(0, 80 - state.stats.guts) * 0.0012
}

// 帯の中にいた割合と、外れたときにどちらへ外れていたか
export function gradeRole(inside: number, low: number, high: number): { grade: ShowcaseGrade; label: string } {
  if (inside >= 0.7) return { grade: 'great', label: '最後まで役のまま' }
  const why = low >= high ? '素が出た' : 'やりすぎた'
  return inside >= 0.4 ? { grade: 'good', label: `少し${why}` } : { grade: 'miss', label: why }
}

// コントの「暗転前のオチ」。最後のセリフの余韻を見て、暗転のきっかけを出す
export function gradeBlackout(state: GameState, kind: StageKind, at: number | null): { grade: ShowcaseGrade; label: string } {
  const r = gradeTsukkomi(state, { kind: 'tsukkomi', boke: '', tsukkomi: '', center: 0.5 }, kind, at)
  const label: Record<string, string> = {
    ツッコミ忘れ: '暗転しそびれた',
    ドンピシャ: 'ドンピシャの暗転',
    少し食い気味: '暗転が少し早い',
    食い気味: '余韻を切った',
    少し間延び: '暗転が少し遅い',
    間延び: '暗転が遅れた',
  }
  return { grade: r.grade, label: label[r.label] ?? r.label }
}

const BEAT_POINT: Record<ShowcaseGrade, number> = { great: 2, good: 1, miss: 0 }
// 3つの山の出来をまとめて、見せ場1つ分の出来にする
export function gradeConte(beats: ShowcaseGrade[]): ShowcaseGrade {
  const p = beats.reduce((n, g) => n + BEAT_POINT[g], 0)
  return p >= 5 ? 'great' : p >= 3 ? 'good' : 'miss'
}

// 見せ場で実際に何をしたか。結果文で引用するため、舞台ごとに一時的に覚えておく
// said はボケで返した言葉（時間切れなら無し）、label はツッコミの間の判定
export interface ShowcasePick {
  grade: ShowcaseGrade
  said?: string
  label?: string
  // コントの3つの山（入り・役・オチ）の出来
  beats?: ShowcaseGrade[]
}

let memo: { key: string; picks: ShowcasePick[] } | null = null
const memoKey = (state: GameState, kind: StageKind) => `${state.player.name}/${state.turn}/${state.stageHistory.length}/${kind}`

export function rememberPicks(state: GameState, kind: StageKind, picks: ShowcasePick[]): void {
  memo = { key: memoKey(state, kind), picks }
}

function recallPicks(state: GameState, kind: StageKind, grades: ShowcaseGrade[]): (ShowcasePick | null)[] {
  const ok = memo && memo.key === memoKey(state, kind) && memo.picks.length === grades.length && memo.picks.every((p, i) => p.grade === grades[i])
  const picks = ok ? memo!.picks : null
  memo = null
  return grades.map((_, i) => picks?.[i] ?? null)
}

// 見せ場の出来を、結果文の1行にする。何を言って、客席がどうなったか
function sceneLine(state: GameState, kind: StageKind, scene: Scene, grade: ShowcaseGrade, pick: ShowcasePick | null): string {
  const head = scene.conte ? `見せ場（${scene.conte.place}のコント）：` : '見せ場：'
  if (scene.kind === 'conte') return conteLine(scene, grade, pick, head)
  if (scene.kind === 'word') {
    // 覚えていなければ、評価から言った言葉を推し量る
    const said = pick ? pick.said : scene.options.filter((o) => gradeWord(state, kind, o.flavor) === grade).length === 1 ? scene.options.find((o) => gradeWord(state, kind, o.flavor) === grade)!.text : undefined
    if (grade === 'great') return `${head}「${scene.furi}」に「${said ?? '会心の一言'}」。あの一言で客席が揺れた。`
    if (grade === 'good') return said ? `${head}「${said}」でクスッとは来た。あと一押しが足りなかった。` : `${head}返しはクスッと来た。あと一押しが足りなかった。`
    if (pick && !pick.said) return `${head}「${scene.furi}」に返しが出てこない。間が空いて、客席が冷えた。`
    return said ? `${head}「${said}」と返したら、客席が「……うん」となった。そこから空気が戻らなかった。` : `${head}「${scene.furi}」への返しが外れた。そこから空気が戻らなかった。`
  }
  const tk = `「${scene.tsukkomi}」`
  const label = pick?.label ?? ''
  const partner = state.partner?.name ?? '相方'
  if (grade === 'great') return `${head}${tk}がドンピシャで入った。あの一言で客席が揺れた。`
  if (grade === 'good') {
    if (label.includes('食い気味')) return `${head}${tk}が少し食い気味。笑いは来たが、半分くらいだった。`
    if (label.includes('間延び')) return `${head}${tk}が少し遅れた。クスッとは来たが、もったいない。`
    return `${head}${tk}は入ったが、ドンピシャではなかった。`
  }
  if (label === 'ツッコミ忘れ') return `${head}ツッコミそびれて、${partner}のボケが宙に浮いたまま終わった。`
  if (label === '食い気味') return `${head}食い気味にツッコんで、ボケが客に届く前に潰してしまった。`
  if (label === '間延び') return `${head}${tk}が遅れて、笑いが死んだ。`
  return `${head}${tk}の間が合わず、笑いが起きなかった。`
}

const BEAT_MISS = ['入りで設定が伝わらず、前半はお客さんが置いてけぼりだった。', '途中で役が揺れて、コントの世界が少し崩れた。', 'オチのあとの暗転がずれて、笑いが流れた。']
function conteLine(scene: ConteScene, grade: ShowcaseGrade, pick: ShowcasePick | null, head: string): string {
  if (grade === 'great') return `${head}入りで${scene.conte.place}の空気を作り、「${scene.uke}」まで役を崩さず、オチで暗転がバチッと決まった。`
  const beats = pick?.beats
  const worst = beats ? beats.indexOf(beats.includes('miss') ? 'miss' : 'good') : -1
  const why = worst >= 0 ? BEAT_MISS[worst] : ''
  if (grade === 'good') return `${head}クスッとは来た。${why || 'ただ、コントの世界に客を連れていき切れなかった。'}`
  return `${head}${why || 'コントの世界に、客がついてこなかった。'}そこから空気が戻らなかった。`
}

// 舞台の結果文に入れる、見せ場の行。どの見せ場を遊んだかは pickScenes と同じ決め方で戻す
export function showcaseLines(state: GameState, kind: StageKind, grades: ShowcaseGrade[]): string[] {
  if (!grades.length) return []
  const scenes = pickScenes(state, kind)
  const picks = recallPicks(state, kind, grades)
  return grades.map((g, i) => (scenes[i] ? sceneLine(state, kind, scenes[i], g, picks[i]) : ''))
    .filter(Boolean)
}

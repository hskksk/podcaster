import type { CharacterId } from "../characters";

export type CheerOutcome = "correct" | "wrong" | "skipped";
export type FinishTier = "perfect" | "good" | "keepGoing";

export type Cheer = { character: CharacterId; text: string };

/**
 * 答え合わせのあとに出る、ぬいぐるみの応援。問題や選択肢の中身には触れない。
 * 一人称は自分の名前、口調はため口（story-rules の規約に合わせる）。
 */
const CHEERS: Record<CheerOutcome, readonly Cheer[]> = {
  correct: [
    { character: "kuma", text: "やったね！ くまぴー、うれしくて、おやつを食べたくなっちゃった" },
    { character: "tora", text: "やったー！ かっこいい！ とらぴーも、走りたくなっちゃった" },
    { character: "neko", text: "すごいね。ねこぴー、にこにこしちゃう" },
    { character: "kitsu", text: "ふふ、せいかいだ！ きつぴー、ちょっとびっくりしたよ" },
    { character: "miju", text: "やったー！ みじゅぴー、ばんざいしちゃう！" },
    { character: "ichi", text: "すごーい。いちぴーも、いちごみたいに、ほっぺが赤くなっちゃった" },
    { character: "nasu", text: "本文をよく見てえらんだんだね。さすがだよ" },
    { character: "tako", text: "やったあ！ たこぴー、くるくるまわっちゃう！" },
    { character: "ramen", text: "いいね。じっくり比べてえらんだ味がするよ" },
  ],
  wrong: [
    { character: "kuma", text: "おしい！ くまぴーも、よくまちがえるよ。もう一回やってみよう" },
    { character: "tora", text: "だいじょうぶ！ とらぴーは、何回でも走りなおすよ。もう一回いこう" },
    { character: "neko", text: "ゆっくりでいいよ。ねこぴーと、もう一回見てみよう" },
    { character: "kitsu", text: "ざんねん！ でも、きつぴーも、いたずらで失敗するよ。次があるさ" },
    { character: "miju", text: "うわー、ざんねん！ でもへいき！ みじゅぴーがついてるよ" },
    { character: "ichi", text: "だいじょうぶだよ。いちぴーも、いっしょにもう一回がんばる" },
    { character: "nasu", text: "まちがえたところは、つぎのヒントになるよ。もう一回見てみよう" },
    { character: "tako", text: "ざんねん！ でも、たこぴー、あきらめないよ。いっしょにやろう！" },
    { character: "ramen", text: "スープは、もう一回あたためればいいんだよ。もう一回やってみよう" },
  ],
  skipped: [
    { character: "kuma", text: "答えを見たんだね。どうして○なのか、いっしょに読んでみよう" },
    { character: "neko", text: "さきに見てもいいんだよ。ねこぴーと、ゆっくりたしかめよう" },
    { character: "nasu", text: "理由を読むのも、いい勉強になるよ" },
    { character: "ichi", text: "いちぴーも、わからないときは見るよ。そのあと、もう一回とくんだ" },
    { character: "ramen", text: "味見してから、つくりかたを考えるのもありだよ" },
  ],
};

const FINISH: Record<FinishTier, Cheer> = {
  perfect: { character: "tora", text: "ぜんぶせいかい！ とらぴー、かけっこで一ばんになった気分！" },
  good: { character: "kuma", text: "よくがんばったね。まちがえたところは、「もう一度とく」でたしかめよう" },
  keepGoing: { character: "neko", text: "おつかれさま。ゆっくりでいいよ。ねこぴーと、もう一回やろう" },
};

/** 問題の番号ごとに、となりの問題と別の子が応援するように選ぶ。 */
export function cheerFor(outcome: CheerOutcome, questionIndex: number): Cheer {
  const pool = CHEERS[outcome];
  return pool[questionIndex % pool.length]!;
}

export function finishCheer(correct: number, total: number): Cheer {
  if (total > 0 && correct === total) return FINISH.perfect;
  if (correct * 2 >= total) return FINISH.good;
  return FINISH.keepGoing;
}

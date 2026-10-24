export const CHARACTERS = [
  {
    id: "kuma",
    name: "くまぴー",
    emoji: "🐠",
    tone: "kuma",
    species: "クマノミ",
    tagline: "おやつ大好き。くまではないよ",
    intro:
      "くまぴーはクマノミのぬいぐるみの男の子。名前は「くま」じゃなくて「クマノミ」から来ている。おやつやお昼ねの話がよく出てくるけど、歴史の場面では素朴な質問で、みんなと一緒に考えを進める。",
    traits: ["おやつがだいすき", "ねむたくなることがある", "一人称はいつも「くまぴー」"],
  },
  {
    id: "tora",
    name: "とらぴー",
    emoji: "🐯",
    tone: "tora",
    species: "トラ",
    tagline: "元気いっぱい、勝負好き",
    intro:
      "とらぴーはトラのぬいぐるみの男の子。遊びや勝負にテンションが上がる。くまぴーとよく一緒に動いて、難しい話を身近な言葉に置き換えるボケも出す。",
    traits: ["元気で動きたがり", "勝負ごとが好き", "一人称はいつも「とらぴー」"],
  },
  {
    id: "neko",
    name: "ねこぴー",
    emoji: "🐱",
    tone: "neko",
    species: "ネコ",
    tagline: "そばで支える、やさしい説明役",
    intro:
      "ねこぴーはネコのぬいぐるみの男の子。くまぴーたちの話にそっと乗って、難しいことを短い言葉で補うことが多い。歴史人物の場面でも、口調はねこぴーのまま。",
    traits: ["やさしく手伝う", "物語や手紙の話が好き", "一人称はいつも「ねこぴー」"],
  },
  {
    id: "kitsu",
    name: "きつぴー",
    emoji: "🦊",
    tone: "kitsu",
    species: "キツネ",
    tagline: "つながりを見つける観察役",
    intro:
      "きつぴーはキツネのぬいぐるみの男の子。年号や人物のつながりを、会話の流れに合わせて足すことが多い。政治と文化が同じ社会の中にある、という見方を手伝う。",
    traits: ["出来事のつながりに気づく", "年号を覚えるのが得意", "一人称はいつも「きつぴー」"],
  },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]["id"];
export type CharacterTone = (typeof CHARACTERS)[number]["tone"];
export type JukenCharacter = (typeof CHARACTERS)[number];

export const CHARACTER_IDS: CharacterId[] = CHARACTERS.map((c) => c.id);

export function characterById(id: string) {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}

export function characterByName(name: string) {
  return CHARACTERS.find((c) => c.name === name) ?? null;
}

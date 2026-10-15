/** Human-readable link types for skill prompts (mirrors markdoc-react treemap). */
export const TREEMAP_LINK_TYPE_GUIDE: Record<
  string,
  { ja: string; when: string }
> = {
  flow: { ja: "章の流れ", when: "大きな章・節のつながり（読み順の骨格）" },
  seq: { ja: "手順・前提→後続", when: "同じ章内で先に読むべき段落・ステップ" },
  cause: { ja: "原因→結果", when: "理由が先、結論・現象が後" },
  evidence: { ja: "主張→根拠", when: "論点のあとに例・データ・出典" },
  apply: { ja: "原則→適用", when: "一般則のあとに具体ケース" },
  contrast: { ja: "対比", when: "A と B の比較・トレードオフ" },
  rec: { ja: "判断→推奨", when: "分析のあとに示す結論・推奨" },
  end: { ja: "総括へ", when: "詳細からまとめ・TL;DR へ集約" },
  ref: { ja: "参照・言及", when: "別節・別概念への参照（本文の言及に基づく）" },
};

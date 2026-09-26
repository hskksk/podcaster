#!/usr/bin/env python3
"""web-clip-summary のクリップを計測する。

    python3 .agents/skills/web-clip-summary/measure.py <path/to/index.mdoc> \
        [--source-chars N] [--source-lang en|ja]

`references/checklists.md` の「数えられる指標」を出す。目視で見積もらず、
これを実行して出力をそのまま報告する。終了コードは、未達の指標があれば 1。

`--source-chars` に元記事の本文字数を渡すと圧縮の度合いを出す。省くと出ない。
原文が英語なら `--source-lang en` を付ける（既定）。日本語の記事なら `ja`。

**字数の比は、言語をまたぐと意味を持たない。** 英語1語はおよそ日本語2.5字になるため、
英語記事の全訳は原文字数の約42%の日本語字数になる。素の比ではなく、全訳の長さに対する
比（全訳比）で見る。全訳比が90%を超えたら、要約ではなく抄訳になっている。

**圧縮の度合いに合否を置いていない。** 原文にどれだけ水増しがあるかは測れないためである。
宣伝と言い換えで膨らんだ記事は1割に落ちるが、事実だけのポストモーテムは8割残る。
同じ閾値を当てると、後者では事実を捨てることになる。判定するのは上限の 8,000字 だけで、
圧縮できているかは `checklists.md` の代替テスト・復元テスト・抄訳テストで目で見る。

**このスクリプトは骨子を測れない。** 要約が落としてはいけないのは記事の骨子
（主張・根拠・効く範囲）だが、それを機械で見る方法はない。骨子に効くのは
「結論を言っている見出し」と「骨子の表」の二つだけで、どちらも形しか見ていない。
数値の密度と固有名の数は参考値であって、合否に入れていない。数字を散らせば
通ってしまい、骨子のない要約を止められないためである。

**参考値が低いときに、原文にない数値や固有名を書き足してはならない。**
低いのは値が足りないからではなく、骨子をつかめていないことの症状である。
`checklists.md` の骨子テストに戻る。

計測範囲は本文だけである。frontmatter、`{% diagram %}` の中身、フェンス付き
コードブロック、`## 出どころ` 以降は外す。散文の判定から表・箇条書き・見出し・
引用も外す。
"""
import re
import statistics
import sys

SOURCES = "## 出どころ"
# 要約が「記事の存在」を説明してしまう定型句
INTRO = (r"本記事|この記事で[はも]|について(?:詳しく)?(?:解説|説明|紹介)し"
         r"|が(?:紹介|解説|説明|まとめ)られ|を(?:紹介|解説)している"
         r"|について(?:述べ|論じ)られ")
# 具体を上位語に置き換えたときに出る語
VAGUE = (r"様々な|さまざまな|いくつかの|多岐にわたる|非常に|きわめて|数多く"
         r"|一定の|ある程度|といった点|などが挙げられ")
# スキル側の作業用語。読者はこのスキルを読んでいない
INTERNAL = (r"見取り図|射程|スロット|\bL1\b|\bL2\b|\bL3\b|主張[0-9]"
            r"|抽象化圧縮|紹介文化|目次テスト|骨子テスト")
# 英語からの直訳の印（japanese.md 1.3）
CALQUE = (r"運ぶ|稼ぐ|表面積|不等式|コスト関数|去就|足すのは|買うもの|買い戻す"
          r"|肩代わり|が教えてくれる")
SAY_FINAL = r"(述べる|書く|指摘する|明言する|論じる)。$"
# 固有名として数えない一般語
GENERIC = {
    "URL", "HTTP", "HTTPS", "PDF", "API", "OK", "NG", "note", "type",
    "callout", "diagram", "mermaid", "markdown", "and", "the", "for", "of",
    "to", "in", "is", "we", "it", "on", "req", "ms", "GB", "MB", "KB",
}


def split_clip(text):
    parts = text.split("---", 2)
    body = parts[2] if len(parts) > 2 else text
    body = re.sub(r"\{% diagram.*?\{% /diagram %\}", "", body, flags=re.S)
    fenced = re.findall(r"^```.*?^```", body, flags=re.S | re.M)
    body = re.sub(r"^```.*?^```", "", body, flags=re.S | re.M)
    if SOURCES in body:
        main, sources = body.split(SOURCES, 1)
    else:
        main, sources = body, ""
    return main, sources, sum(len(f) for f in fenced)


def prose_sentences(main):
    """散文だけを取り出す。見出し・表・箇条書き・引用・Markdoc タグは外す。"""
    paragraphs, current = [], []
    for line in main.split("\n"):
        stripped = line.strip()
        if line.startswith(("#", "|")) or not stripped or stripped.startswith("{%"):
            if current:
                paragraphs.append(" ".join(current))
                current = []
        elif line.startswith(("-", "*", "`", ">")):
            continue
        else:
            current.append(stripped)
    if current:
        paragraphs.append(" ".join(current))
    sentences = [
        s.strip()
        for p in paragraphs
        for s in re.split(r"(?<=。)", p)
        if len(s.strip()) > 3
    ]
    return paragraphs, sentences


def proper_names(main):
    """英数字の固有名を数える。製品名・API 名・コマンド名の在庫を見る。"""
    names = set()
    for line in main.split("\n"):
        if line.startswith("#"):
            continue
        for token in re.findall(r"[A-Za-z][A-Za-z0-9_.+#/-]{1,}", line):
            token = token.strip("._-/")
            if len(token) < 2 or token in GENERIC or token.lower() in GENERIC:
                continue
            names.add(token)
    return names


def table_rows(main, heading="## 骨子"):
    if heading not in main:
        return None
    section = main.split(heading, 1)[1].split("\n## ", 1)[0]
    rows = [l for l in section.split("\n") if l.strip().startswith("|")]
    body_rows = [l for l in rows if not re.match(r"^\s*\|[\s:|-]+\|\s*$", l)]
    return max(len(body_rows) - 1, 0)  # ヘッダ行を引く


def quote_blocks(main):
    blocks, current = [], []
    for line in main.split("\n"):
        if line.startswith(">"):
            current.append(line.lstrip("> ").strip())
        elif current:
            blocks.append(" ".join(current))
            current = []
    if current:
        blocks.append(" ".join(current))
    return blocks


def check(label, value, ok, note=""):
    print(f"  {'OK ' if ok else 'NG '} {label:<28} {value:>12}   {note}")
    return ok


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    source_chars, source_lang = None, "en"
    for i, a in enumerate(sys.argv):
        if a == "--source-chars" and i + 1 < len(sys.argv):
            source_chars = int(sys.argv[i + 1])
        elif a.startswith("--source-chars="):
            source_chars = int(a.split("=", 1)[1])
        elif a == "--source-lang" and i + 1 < len(sys.argv):
            source_lang = sys.argv[i + 1]
        elif a.startswith("--source-lang="):
            source_lang = a.split("=", 1)[1]
    path = args[0]
    text = open(path, encoding="utf-8").read()
    front = text.split("---", 2)[1] if text.startswith("---") else ""
    body, sources, fenced_chars = split_clip(text)
    paragraphs, sentences = prose_sentences(body)
    if not sentences:
        print(f"{path}: 散文が見つからない。範囲の切り方を確認する。")
        return 2

    lengths = [len(s) for s in sentences]
    body_chars = len(body)
    per_k = body_chars / 1000
    bold = re.findall(r"\*\*[^*]+\*\*", body)
    numbers = [
        n for line in body.split("\n") if not line.startswith("#")
        for n in re.findall(r"\d+(?:[.,]\d+)?", line)
    ]
    names = proper_names(body)
    intro = re.findall(INTRO, body)
    vague = re.findall(VAGUE, body)
    internal = re.findall(INTERNAL, body)
    calque = re.findall(CALQUE, body)
    say = [s for s in sentences if re.search(SAY_FINAL, s)]
    quotes = quote_blocks(body)
    h2 = [l[3:].strip() for l in body.split("\n") if l.startswith("## ")]
    themes = [h for h in h2 if re.match(r"^\d+\.\s", h)]
    claiming = [h for h in themes if "—" in h or "―" in h]
    rows = table_rows(body)
    front_url = re.search(r'^url:\s*"?(https?://\S+?)"?\s*$', front, re.M)
    source_urls = set(re.findall(r"https?://[^\s)>\]]+", sources))

    print(f"\n{path}\n")
    print(f"本文（{SOURCES} より前、図とコードブロックを除く）")
    ok = []
    ok.append(check("本文字数", body_chars, body_chars <= 8000,
                    f"上限 8,000。下限はない（コード {fenced_chars} 字を除外）"))
    if source_chars:
        # 英語1語 ≒ 日本語2.5字、英語1語 ≒ 6字。全訳は原文字数の約42%の日本語字数になる。
        factor = 0.42 if source_lang == "en" else 1.0
        full = source_chars * factor
        check("字数の比", f"{body_chars / source_chars * 100:.0f}%", True,
              f"参考値。原文 {source_chars} 字（{source_lang}）。言語が違うと比較できない")
        check("全訳比", f"{body_chars / full * 100:.0f}%", True,
              f"参考値。全訳 約{full:.0f}字。90%超なら抄訳を疑う。骨子の表とクリップ側の節も字数に入るため高めに出る")
    else:
        check("全訳比", "—", True,
              "--source-chars <原文の字数> --source-lang en|ja を渡すと出る")
    check("散文の文数", len(sentences), True, "")
    ok.append(check("一文の平均字数", f"{statistics.mean(lengths):.1f}",
                    50 <= statistics.mean(lengths) <= 95,
                    "目標 50〜95。下回ると切れ切れになる"))
    ok.append(check("150字を超える文", sum(1 for x in lengths if x > 150),
                    all(x <= 150 for x in lengths), "0 にする"))
    check("250字を超える段落", sum(1 for p in paragraphs if len(p) > 250), True,
          "多いなら継ぎ目で割る")
    ok.append(check("太字の密度 /1000字", f"{len(bold) / per_k:.1f}",
                    3 <= len(bold) / per_k <= 8, f"目標 3〜8（実数 {len(bold)}）"))

    print("\n具体が残っているか（参考値。合否に入れない）")
    check("数値の密度 /1000字", f"{len(numbers) / per_k:.1f}", True,
          f"実数 {len(numbers)}。1.5 を下回るなら抽象化圧縮を疑う")
    check("異なる固有名の数", len(names), True,
          "6 を下回るなら抽象化圧縮を疑う。値を足すのではなく骨子テストに戻る")
    ok.append(check("記事を紹介する定型句", len(intro), not intro,
                    f"目標 0 {sorted(set(intro)) if intro else ''}"))
    ok.append(check("ぼかし語の密度 /1000字", f"{len(vague) / per_k:.1f}",
                    len(vague) / per_k <= 2.0,
                    f"目標 2.0以下 {sorted(set(vague)) if vague else ''}"))

    print("\n日本語")
    ok.append(check("内部語の出現", len(internal), not internal,
                    f"目標 0 {sorted(set(internal)) if internal else ''}"))
    ok.append(check("直訳テストの語", len(calque), not calque,
                    f"目標 0 {sorted(set(calque)) if calque else ''}"))
    ok.append(check("「〜は述べる」で終わる文", len(say), not say, "目標 0"))

    print("\n構造")
    ok.append(check("節の数", len(themes), 2 <= len(themes) <= 6, "目標 2〜6"))
    ok.append(check("結論を言っている見出し", f"{len(claiming)}/{len(themes)}",
                    bool(themes) and len(claiming) == len(themes),
                    "全部が `<番号>. <対象> — <主張>` の形"))
    ok.append(check("骨子の表の行数", "なし" if rows is None else rows,
                    rows is not None and 3 <= rows <= 6,
                    "`## 骨子` に3〜6行。7行以上なら節に割る"))
    ok.append(check("逐語引用", f"{len(quotes)}箇所",
                    len(quotes) <= 3 and all(len(q) <= 300 for q in quotes),
                    f"3箇所以下・各300字以下（最長 {max((len(q) for q in quotes), default=0)}字）"))

    print("\n出どころ")
    ok.append(check("frontmatter の url", "あり" if front_url else "なし",
                    bool(front_url), "貼り付け本文なら未達のままでよい。出どころにその旨を書く"))
    ok.append(check("出どころの URL 数", len(source_urls), len(source_urls) >= 1,
                    "元記事の URL を必ず書く"))
    ok.append(check("取得日", "あり" if "取得日" in sources else "なし",
                    "取得日" in sources, "記事は書き換わる"))

    print("\nMarkdoc")
    diagrams = re.findall(r"\{% diagram.*?\{% /diagram %\}", text, flags=re.S)
    check("diagram の数", len(diagrams), True, "原文に図があるときだけ描く")
    ok.append(check("diagram をフェンスで包んだか", f"{len(diagrams)}個",
                    all("```" in d for d in diagrams), "包まないと図が出ない"))
    quad = re.findall(r"\*{3,}", body)
    ok.append(check("壊れた太字記法", len(quad), not quad,
                    "`****` は太字にならない。`**` を入れ子にしない"))
    diagram_bold = [d for d in diagrams if "**" in d]
    ok.append(check("図のノードの太字記法", len(diagram_bold), not diagram_bold,
                    "Mermaid は `**` を解釈しない。強調は <b> を使う"))

    failed = sum(1 for x in ok if not x)
    print(f"\n未達 {failed} 件 / {len(ok)} 指標")
    print("この出力をそのまま報告する。数字を書き換えたり、目視で上書きしたりしない。")
    print("数値と固有名は参考値である。低いときは値を足すのではなく、骨子テストに戻る。")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""podcast-research2 のレポートを計測する。

    python3 .agents/skills/podcast-research2/measure.py <path/to/index.mdoc>

`references/checklists.md` の「数えられる指標」を出す。目視で見積もらず、
これを実行して出力をそのまま報告する。終了コードは、未達の指標があれば 1。

計測範囲は本文だけである。frontmatter、`{% diagram %}` の中身、
`## 付録: 出典一覧` 以降は外す。散文の判定から表・箇条書き・見出しも外す。
"""
import re
import statistics
import sys

APPENDIX = "## 付録: 出典一覧"
INTERNAL = r"見取り図|射程|骨格|スロット|\bL1\b|\bL2\b|\bL3\b|主張[0-9]"
CALQUE = r"運ぶ|稼ぐ|表面積|不等式|コスト関数|去就|足すのは|買うもの|買い戻す|肩代わり|が教えてくれる"
SAY_FINAL = r"(述べる|書く|指摘する|明言する|論じる)。$"


def split_report(text):
    parts = text.split("---", 2)
    body = parts[2] if len(parts) > 2 else text
    body = re.sub(r"\{% diagram.*?\{% /diagram %\}", "", body, flags=re.S)
    if APPENDIX in body:
        main, appendix = body.split(APPENDIX, 1)
    else:
        main, appendix = body, ""
    return main, appendix


def prose_sentences(main):
    paragraphs, current = [], []
    for line in main.split("\n"):
        if line.startswith(("#", "|")) or not line.strip():
            if current:
                paragraphs.append(" ".join(current))
                current = []
        elif line.startswith(("-", "*", "`", ">")):
            continue
        else:
            current.append(line.strip())
    if current:
        paragraphs.append(" ".join(current))
    sentences = [
        s.strip()
        for p in paragraphs
        for s in re.split(r"(?<=。)", p)
        if len(s.strip()) > 3
    ]
    return paragraphs, sentences


def source_names(appendix, body):
    """付録の出典一覧から、著者・組織の名前を集める。

    本文の主題位置チェックに使う。二つを外す。ひとつは総称語。もうひとつは、
    本文に何度も出る語である。20回出る語はそのレポートの主題であって、
    引用元の名前ではない。ここを外さないと、題材の名前を誤検出する。
    """
    generic = {
        "URL", "HTTP", "HTTPS", "PDF", "ETL", "ELT", "LLM", "AI", "API", "SQL",
        "Blog", "Docs", "Forum", "Things", "Knowledge", "Proceedings", "Inc",
        "Community", "Alliance", "Engineers", "Techniques", "Keynote",
    }
    names = set()
    for line in appendix.split("\n"):
        line = re.sub(r"^[-*\s]*\[?\d+\]?[.)]?\s*", "", line)
        if not line.strip():
            continue
        head = re.split(r"[,、（(【\[]", line)[0]
        for token in re.findall(
            r"[A-Z][A-Za-z0-9\-.&']{2,}(?:\s[A-Z][A-Za-z0-9\-.&']{2,})?", head
        ):
            names.add(token)
        for token in re.findall(
            r"[\u4e00-\u9fa5\u3041-\u309f\u30a1-\u30f6]{2,6}(?=氏)", head
        ):
            names.add(token)
    out = set()
    for name in names:
        if len(name) <= 2 or name in generic:
            continue
        if any(part in generic for part in name.split()) and len(name.split()) == 1:
            continue
        if len(re.findall(re.escape(name), body)) > 15:
            continue  # 本文の主題語
        out.add(name)
    return out


def check(label, value, ok, note=""):
    mark = "OK " if ok else "NG "
    print(f"  {mark} {label:<30} {value:>12}   {note}")
    return ok


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    path = sys.argv[1]
    text = open(path, encoding="utf-8").read()
    body, appendix = split_report(text)
    paragraphs, sentences = prose_sentences(body)
    if not sentences:
        print(f"{path}: 散文が見つからない。範囲の切り方を確認する。")
        return 2

    lengths = [len(s) for s in sentences]
    body_chars = len(body)
    bold = re.findall(r"\*\*[^*]+\*\*", body)
    bold_density = len(bold) / body_chars * 1000
    cites_used = {int(x) for x in re.findall(r"\[(\d+)\]", body)}
    cites_listed = {
        int(x)
        for x in re.findall(r"^[-*\s]*(?:\[(\d+)\]|(\d+)[.)])\s", appendix, re.M)
        for x in [x[0] or x[1]]
    }
    urls = set(re.findall(r"https?://[^\s)>\]]+", appendix))
    names = source_names(appendix, body)
    name_re = "|".join(re.escape(n) for n in names) if names else r"(?!x)x"
    subject_re = r"^.{0,25}?(" + name_re + r")(?:\s*(?:の|は|が|も|では|による|によれば|を))"
    subject_pos = [s for s in sentences if re.search(subject_re, s)]
    internal = re.findall(INTERNAL, body)
    calque = re.findall(CALQUE, body)
    say = [s for s in sentences if re.search(SAY_FINAL, s)]
    h2 = [l[3:].strip() for l in body.split("\n") if l.startswith("## ")]
    themes = [h for h in h2 if re.match(r"^\d+\.\s", h)]
    claiming = [h for h in themes if "—" in h or "―" in h]

    print(f"\n{path}\n")
    print("本文（付録の出典一覧より前、図を除く）")
    ok = []
    ok.append(check("本文字数", body_chars, body_chars >= 14000, "目標 20,000（14,000未満は調査を足す）"))
    ok.append(check("散文の文数", len(sentences), True, ""))
    ok.append(check("一文の平均字数", f"{statistics.mean(lengths):.1f}", 55 <= statistics.mean(lengths) <= 95, "目標 55〜95"))
    ok.append(check("150字を超える文", sum(1 for x in lengths if x > 150), all(x <= 150 for x in lengths), "0 にする"))
    ok.append(check("250字を超える段落", sum(1 for p in paragraphs if len(p) > 250), True, "多いなら継ぎ目で割る"))
    ok.append(check("太字の密度 /1000字", f"{bold_density:.1f}", 3 <= bold_density <= 8, f"目標 3〜8（実数 {len(bold)}）"))
    ok.append(check("[n] 引用の数", len(re.findall(r"\[\d+\]", body)), bool(cites_used), ""))
    ok.append(check("内部語の出現", len(internal), not internal, f"目標 0 {sorted(set(internal)) if internal else ''}"))
    ok.append(check("直訳テストの語", len(calque), not calque, f"目標 0 {sorted(set(calque)) if calque else ''}"))
    ok.append(check("「〜は述べる」で終わる文", len(say), not say, "目標 0"))
    pct = len(subject_pos) / len(sentences) * 100
    ok.append(check("出典名が主題位置の文", f"{pct:.0f}%", pct <= 10,
                    "目標 10%以下（著者そのものが論点の題材は例外。該当箇所を見て判断する）"))

    print("\n見出し")
    ok.append(check("番号付きのテーマ数", len(themes), 4 <= len(themes) <= 8, "目標 4〜8"))
    ok.append(check("結論を言っている見出し", f"{len(claiming)}/{len(themes)}", len(claiming) == len(themes),
                    "全部が `<番号>. <対象> — <主張>` の形"))

    print("\n付録")
    ok.append(check("互いに異なる URL の数", len(urls), len(urls) >= 8,
                    "同じ文献の別版で本数を稼がない"))
    ok.append(check("番号が付録に対応しているか", f"{len(cites_used - cites_listed)}件 未定義",
                    not (cites_used - cites_listed), f"未定義: {sorted(cites_used - cites_listed)}" if cites_used - cites_listed else ""))
    ok.append(check("本文で未使用の出典", f"{len(cites_listed - cites_used)}件",
                    not (cites_listed - cites_used), f"{sorted(cites_listed - cites_used)}" if cites_listed - cites_used else ""))

    print("\nMarkdoc")
    diagrams = re.findall(r"\{% diagram.*?\{% /diagram %\}", text, flags=re.S)
    ok.append(check("diagram をフェンスで包んだか", f"{len(diagrams)}個",
                    all("```" in d for d in diagrams), "包まないと図が出ない"))

    failed = sum(1 for x in ok if not x)
    print(f"\n未達 {failed} 件 / {len(ok)} 指標")
    print("この出力をそのまま報告する。数字を書き換えたり、目視で上書きしたりしない。")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""podcast-research2 のモデル非依存な指標を計測する。

    python3 .agents/skills/podcast-research2/measure.py \
      --model front|middle|rear \
      content/docs/<slug>/index.mdoc

構成の適否は references/checklists.md で判断する。このスクリプトは、重心を
固定目次へ逆戻りさせずに数えられる共通指標だけを検査する。
"""

import argparse
import re
import statistics
import sys
from pathlib import Path


APPENDIX = "## 付録: 出典一覧"
INTERNAL = (
    r"前重心|中重心|後重心|価値の中心|"
    r"見取り図|射程|骨格|スロット|\bL1\b|\bL2\b|\bL3\b|主張[0-9]"
)
CALQUE = (
    r"運ぶ|稼ぐ|表面積|不等式|コスト関数|去就|"
    r"足すのは|買うもの|買い戻す|肩代わり|が教えてくれる"
)
SAY_FINAL = r"(述べる|書く|指摘する|明言する|論じる)。$"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        required=True,
        choices=("front", "middle", "rear"),
        help="選んだ主重心。構成判定ではなく報告とチェックリスト選択に使う",
    )
    parser.add_argument("path", type=Path)
    return parser.parse_args()


def split_report(text):
    parts = text.split("---", 2)
    body = parts[2] if len(parts) > 2 else text
    body = re.sub(r"\{% diagram.*?\{% /diagram %\}", "", body, flags=re.S)
    if APPENDIX in body:
        main, appendix = body.split(APPENDIX, 1)
        return main, appendix, True
    return body, "", False


def prose_sentences(main):
    paragraphs, current = [], []
    for line in main.splitlines():
        stripped = line.strip()
        if line.startswith(("#", "|")) or not stripped:
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
        sentence.strip()
        for paragraph in paragraphs
        for sentence in re.split(r"(?<=。)", paragraph)
        if len(sentence.strip()) > 3
    ]
    return paragraphs, sentences


def source_names(appendix, body):
    """付録から著者・組織名を拾い、本文の主題位置チェックに使う。"""
    generic = {
        "URL", "HTTP", "HTTPS", "PDF", "ETL", "ELT", "LLM", "AI", "API", "SQL",
        "Blog", "Docs", "Forum", "Things", "Knowledge", "Proceedings", "Inc",
        "Community", "Alliance", "Engineers", "Techniques", "Keynote",
    }
    names = set()
    for line in appendix.splitlines():
        line = re.sub(r"^[-*\s]*\[?\d+\]?[.)]?\s*", "", line)
        if not line:
            continue
        head = re.split(r"[,、（(【\[]", line)[0]
        names.update(
            re.findall(
                r"[A-Z][A-Za-z0-9\-.&']{2,}"
                r"(?:\s[A-Z][A-Za-z0-9\-.&']{2,})?",
                head,
            )
        )
        names.update(
            re.findall(
                r"[\u4e00-\u9fa5\u3041-\u309f\u30a1-\u30f6]{2,6}(?=氏)",
                head,
            )
        )
    return {
        name
        for name in names
        if len(name) > 2
        and name not in generic
        and not (
            any(part in generic for part in name.split())
            and len(name.split()) == 1
        )
        and len(re.findall(re.escape(name), body)) <= 15
    }


def result(label, value, ok, note="", *, required=True):
    if required:
        mark = "OK " if ok else "NG "
    else:
        mark = "参考"
    print(f"  {mark} {label:<30} {str(value):>12}   {note}")
    return ok or not required


def main():
    args = parse_args()
    text = args.path.read_text(encoding="utf-8")
    body, appendix, has_appendix = split_report(text)
    paragraphs, sentences = prose_sentences(body)
    if not sentences:
        print(f"{args.path}: 散文が見つからない。範囲の切り方を確認する。")
        return 2

    lengths = [len(sentence) for sentence in sentences]
    body_chars = len(body)
    bold = re.findall(r"\*\*[^*]+\*\*", body)
    bold_density = len(bold) / body_chars * 1000 if body_chars else 0
    cites_used = {int(value) for value in re.findall(r"\[(\d+)\]", body)}
    cites_listed = {
        int(first or second)
        for first, second in re.findall(
            r"^[-*\s]*(?:\[(\d+)\]|(\d+)[.)])\s",
            appendix,
            re.M,
        )
    }
    urls = set(re.findall(r"https?://[^\s)>\]]+", appendix))
    names = source_names(appendix, body)
    name_re = "|".join(re.escape(name) for name in names) if names else r"(?!x)x"
    subject_re = (
        r"^.{0,25}?(" + name_re + r")(?:\s*(?:の|は|が|も|では|による|によれば|を))"
    )
    subject_pos = [
        sentence for sentence in sentences if re.search(subject_re, sentence)
    ]
    internal = re.findall(INTERNAL, body)
    calque = re.findall(CALQUE, body)
    say = [sentence for sentence in sentences if re.search(SAY_FINAL, sentence)]

    print(f"\n{args.path}")
    print(f"主重心: {args.model}")
    print("\n本文（付録の出典一覧より前、図を除く）")

    checks = []
    result("本文字数", body_chars, True, "参考値。下限なし", required=False)
    result("散文の文数", len(sentences), True, "", required=False)
    result(
        "一文の平均字数",
        f"{statistics.mean(lengths):.1f}",
        True,
        "目安 55〜95",
        required=False,
    )
    result(
        "150字を超える文",
        sum(length > 150 for length in lengths),
        True,
        "内容を見て分割を検討",
        required=False,
    )
    result(
        "250字を超える段落",
        sum(len(paragraph) > 250 for paragraph in paragraphs),
        True,
        "話題が二つなら分割",
        required=False,
    )
    result(
        "太字の密度 /1000字",
        f"{bold_density:.1f}",
        True,
        f"目安 3〜8（実数 {len(bold)}）",
        required=False,
    )
    checks.append(result("[n] 引用", len(cites_used), bool(cites_used), "1件以上"))
    checks.append(
        result(
            "内部語の出現",
            len(internal),
            not internal,
            f"目標 0 {sorted(set(internal)) if internal else ''}",
        )
    )
    checks.append(
        result(
            "直訳テストの語",
            len(calque),
            not calque,
            f"目標 0 {sorted(set(calque)) if calque else ''}",
        )
    )
    checks.append(
        result("「〜は述べる」で終わる文", len(say), not say, "目標 0")
    )
    subject_pct = len(subject_pos) / len(sentences) * 100
    result(
        "出典名が主題位置の文",
        f"{subject_pct:.0f}%",
        True,
        "目安 10%以下。著者自体が題材なら例外",
        required=False,
    )

    print("\n出典")
    checks.append(
        result(
            "## 付録: 出典一覧",
            "あり" if has_appendix else "なし",
            has_appendix,
            "番号引用の対応先",
        )
    )
    checks.append(
        result(
            "互いに異なる URL",
            len(urls),
            len(urls) >= 8,
            "8以上。同じ文献の別版で本数を稼がない",
        )
    )
    undefined = cites_used - cites_listed
    checks.append(
        result(
            "本文引用の未定義番号",
            len(undefined),
            not undefined,
            f"{sorted(undefined) if undefined else ''}",
        )
    )
    unused = cites_listed - cites_used
    result(
        "本文で未使用の出典",
        len(unused),
        True,
        f"資料一覧として残す意図を確認 {sorted(unused) if unused else ''}",
        required=False,
    )

    print("\nMarkdoc")
    diagrams = re.findall(r"\{% diagram.*?\{% /diagram %\}", text, flags=re.S)
    checks.append(
        result(
            "diagram のフェンス",
            f"{len(diagrams)}個",
            all("```" in diagram for diagram in diagrams),
            "包まないと図が出ない",
        )
    )
    broken_bold = re.findall(r"\*{3,}", body)
    checks.append(
        result(
            "壊れた太字記法",
            len(broken_bold),
            not broken_bold,
            "`****` や太字の入れ子を直す",
        )
    )
    diagram_bold = [diagram for diagram in diagrams if "**" in diagram]
    checks.append(
        result(
            "図の Markdown 太字",
            len(diagram_bold),
            not diagram_bold,
            "Mermaid の強調は <b> を使う",
        )
    )
    entry_urls = re.findall(
        r"^[-*\s]*(?:\[\d+\]|\d+[.)])\s.*?(https?://[^\s)>\]]+)",
        appendix,
        re.M,
    )
    duplicates = len(entry_urls) - len(set(entry_urls))
    checks.append(
        result(
            "同一 URL の重複番号",
            duplicates,
            duplicates == 0,
            "同じページは一度だけ登録する",
        )
    )

    failed = sum(not check for check in checks)
    print(f"\n共通必須指標の未達 {failed} 件 / {len(checks)} 指標")
    print(
        "構成は references/checklists.md の共通テストと"
        f" {args.model} の重心別テストで確認する。"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

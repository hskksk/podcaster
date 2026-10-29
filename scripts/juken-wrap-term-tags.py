#!/usr/bin/env python3
"""Wrap plushie metaphor words in juken say blocks with {% term %}. Idempotent."""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WEEKS = REPO / "chugaku-juken/sapix/grade5-japanese-history/weeks"

# (metaphor phrase in speech, real term for `real` attribute) — longest first
PHRASES: list[tuple[str, str]] = [
    ("公園のフェンス", "土地の境目"),
    ("大きな見はりの人", "守護大名"),
    ("鎌倉のリーダーたち", "幕府"),
    ("鎌倉の言いつけ", "幕府の命令"),
    ("将軍のチーム", "幕府"),
    ("見はりの人", "守護"),
    ("見はりの役", "守護"),
    ("言いつけ", "命令"),
    ("公園", "土地"),
]

NOTE_SHORTEN = {
    'note="御恩＝主君が家来にあたえるごほうび。土地を守ったり、新しい土地をあたえたりする"':
    'note="御恩＝主君が家来にあたえるごほうび"',
    'note="御恩＝主君が家来の働きに、土地などでむくいること。元との戦いでは、ほめる土地を十分に用意できなかった"':
    'note="御恩＝主君が家来の働きに、土地などでむくいること。元寇では、新しくあげる土地を十分に用意できなかった"',
    'note="奉公＝主君のために働くこと。いくさに出ることや、京都や鎌倉の警備をすること"':
    'note="奉公＝主君のために働くこと。いくさや警備などのお仕事"',
}


def wrap_phrase(line: str, phrase: str, real: str) -> str:
    open_tag = f'{{% term real="{real}" %}}{phrase}{{% /term %}}'
    if phrase not in line:
        return line
    out: list[str] = []
    i = 0
    while i < len(line):
        if line.startswith("{% term real=", i):
            end = line.find("{% /term %}", i)
            if end == -1:
                out.append(line[i:])
                break
            out.append(line[i : end + len("{% /term %}")])
            i = end + len("{% /term %}")
            continue
        j = line.find(phrase, i)
        if j == -1:
            out.append(line[i:])
            break
        out.append(line[i:j])
        out.append(open_tag)
        i = j + len(phrase)
    return "".join(out)


def wrap_line_all(line: str) -> str:
    out = line
    for phrase, real in PHRASES:
        out = wrap_phrase(out, phrase, real)
    return out


def process_say_blocks(text: str) -> str:
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    in_say = False
    for line in lines:
        if re.match(r"\{%\s*say\s", line):
            in_say = True
            for old, new in NOTE_SHORTEN.items():
                line = line.replace(old, new)
            out.append(line)
            continue
        if in_say and re.match(r"\{%\s*/say\s*%}", line):
            in_say = False
            out.append(line)
            continue
        if in_say and not line.strip().startswith("{%"):
            out.append(wrap_line_all(line))
        else:
            out.append(line)
    return "".join(out)


def main() -> int:
    targets = sorted(WEEKS.glob("2026-10-26/*.mdoc"))
    targets += sorted(WEEKS.glob("2026-11-02/*.mdoc"))
    targets += sorted(WEEKS.glob("2026-11-09/*.mdoc"))
    for path in targets:
        raw = path.read_text(encoding="utf-8")
        new = process_say_blocks(raw)
        if new != raw:
            path.write_text(new, encoding="utf-8")
            print("updated", path.relative_to(REPO))
    return 0


if __name__ == "__main__":
    sys.exit(main())

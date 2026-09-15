#!/usr/bin/env python3
"""Scatter plot: DeepSWE pass@1 vs OpenCode Go weekly request quota.

Source data:
  - OpenCode Go usage estimates (weekly request count): https://opencode.ai/docs/ja/go/
  - DeepSWE scores: official leaderboard (deepswe.lol / arXiv 2607.07946)
    and BenchLM's mirror of the official DeepSWE v1.1 leaderboard JSON.
"""

import csv
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

HERE = Path(__file__).resolve().parent

FAMILY = {
    "GPT": "OpenAI",
    "Kimi": "Moonshot",
    "Grok": "xAI",
    "GLM": "Z.AI",
    "DeepSeek": "DeepSeek",
    "Qwen": "Alibaba Qwen",
    "MiMo": "Xiaomi",
    "MiniMax": "MiniMax",
    "Muse": "Meta",
}

COLORS = {
    "OpenAI": "#10a37f",
    "Moonshot": "#5b7cfa",
    "xAI": "#1d1d1f",
    "Z.AI": "#0084ff",
    "DeepSeek": "#4d6bfe",
    "Alibaba Qwen": "#ff6a00",
    "Xiaomi": "#ff6900",
    "MiniMax": "#ff9e0d",
    "Meta": "#0b6cff",
}

LABEL_OFFSET = {
    "GPT 5.6 Luna": (8, -2, "left"),
    "Kimi K3": (8, 2, "left"),
    "Grok 4.6": (8, -2, "left"),
    "GLM-5.3": (8, -2, "left"),
    "GLM-5.3-Flash": (8, -2, "left"),
    "GLM-5.2": (8, -2, "left"),
    "GLM-5.1": (8, -2, "left"),
    "DeepSeek V4 Pro": (8, 0, "left"),
    "DeepSeek V4 Flash": (8, 0, "left"),
    "Qwen3.8 Max": (-8, -2, "right"),
    "Qwen3.6 Plus": (8, -2, "left"),
    "Kimi K2.7 Code": (8, -2, "left"),
    "Kimi K2.6": (8, 2, "left"),
    "MiMo-V2.5-Pro": (8, 4, "left"),
    "MiniMax M2.7": (8, 9, "left"),
    "Muse Spark 1.2 Contributor": (8, 2, "left"),
}


def family_of(name):
    for prefix, fam in FAMILY.items():
        if name.startswith(prefix):
            return fam
    return "Other"


def main():
    rows = []
    with open(HERE / "data.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)

    fig, ax = plt.subplots(figsize=(12.5, 8.2), dpi=150)

    for r in rows:
        name = r["model"]
        x = float(r["deep_swe_pass_at_1"])
        y = int(r["weekly_requests"])
        fam = family_of(name)
        color = COLORS[fam]
        is_v1 = "official v1" in r["score_source"].lower()
        marker = "*" if is_v1 else "o"
        ax.scatter(x, y, s=420 if marker == "*" else 150, c=color,
                   marker=marker, edgecolors="black", linewidths=0.6, zorder=3)
        dx, dy, ha = LABEL_OFFSET.get(name, (8, 0, "left"))
        ax.annotate(name, (x, y), textcoords="offset points",
                    xytext=(dx, dy), ha=ha, fontsize=8.4, color="#111", zorder=4)

    ax.set_yscale("log")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(
        lambda v, p: f"{int(v):,}"))
    ax.set_xlim(0, 75)
    ax.set_ylim(90, 200_000)
    ax.set_xlabel("DeepSWE pass@1  (%, mini-swe-agent harness)", fontsize=11)
    ax.set_ylabel("OpenCode Go weekly request estimate (requests/week)",
                  fontsize=11)
    ax.set_title("OpenCode Go models: DeepSWE accuracy vs included weekly quota",
                 fontsize=13, pad=12)
    ax.grid(True, which="major", ls=":", alpha=0.45, zorder=0)

    ax.axvspan(60, 75, color="#eef7ee", zorder=0)
    ax.text(60.6, 160_000, "frontier tier\n(pass@1 \u2265 60%)", fontsize=8.5,
            color="#1a7f37", va="top")

    handles = []
    for fam, color in COLORS.items():
        if any(family_of(r["model"]) == fam for r in rows):
            handles.append(plt.Line2D([0], [0], marker="o", color="w",
                                      markerfacecolor=color, markersize=9,
                                      label=fam))
    handles.append(plt.Line2D([0], [0], marker="o", color="w",
                              markerfacecolor="#999", markersize=9,
                              label="DeepSWE v1.1 score (BenchLM mirror)"))
    handles.append(plt.Line2D([0], [0], marker="*", color="w",
                              markerfacecolor="#999", markersize=11,
                              label="DeepSWE v1.0 score (official paper)"))
    ax.legend(handles=handles, loc="lower left", fontsize=8.5, frameon=True)

    ax.text(0.985, 0.008,
            "DeepSWE: Datacurve, mini-swe-agent, 113 tasks | weekly quota: opencode.ai/docs/ja/go",
            transform=ax.transAxes, ha="right", fontsize=7, color="#666")

    out = HERE / "deepswe_pass_at_1_vs_weekly_requests.png"
    fig.tight_layout()
    fig.savefig(out, bbox_inches="tight", facecolor="white")
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
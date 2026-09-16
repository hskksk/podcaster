#!/usr/bin/env python3
"""Scatter plot: DeepSWE pass@1 vs OpenCode Zen output token price.

Source data:
  - OpenCode Zen per-token pricing (output $/1M tokens): https://opencode.ai/docs/ja/zen/
  - DeepSWE scores: official leaderboard JSON from deepswe.datacurve.ai
      - v1.1 live: https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json (2026-09-03)
      - v1:        https://deepswe.datacurve.ai/artifacts/v1/leaderboard.json (2026-06-20)
    Best-scoring effort-level config per model is used.
"""

import csv
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

HERE = Path(__file__).resolve().parent

FAMILY = {
    "GPT": "OpenAI",
    "Claude": "Anthropic",
    "Gemini": "Google",
    "Grok": "xAI",
    "Muse": "Meta",
    "DeepSeek": "DeepSeek",
    "GLM": "Z.AI",
    "Kimi": "Moonshot",
    "Qwen": "Alibaba Qwen",
    "MiniMax": "MiniMax",
}

COLORS = {
    "OpenAI": "#10a37f",
    "Anthropic": "#c15f3c",
    "Google": "#4285f4",
    "xAI": "#1d1d1f",
    "Meta": "#0b6cff",
    "DeepSeek": "#4d6bfe",
    "Z.AI": "#0084ff",
    "Moonshot": "#5b7cfa",
    "Alibaba Qwen": "#ff6a00",
    "MiniMax": "#ff9e0d",
}

# Per-model label offsets tuned to avoid overlap (dx, dy, ha)
LABEL_OFFSET = {
    "GPT 6 Astra": (8, 0, "left"),
    "Gemini 3.8 Flash": (-8, 4, "right"),
    "Claude Opus 5": (8, 0, "left"),
    "GPT 5.6 Sol": (8, 4, "left"),
    "Claude Fable 5": (8, 0, "left"),
    "GPT 5.6 Terra": (8, 4, "left"),
    "GLM 5.3": (8, -4, "left"),
    "Kimi K3": (8, 2, "left"),
    "Grok 4.6": (8, -4, "left"),
    "GPT 5.6 Luna": (8, 2, "left"),
    "GPT 5.5": (8, 2, "left"),
    "Gemini 3.7 Flash": (-8, 2, "right"),
    "GLM 5.3 Flash": (8, -2, "left"),
    "DeepSeek V4 Pro": (8, 4, "left"),
    "Claude Opus 4.8": (8, 0, "left"),
    "Muse Spark 1.2": (8, -2, "left"),
    "Claude Sonnet 5": (-8, 4, "right"),
    "Grok 4.5": (8, 0, "left"),
    "DeepSeek V4 Flash": (8, 0, "left"),
    "GPT 5.4": (8, 2, "left"),
    "Gemini 3.6 Flash": (8, 0, "left"),
    "GLM 5.2": (8, 0, "left"),
    "Gemini 3.5 Flash": (8, 0, "left"),
    "Kimi K2.7 Code": (8, 0, "left"),
    "Claude Sonnet 4.6": (8, 2, "left"),
    "Claude Opus 4.7": (-8, 2, "right"),
    "Claude Opus 4.6": (8, 2, "left"),
    "GPT 5.4 Mini": (-8, 4, "right"),
    "Kimi K2.6": (8, 2, "left"),
    "MiniMax M3": (8, 2, "left"),
    "Qwen3.7 Max": (8, 2, "left"),
    "GLM 5.1": (8, 2, "left"),
    "Grok Build 0.1": (8, 2, "left"),
    "Gemini 3.1 Pro": (8, 2, "left"),
    "Gemini 3 Flash": (-8, 2, "right"),
    "Qwen3.6 Plus": (8, -4, "left"),
    "Claude Haiku 4.5": (8, 0, "left"),
    "MiniMax M2.7": (8, 2, "left"),
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

    fig, ax = plt.subplots(figsize=(13.5, 9), dpi=150)

    for r in rows:
        name = r["model"]
        x = float(r["deep_swe_pass_at_1"])
        y = float(r["output_price_usd_per_1m"])
        fam = family_of(name)
        color = COLORS[fam]
        is_v1 = "official DeepSWE v1 " in r["score_source"]
        marker = "s" if is_v1 else "o"
        ax.scatter(x, y, s=320, c=color, marker=marker,
                   edgecolors="black", linewidths=0.6, zorder=3)
        dx, dy, ha = LABEL_OFFSET.get(name, (8, 0, "left"))
        ax.annotate(name, (x, y), textcoords="offset points",
                    xytext=(dx, dy), ha=ha, fontsize=8.2, color="#111", zorder=4)

    ax.set_yscale("log")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(
        lambda v, p: f"${v:g}" if v < 1 else f"${v:.0f}"))
    ax.set_xlim(-2, 78)
    ax.set_ylim(0.1, 300)
    ax.set_xlabel("DeepSWE pass@1  (%, mini-swe-agent harness)", fontsize=11)
    ax.set_ylabel("OpenCode Zen output price (US$ per 1M output tokens)",
                  fontsize=11)
    ax.set_title(
        "OpenCode Zen models: DeepSWE accuracy vs output-token price",
        fontsize=13, pad=12)
    ax.grid(True, which="major", ls=":", alpha=0.45, zorder=0)

    ax.axvspan(60, 78, color="#eef7ee", zorder=0)
    ax.text(60.6, 250, "frontier tier\n(pass@1 \u2265 60%)", fontsize=8.5,
            color="#1a7f37", va="top")

    handles = []
    for fam, color in COLORS.items():
        if any(family_of(r["model"]) == fam for r in rows):
            handles.append(plt.Line2D([0], [0], marker="o", color="w",
                                      markerfacecolor=color, markersize=9,
                                      label=fam))
    handles.append(plt.Line2D([0], [0], marker="o", color="w",
                              markerfacecolor="#999", markersize=9,
                              label="DeepSWE v1.1 score (official JSON)"))
    handles.append(plt.Line2D([0], [0], marker="s", color="w",
                              markerfacecolor="#999", markersize=9,
                              label="DeepSWE v1 score (v1-only model)"))
    ax.legend(handles=handles, loc="lower left", fontsize=8.5, frameon=True,
              ncol=2, columnspacing=1.2)

    ax.text(0.985, 0.006,
            "DeepSWE: Datacurve, mini-swe-agent, 113 tasks | prices: opencode.ai/docs/ja/zen",
            transform=ax.transAxes, ha="right", fontsize=7, color="#666")

    out = HERE / "deepswe_pass_at_1_vs_output_token_price.png"
    fig.tight_layout()
    fig.savefig(out, bbox_inches="tight", facecolor="white")
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
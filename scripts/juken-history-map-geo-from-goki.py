#!/usr/bin/env python3
"""Resample Gokishichido.svg (Wikimedia) into history-map geo.json (non–strict copy).

Requires: pip install svgpathtools numpy

Usage:
  python3 scripts/juken-history-map-geo-from-goki.py \\
    path/to/Gokishichido.svg path/to/geo.json out/geo.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
from svgpathtools import svg2paths2

EXTRA_REGION = {
    "淡路": "南海道",
    "佐渡": "北陸道",
    "隠岐": "山陰道",
    "壱岐": "西海道",
    "対馬": "西海道",
    "岩代": "東山道",
    "磐城": "東山道",
    "羽前": "東山道",
    "羽後": "東山道",
    "陸前": "東山道",
    "陸中": "東山道",
    "陸奥": "東山道",
    "大隅-多禰": "西海道",
}

FILL_TO_REGION = {
    "#ffba06": "畿内",
    "#ff9494": "東海道",
    "#ffd9b4": "東山道",
    "#f4f4f4": "北陸道",
    "#dbdbff": "山陰道",
    "#f5fd95": "山陽道",
    "#dce0c0": "南海道",
    "#eedede": "西海道",
}

REGION_COLORS = {
    "畿内": "#e8c468",
    "東海道": "#f0a0a0",
    "東山道": "#f5c99a",
    "北陸道": "#c8c8d8",
    "山陰道": "#a8b4e8",
    "山陽道": "#e8d060",
    "南海道": "#b8c8a0",
    "西海道": "#d8dcd0",
    "蝦夷地": "#9ec8e0",
}

SKIP_LABELS = {"琵琶湖", "霞ヶ浦", "十和田湖", "海"}


def project(lng: float, lat: float) -> tuple[float, float]:
    return ((lng - 128.5) * 22, (45.8 - lat) * 26)


def main() -> None:
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    svg_path, geo_in, geo_out = sys.argv[1:4]
    geo = json.loads(Path(geo_in).read_text(encoding="utf-8"))
    paths, attrs, _ = svg2paths2(svg_path)

    prov_ll: dict[str, tuple[float, float]] = {}
    region_of: dict[str, str] = dict(EXTRA_REGION)
    for region, blob in geo["provinces"]:
        for token in blob.split():
            name, x, y = token.split(",")
            prov_ll[name] = (float(x), float(y))
            region_of[name] = region

    svg_pts: list[tuple[float, float]] = []
    map_pts: list[tuple[float, float]] = []
    for p, a in zip(paths, attrs):
        lab = a.get("inkscape:label", "")
        if lab in prov_ll:
            bb = p.bbox()
            svg_pts.append(((bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2))
            map_pts.append(project(*prov_ll[lab]))

    svg_arr = np.array(svg_pts, dtype=float)
    map_arr = np.array(map_pts, dtype=float)
    design = np.hstack([svg_arr, np.ones((len(svg_arr), 1))])
    coef_x, _, _, _ = np.linalg.lstsq(design, map_arr[:, 0], rcond=None)
    coef_y, _, _, _ = np.linalg.lstsq(design, map_arr[:, 1], rcond=None)

    def xform(x: float, y: float) -> tuple[float, float]:
        return (
            coef_x[0] * x + coef_x[1] * y + coef_x[2],
            coef_y[0] * x + coef_y[1] * y + coef_y[2],
        )

    def sample_path(path, steps: int = 40) -> list[tuple[float, float]]:
        pts: list[tuple[float, float]] = []
        for t in np.linspace(0, 1, steps):
            z = path.point(t)
            mx, my = xform(z.real, z.imag)
            pts.append((round(mx, 1), round(my, 1)))
        out = [pts[0]]
        for pt in pts[1:]:
            if pt != out[-1]:
                out.append(pt)
        return out

    region_rings: dict[str, list[str]] = {k: [] for k in REGION_COLORS}
    land: list[str] = []

    for p, a in zip(paths, attrs):
        lab = a.get("inkscape:label", "")
        st = a.get("style", "")
        m = re.search(r"fill:(#[0-9a-fA-F]+)", st)
        fill = (m.group(1).lower() if m else "")
        if fill == "#1275ad" or lab in SKIP_LABELS:
            continue
        if lab not in region_of and fill not in FILL_TO_REGION:
            continue
        ring_pts = sample_path(p)
        if len(ring_pts) < 4:
            continue
        ring = " ".join(f"{x},{y}" for x, y in ring_pts)
        land.append(ring)
        reg = region_of.get(lab) or FILL_TO_REGION.get(fill)
        if reg:
            region_rings[reg].append(ring)

    out = {
        "land": land,
        "provinces": geo["provinces"],
        "regions": [
            {"name": k, "color": REGION_COLORS[k], "rings": v}
            for k, v in region_rings.items()
            if v
        ],
        "sourceNote": "Province outlines resampled from Wikimedia Gokishichido.svg (CC BY-SA 3.0); affine fit to existing lat/lng anchors — not a strict copy.",
    }
    Path(geo_out).write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {geo_out} land={len(land)} regions={len(out['regions'])}")


if __name__ == "__main__":
    main()
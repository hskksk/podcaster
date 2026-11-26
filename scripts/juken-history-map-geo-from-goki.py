#!/usr/bin/env python3
"""Resample Gokishichido.svg into history-map geo.json.

Prefer ``juken-history-map-refine-coast.py`` (resample | refine modes).

Requires: pip install svgpathtools numpy

Usage:
  python3 scripts/juken-history-map-geo-from-goki.py \\
    path/to/Gokishichido.svg apps/web/data/juken/history-map/geo.json
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.juken_history_map_goki import load_geo, load_goki_fit, resample_land_from_goki, write_geo  # noqa: E402


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    svg_path, geo_path = sys.argv[1], sys.argv[2]
    geo = load_geo(geo_path)
    fit = load_goki_fit(svg_path, geo)
    land = resample_land_from_goki(fit, geo)
    out = dict(geo)
    out["land"] = land
    out.pop("regions", None)
    out["sourceNote"] = (
        "Province outlines resampled from Wikimedia Gokishichido.svg (CC BY-SA 3.0); "
        "affine fit to province lng/lat anchors in geo.provinces — not a strict copy."
    )
    write_geo(geo_path, out)
    print(f"wrote {geo_path} land={len(land)} vertices={sum(len(r.split()) for r in land)}")


if __name__ == "__main__":
    main()
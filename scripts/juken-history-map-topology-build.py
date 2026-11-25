#!/usr/bin/env python3
"""Build topology.json + render.json from coarse province SVG.

Usage:
  python3 scripts/juken-history-map-topology-build.py \\
    apps/web/data/juken/history-map/reference/gokishichido-coarse-provinces.svg
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from juken_history_map_topology import build_render, build_topology, write_bundle  # noqa: E402

DEFAULT_SVG = (
    Path(__file__).resolve().parent.parent
    / "apps/web/data/juken/history-map/reference/gokishichido-coarse-provinces.svg"
)
DATA_DIR = Path(__file__).resolve().parent.parent / "apps/web/data/juken/history-map"
GEO_LEGACY = DATA_DIR / "geo.json"


def main() -> None:
    svg = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SVG
    if not svg.is_file():
        print(f"missing SVG: {svg}", file=sys.stderr)
        sys.exit(1)
    geo_legacy = json.loads(GEO_LEGACY.read_text(encoding="utf-8")) if GEO_LEGACY.is_file() else {"provinces": []}
    note = (
        "Topology from reference/gokishichido-coarse-provinces.svg (coarse province polygons); "
        "affine fit to geo.provinces anchors."
    )
    topology = build_topology(svg, geo_legacy, source_note=note)
    render = build_render(topology)
    write_bundle(DATA_DIR, topology, render, geo_legacy)
    print(
        f"wrote {DATA_DIR}/topology.json points={len(topology['points'])} "
        f"edges={len(topology['edges'])} areas={len(topology['areas'])} "
        f"land_rings={len(render['land'])}"
    )


if __name__ == "__main__":
    main()
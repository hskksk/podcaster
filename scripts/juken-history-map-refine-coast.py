#!/usr/bin/env python3
"""Coast geometry from Gokishichido.svg for history-map geo.json.

Requires: pip install svgpathtools numpy

Examples:
  # Replace land[] with dense province outlines (lng/lat) — usual fix for coarse coast
  python3 scripts/juken-history-map-refine-coast.py resample \\
    /tmp/Gokishichido.svg apps/web/data/juken/history-map/geo.json

  # Refine existing rings: match each edge to the corresponding SVG boundary arc
  python3 scripts/juken-history-map-refine-coast.py refine \\
    /tmp/Gokishichido.svg apps/web/data/juken/history-map/geo.json --report /tmp/refine-report.json

  # Refine only when the matched Goki ring is close (mean snap < 20 map units)
  python3 scripts/juken-history-map-refine-coast.py refine ... --max-ring-mean 20
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow running as script from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.juken_history_map_goki import (  # noqa: E402
    load_geo,
    load_goki_fit,
    mean_min_distance,
    refine_geo_land,
    resample_land_from_goki,
    write_geo,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["resample", "refine"])
    parser.add_argument("goki_svg", type=Path)
    parser.add_argument("geo_json", type=Path)
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output geo.json (default: overwrite geo_json)",
    )
    parser.add_argument("--report", type=Path, default=None, help="Write JSON edge/refine report (refine mode)")
    parser.add_argument("--min-chord", type=float, default=14.0, help="Skip refine below this chord (map units)")
    parser.add_argument("--min-arc-gain", type=float, default=2.5, help="Need coast arc this much longer than chord")
    parser.add_argument(
        "--max-ring-mean",
        type=float,
        default=25.0,
        help="refine: skip rings whose best Goki match mean distance exceeds this",
    )
    args = parser.parse_args()

    if not args.goki_svg.is_file():
        print(f"missing Goki SVG: {args.goki_svg}", file=sys.stderr)
        sys.exit(1)
    if not args.geo_json.is_file():
        print(f"missing geo.json: {args.geo_json}", file=sys.stderr)
        sys.exit(1)

    geo = load_geo(args.geo_json)
    fit = load_goki_fit(args.goki_svg, geo)
    out_path = args.out or args.geo_json

    if args.mode == "resample":
        land = resample_land_from_goki(fit, geo)
        out = dict(geo)
        out["land"] = land
        out.pop("regions", None)
        out["sourceNote"] = (
            "Province outlines resampled from Wikimedia Gokishichido.svg (CC BY-SA 3.0); "
            "affine fit to province lng/lat anchors in geo.provinces — not a strict copy."
        )
        write_geo(out_path, out)
        verts = sum(len(r.split()) for r in land)
        print(f"wrote {out_path} land_rings={len(land)} vertices={verts}")
        return

    # refine: per-ring edge correspondence when match is trustworthy
    report_payload: dict = {"rings": [], "skipped_rings": []}
    from lib.juken_history_map_goki import (  # noqa: E402
        format_ring_lng_lat,
        match_goki_ring,
        refine_ring_against_goki,
        ring_map_from_lng_lat,
    )

    new_land: list[str] = []
    for ring_idx, ring in enumerate(geo.get("land", [])):
        coarse_map = ring_map_from_lng_lat(ring)
        goki = match_goki_ring(coarse_map, fit.land_rings_map)
        if goki is None:
            new_land.append(ring)
            report_payload["skipped_rings"].append({"ring": ring_idx, "reason": "no_goki_match"})
            continue
        quality = mean_min_distance(coarse_map, goki)
        if quality > args.max_ring_mean:
            new_land.append(ring)
            report_payload["skipped_rings"].append(
                {"ring": ring_idx, "reason": "match_too_weak", "mean_distance": round(quality, 2)}
            )
            continue
        refined, plans = refine_ring_against_goki(
            coarse_map,
            goki,
            min_chord=args.min_chord,
            min_arc_gain=args.min_arc_gain,
        )
        new_land.append(format_ring_lng_lat(refined))
        report_payload["rings"].append(
            {
                "ring": ring_idx,
                "match_mean_distance": round(quality, 2),
                "vertices_before": len(coarse_map),
                "vertices_after": len(refined),
                "edges": [
                    {
                        "i": p.edge_index,
                        "chord_map": round(p.chord_map, 1),
                        "coast_arc_map": round(p.coast_arc_map, 1),
                        "inserted": p.inserted,
                        "skipped": p.skipped_reason,
                    }
                    for p in plans
                ],
            }
        )

    out = dict(geo)
    out["land"] = new_land
    out["sourceNote"] = (
        "Coast refined per edge along Gokishichido.svg boundaries (CC BY-SA 3.0) where ring match quality allows."
    )
    write_geo(out_path, out)
    verts = sum(len(r.split()) for r in new_land)
    print(f"wrote {out_path} land_rings={len(new_land)} vertices={verts}")

    if args.report:
        args.report.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"report {args.report}")


if __name__ == "__main__":
    main()
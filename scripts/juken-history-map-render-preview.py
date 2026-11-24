#!/usr/bin/env python3
"""Render geo.json regions to a standalone SVG (for PR / docs preview)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

VIEWBOX = "0 0 390 405"


def main() -> None:
    geo_path = Path(sys.argv[1] if len(sys.argv) > 1 else "geo.json")
    out_path = Path(sys.argv[2] if len(sys.argv) > 2 else "history-map-geo-preview.svg")
    geo = json.loads(geo_path.read_text(encoding="utf-8"))

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEWBOX}" width="780" height="810">',
        '<rect width="390" height="405" fill="#dfeaf0"/>',
    ]

    clip_polys = "".join(f'<polygon points="{ring}"/>' for ring in geo.get("land", []))
    parts.append(f"<defs><clipPath id='lc'>{clip_polys}</clipPath></defs>")

    for region in geo.get("regions", []):
        color = region["color"]
        for ring in region.get("rings", []):
            parts.append(
                f'<polygon points="{ring}" fill="{color}" fill-opacity="0.92" stroke="none"/>'
            )

    for ring in geo.get("land", []):
        parts.append(
            f'<polygon points="{ring}" fill="none" stroke="#6b6356" stroke-width="1.2"/>'
        )

    # legend
    y = 12
    for region in geo.get("regions", []):
        name = region["name"]
        color = region["color"]
        parts.append(
            f'<rect x="8" y="{y - 8}" width="10" height="10" fill="{color}" stroke="#888" stroke-width="0.5"/>'
            f'<text x="22" y="{y}" font-family="sans-serif" font-size="11" fill="#333">{name}</text>'
        )
        y += 14

    parts.append("</svg>")
    out_path.write_text("\n".join(parts), encoding="utf-8")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
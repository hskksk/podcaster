"""Gokishichido.svg → history-map coast geometry (affine fit, sampling, edge refine)."""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
from svgpathtools import svg2paths2

EXTRA_REGION = {
    "北海道": "蝦夷地",
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
    "#b5e3a8": "蝦夷地",
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

EZO_LAND_LNG_LAT = (
    "140,41.5 140.4,42.3 140.4,43.2 141.2,43.2 141.7,44.4 141.9,45.4 "
    "142.8,44.6 144.3,44 145.3,43.4 144,42.9 143.3,42 141.5,42.6 140.7,41.8"
)


def project_lng_lat(lng: float, lat: float) -> tuple[float, float]:
    return ((lng - 128.5) * 22.0, (45.8 - lat) * 26.0)


def unproject_map(mx: float, my: float) -> tuple[float, float]:
    return (mx / 22.0 + 128.5, 45.8 - my / 26.0)


def parse_ring(ring: str) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for token in ring.split():
        a, b = token.split(",")
        out.append((float(a), float(b)))
    return out


def format_ring_lng_lat(points: list[tuple[float, float]], decimals: int = 2) -> str:
    parts: list[str] = []
    for mx, my in points:
        lng, lat = unproject_map(mx, my)
        parts.append(f"{lng:.{decimals}f},{lat:.{decimals}f}")
    return " ".join(parts)


def format_ring_lng_lat_from_ll(
    points_ll: list[tuple[float, float]], decimals: int = 2
) -> str:
    return " ".join(f"{lng:.{decimals}f},{lat:.{decimals}f}" for lng, lat in points_ll)


def ring_map_from_lng_lat(ring: str) -> list[tuple[float, float]]:
    return [project_lng_lat(lng, lat) for lng, lat in parse_ring(ring)]


def dedupe_consecutive(
    pts: list[tuple[float, float]], eps: float = 0.05
) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for p in pts:
        if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > eps:
            out.append(p)
    return out


@dataclass
class GokiFit:
    xform: Callable[[float, float], tuple[float, float]]
    land_rings_map: list[list[tuple[float, float]]]


def load_goki_fit(svg_path: str | Path, geo: dict) -> GokiFit:
    paths, attrs, _ = svg2paths2(str(svg_path))
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
            map_pts.append(project_lng_lat(*prov_ll[lab]))

    svg_arr = np.array(svg_pts, dtype=float)
    map_arr = np.array(map_pts, dtype=float)
    design = np.hstack([svg_arr, np.ones((len(svg_arr), 1))])
    coef_x, _, _, _ = np.linalg.lstsq(design, map_arr[:, 0], rcond=None)
    coef_y, _, _, _ = np.linalg.lstsq(design, map_arr[:, 1], rcond=None)

    def xform(x: float, y: float) -> tuple[float, float]:
        return (
            float(coef_x[0] * x + coef_x[1] * y + coef_x[2]),
            float(coef_y[0] * x + coef_y[1] * y + coef_y[2]),
        )

    land_rings: list[list[tuple[float, float]]] = []
    for p, a in zip(paths, attrs):
        lab = a.get("inkscape:label", "")
        st = a.get("style", "")
        m = re.search(r"fill:(#[0-9a-fA-F]+)", st)
        fill = m.group(1).lower() if m else ""
        if fill == "#1275ad" or lab in SKIP_LABELS:
            continue
        if lab not in region_of and fill not in FILL_TO_REGION:
            continue
        for sub in p.continuous_subpaths():
            ring = sample_subpath_map(sub, xform, spacing=6.0)
            if len(ring) >= 4:
                land_rings.append(ring)

    return GokiFit(xform=xform, land_rings_map=land_rings)


def sample_subpath_map(
    sub, xform: Callable[[float, float], tuple[float, float]], spacing: float = 6.0
) -> list[tuple[float, float]]:
    length = sub.length()
    if length < 0.5:
        return []
    n = max(3, int(length / spacing) + 1)
    pts: list[tuple[float, float]] = []
    for t in np.linspace(0, 1, n):
        z = sub.point(t)
        pts.append(xform(z.real, z.imag))
    return dedupe_consecutive(pts)


def path_length_pts(pts: list[tuple[float, float]]) -> float:
    if len(pts) < 2:
        return 0.0
    total = 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        total += math.hypot(b[0] - a[0], b[1] - a[1])
    return total


def nearest_on_ring(
    ring: list[tuple[float, float]], pt: tuple[float, float]
) -> tuple[int, float]:
    best_i = 0
    best_d = float("inf")
    for i, p in enumerate(ring):
        d = math.hypot(p[0] - pt[0], p[1] - pt[1])
        if d < best_d:
            best_d, best_i = d, i
    return best_i, best_d


def walk_ring(ring: list[tuple[float, float]], i: int, j: int, forward: bool) -> list[tuple[float, float]]:
    m = len(ring)
    if m == 0:
        return []
    if i == j:
        return [ring[i]]
    out = [ring[i]]
    k = i
    if forward:
        while k != j:
            k = (k + 1) % m
            out.append(ring[k])
    else:
        while k != j:
            k = (k - 1) % m
            out.append(ring[k])
    return out


def mean_min_distance(coarse: list[tuple[float, float]], ring: list[tuple[float, float]]) -> float:
    if not ring:
        return float("inf")
    total = 0.0
    for p in coarse:
        _, d = nearest_on_ring(ring, p)
        total += d
    return total / len(coarse)


def match_goki_ring(
    coarse_map: list[tuple[float, float]], goki_rings: list[list[tuple[float, float]]]
) -> list[tuple[float, float]] | None:
    best: list[tuple[float, float]] | None = None
    best_score = float("inf")
    for ring in goki_rings:
        score = mean_min_distance(coarse_map, ring)
        if score < best_score:
            best_score, best = score, ring
    return best


@dataclass
class EdgeRefinePlan:
    edge_index: int
    chord_map: float
    coast_arc_map: float
    inserted: int
    skipped_reason: str | None


def refine_ring_against_goki(
    coarse_map: list[tuple[float, float]],
    goki_ring: list[tuple[float, float]],
    *,
    min_chord: float = 14.0,
    min_arc_gain: float = 2.5,
    max_snap: float = 35.0,
) -> tuple[list[tuple[float, float]], list[EdgeRefinePlan]]:
    """For each coarse edge, follow the matching Goki boundary arc and insert interior vertices."""
    if len(coarse_map) < 3 or len(goki_ring) < 4:
        return coarse_map, []

    out: list[tuple[float, float]] = []
    plans: list[EdgeRefinePlan] = []
    n = len(coarse_map)

    for i in range(n):
        a = coarse_map[i]
        b = coarse_map[(i + 1) % n]
        out.append(a)
        chord = math.hypot(b[0] - a[0], b[1] - a[1])
        plan = EdgeRefinePlan(i, chord, 0.0, 0, None)

        if chord < min_chord:
            plan.skipped_reason = "short_chord"
            plans.append(plan)
            continue

        ia, da = nearest_on_ring(goki_ring, a)
        ib, db = nearest_on_ring(goki_ring, b)
        if da > max_snap or db > max_snap:
            plan.skipped_reason = "snap_too_far"
            plans.append(plan)
            continue

        fwd = walk_ring(goki_ring, ia, ib, forward=True)
        bwd = walk_ring(goki_ring, ia, ib, forward=False)
        arc = fwd if path_length_pts(fwd) >= path_length_pts(bwd) else bwd
        arc_len = path_length_pts(arc)
        plan.coast_arc_map = arc_len

        if ia == ib or len(arc) <= 2:
            plan.skipped_reason = "degenerate_arc"
            plans.append(plan)
            continue

        if arc_len < chord + min_arc_gain:
            plan.skipped_reason = "arc_not_longer"
            plans.append(plan)
            continue

        for p in arc[1:-1]:
            if math.hypot(p[0] - a[0], p[1] - a[1]) < 0.3:
                continue
            if math.hypot(p[0] - b[0], p[1] - b[1]) < 0.3:
                continue
            out.append(p)
            plan.inserted += 1

        plans.append(plan)

    return dedupe_consecutive(out), plans


def resample_land_from_goki(
    fit: GokiFit, geo: dict, *, spacing: float = 6.0
) -> list[str]:
    """Full land rings in lng/lat from province outlines (union clip), plus Ezo template."""
    rings_ll: list[str] = []
    for ring in fit.land_rings_map:
        rings_ll.append(format_ring_lng_lat(ring))
    ezo = format_ring_lng_lat_from_ll(
        [(float(lng), float(lat)) for lng, lat in (p.split(",") for p in EZO_LAND_LNG_LAT.split())]
    )
    if not any(r == ezo for r in rings_ll):
        rings_ll.append(ezo)
    return rings_ll


def refine_geo_land(
    geo: dict,
    fit: GokiFit,
    *,
    min_chord: float = 14.0,
    min_arc_gain: float = 2.5,
) -> tuple[dict, list[dict]]:
    """Refine existing geo.land rings using Goki boundary correspondence."""
    report: list[dict] = []
    new_land: list[str] = []

    for ring_idx, ring in enumerate(geo.get("land", [])):
        coarse_map = ring_map_from_lng_lat(ring)
        goki = match_goki_ring(coarse_map, fit.land_rings_map)
        if goki is None:
            new_land.append(ring)
            continue
        refined, plans = refine_ring_against_goki(
            coarse_map, goki, min_chord=min_chord, min_arc_gain=min_arc_gain
        )
        new_land.append(format_ring_lng_lat(refined))
        report.append(
            {
                "ring": ring_idx,
                "vertices_before": len(coarse_map),
                "vertices_after": len(refined),
                "goki_vertices": len(goki),
                "edges": [
                    {
                        "i": p.edge_index,
                        "chord": round(p.chord_map, 1),
                        "coast_arc": round(p.coast_arc_map, 1),
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
        "Coast vertices refined against Wikimedia Gokishichido.svg (CC BY-SA 3.0); "
        "long coarse edges follow matching SVG boundary arcs."
    )
    return out, report


def load_geo(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_geo(path: str | Path, geo: dict) -> None:
    Path(path).write_text(json.dumps(geo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
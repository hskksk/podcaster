"""Build history-map topology.json + render.json from coarse province SVG."""
from __future__ import annotations

import json
import math
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from lib.juken_history_map_goki import (
    EXTRA_REGION,
    EZO_LAND_LNG_LAT,
    FILL_TO_REGION,
    REGION_COLORS,
    project_lng_lat,
)

FILL_TO_REGION_HEX = {k.lower(): v for k, v in FILL_TO_REGION.items()}

REGION_ID_NAMES = {
    "kinai": "畿内",
    "tokai": "東海道",
    "tosan": "東山道",
    "hokuriku": "北陸道",
    "sainin": "山陰道",
    "sanyo": "山陽道",
    "nankai": "南海道",
    "saikai": "西海道",
    "ezo": "蝦夷地",
}

NAME_TO_REGION_ID = {v: k for k, v in REGION_ID_NAMES.items()}


def parse_path_loops(d: str) -> list[list[tuple[float, float]]]:
    tokens = re.findall(r"[MLZ]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d.strip())
    loops: list[list[tuple[float, float]]] = []
    cur: list[tuple[float, float]] = []
    i = 0
    x = y = 0.0

    def close() -> None:
        nonlocal cur
        if len(cur) >= 3:
            if cur[0] != cur[-1]:
                cur.append(cur[0])
            deduped: list[tuple[float, float]] = []
            for p in cur:
                if not deduped or math.hypot(p[0] - deduped[-1][0], p[1] - deduped[-1][1]) > 0.01:
                    deduped.append(p)
            if len(deduped) >= 4:
                loops.append(deduped[:-1] if deduped[0] == deduped[-1] else deduped)
        cur = []

    while i < len(tokens):
        t = tokens[i]
        if t == "M":
            close()
            i += 1
            x = float(tokens[i])
            y = float(tokens[i + 1])
            cur = [(x, y)]
            i += 2
        elif t == "L":
            i += 1
            x = float(tokens[i])
            y = float(tokens[i + 1])
            cur.append((x, y))
            i += 2
        elif t == "Z":
            close()
            i += 1
        else:
            i += 1
    close()
    return loops


def parse_province_paths(svg_path: Path) -> list[tuple[str, str, list[list[tuple[float, float]]]]]:
    root = ET.parse(svg_path).getroot()
    ns = ""
    if root.tag.startswith("{"):
        ns = root.tag.split("}")[0] + "}"
    out: list[tuple[str, str, list[list[tuple[float, float]]]]] = []
    for el in root.iter(f"{ns}path"):
        pid = el.get("id", "")
        if not pid or "境界" in pid:
            continue
        fill = (el.get("fill") or "").lower()
        if fill in ("", "none", "#1275ad"):
            continue
        style = el.get("style", "")
        m = re.search(r"fill:(#[0-9a-fA-F]+)", style)
        if m:
            fill = m.group(1).lower()
        if fill in ("none", "#1275ad"):
            continue
        d = el.get("d", "")
        if not d:
            continue
        loops = parse_path_loops(d)
        if loops:
            out.append((pid, fill, loops))
    return out


def province_anchors(geo: dict) -> dict[str, tuple[float, float]]:
    anchors: dict[str, tuple[float, float]] = {}
    for _region, blob in geo.get("provinces", []):
        for token in blob.split():
            parts = token.split(",")
            if len(parts) != 3:
                continue
            name, lng, lat = parts[0], float(parts[1]), float(parts[2])
            anchors.setdefault(name, (lng, lat))
    return anchors


def fit_affine(
    svg_pts: list[tuple[float, float]], ll_pts: list[tuple[float, float]]
) -> tuple[list[float], list[float]]:
    import numpy as np

    svg_arr = np.array(svg_pts, dtype=float)
    ll_arr = np.array(ll_pts, dtype=float)
    design = np.hstack([svg_arr, np.ones((len(svg_arr), 1))])
    coef_lng, _, _, _ = np.linalg.lstsq(design, ll_arr[:, 0], rcond=None)
    coef_lat, _, _, _ = np.linalg.lstsq(design, ll_arr[:, 1], rcond=None)
    return coef_lng.tolist(), coef_lat.tolist()


def ring_centroid(ring: list[tuple[float, float]]) -> tuple[float, float]:
    if not ring:
        return (0.0, 0.0)
    x = sum(p[0] for p in ring) / len(ring)
    y = sum(p[1] for p in ring) / len(ring)
    return (x, y)


def region_name_for(province_id: str, fill: str) -> str:
    if province_id in EXTRA_REGION:
        return EXTRA_REGION[province_id]
    reg = FILL_TO_REGION_HEX.get(fill.lower())
    if reg:
        return reg
    return "東山道"


@dataclass
class MeshBuilder:
    snap_svg: float = 1.0
    points_ll: list[tuple[float, float]] = field(default_factory=list)
    point_key: dict[tuple[int, int], int] = field(default_factory=dict)
    edges: list[tuple[int, int]] = field(default_factory=list)
    edge_key: dict[tuple[int, int], int] = field(default_factory=dict)
    edge_areas: dict[int, list[str]] = field(default_factory=lambda: defaultdict(list))

    def ll_from_svg(self, x: float, y: float, coef_lng: list[float], coef_lat: list[float]) -> tuple[float, float]:
        lng = coef_lng[0] * x + coef_lng[1] * y + coef_lng[2]
        lat = coef_lat[0] * x + coef_lat[1] * y + coef_lat[2]
        return (round(lng, 2), round(lat, 2))

    def point_index(self, ll: tuple[float, float]) -> int:
        key = (int(round(ll[0] * 100)), int(round(ll[1] * 100)))
        if key in self.point_key:
            return self.point_key[key]
        i = len(self.points_ll)
        self.points_ll.append(ll)
        self.point_key[key] = i
        return i

    def edge_index(self, a: int, b: int, area_id: str) -> tuple[int, bool]:
        lo, hi = (a, b) if a < b else (b, a)
        fwd = a == lo
        key = (lo, hi)
        if key not in self.edge_key:
            e = len(self.edges)
            self.edges.append(key)
            self.edge_key[key] = e
        else:
            e = self.edge_key[key]
        if area_id not in self.edge_areas[e]:
            self.edge_areas[e].append(area_id)
        return e, fwd


def loop_to_directed_edges(
    ring_ll: list[tuple[float, float]],
    mesh: MeshBuilder,
    area_id: str,
) -> list[dict]:
    idxs = [mesh.point_index(p) for p in ring_ll]
    directed: list[dict] = []
    n = len(idxs)
    for i in range(n):
        a, b = idxs[i], idxs[(i + 1) % n]
        if a == b:
            continue
        e, _fwd = mesh.edge_index(a, b, area_id)
        lo, _hi = mesh.edges[e]
        directed.append({"e": e, "forward": a == lo})
    return directed


def build_topology(
    svg_path: Path,
    anchors_geo: dict,
    *,
    source_note: str,
) -> dict:
    provinces = parse_province_paths(svg_path)
    anchors = province_anchors(anchors_geo)
    # 北海道は新 SVG のみ（geo.provinces に無いことが多い）
    if any(pid == "北海道" for pid, _, _ in provinces) and "北海道" not in anchors:
        anchors["北海道"] = (142.5, 43.2)

    svg_pts: list[tuple[float, float]] = []
    ll_pts: list[tuple[float, float]] = []
    for pid, _fill, loops in provinces:
        if pid not in anchors:
            continue
        svg_pts.append(ring_centroid(loops[0]))
        ll_pts.append(anchors[pid])

    if len(svg_pts) < 8:
        raise RuntimeError("too few province anchors for affine fit")
    coef_lng, coef_lat = fit_affine(svg_pts, ll_pts)

    mesh = MeshBuilder()
    areas: list[dict] = []
    region_area_ids: dict[str, list[str]] = defaultdict(list)

    for pid, fill, loops in provinces:
        region_name = region_name_for(pid, fill)
        region_id = NAME_TO_REGION_ID.get(region_name, region_name)
        loops_out = []
        for ring in loops:
            ring_ll = [mesh.ll_from_svg(x, y, coef_lng, coef_lat) for x, y in ring]
            if len(ring_ll) < 3:
                continue
            loops_out.append({"edges": loop_to_directed_edges(ring_ll, mesh, pid)})
        if not loops_out:
            continue
        areas.append(
            {
                "id": pid,
                "regionId": region_id,
                "label": pid,
                "loops": loops_out,
            }
        )
        region_area_ids[region_id].append(pid)

    # 蝦夷（SVG に北海道等が無いときだけテンプレ輪郭を補う）
    if not region_area_ids.get("ezo"):
        ezo_ring = [
            (float(lng), float(lat))
            for lng, lat in (p.split(",") for p in EZO_LAND_LNG_LAT.split())
        ]
        ezo_loops = [{"edges": loop_to_directed_edges(ezo_ring, mesh, "蝦夷地")}]
        areas.append(
            {
                "id": "蝦夷地",
                "regionId": "ezo",
                "label": "蝦夷地",
                "loops": ezo_loops,
            }
        )
        region_area_ids["ezo"].append("蝦夷地")

    regions = []
    for rid, rname in REGION_ID_NAMES.items():
        aids = region_area_ids.get(rid, [])
        if not aids:
            continue
        regions.append(
            {
                "id": rid,
                "name": rname,
                "areaIds": sorted(set(aids)),
                "fill": REGION_COLORS.get(rname, "#e9dfc8"),
            }
        )

    return {
        "meta": {
            "version": 1,
            "source": str(svg_path.name),
            "snapEpsDeg": 0.01,
            "sourceNote": source_note,
        },
        "points": [[lng, lat] for lng, lat in mesh.points_ll],
        "edges": [list(e) for e in mesh.edges],
        "edgeAreas": {str(k): v for k, v in mesh.edge_areas.items()},
        "areas": areas,
        "regions": regions,
    }


def loop_points(topology: dict, area: dict, loop: dict) -> list[tuple[float, float]]:
    pts = topology["points"]
    edges = topology["edges"]

    def edge_endpoints(eid: int, forward: bool) -> tuple[int, int]:
        lo, hi = edges[eid]
        return (lo, hi) if forward else (hi, lo)

    out: list[tuple[float, float]] = []
    for spec in loop["edges"]:
        a, b = edge_endpoints(spec["e"], spec["forward"])
        if not out:
            out.append(tuple(pts[a]))
        out.append(tuple(pts[b]))
    return out


def project(lng: float, lat: float) -> tuple[float, float]:
    return project_lng_lat(lng, lat)


def build_render(topology: dict) -> dict:
    area_by_id = {a["id"]: a for a in topology["areas"]}
    region_by_id = {r["id"]: r for r in topology["regions"]}

    def edge_role(eid: int) -> str:
        aids = topology["edgeAreas"].get(str(eid), [])
        if len(aids) <= 1:
            return "coast"
        rids = {area_by_id[a]["regionId"] for a in aids if a in area_by_id}
        if len(rids) == 1:
            return "province-border"
        return "region-border"

    province_d: list[str] = []
    region_d: list[str] = []
    coast_d: list[str] = []
    edges = topology["edges"]
    pts = topology["points"]

    for eid, (lo, hi) in enumerate(edges):
        role = edge_role(eid)
        p0 = project(pts[lo][0], pts[lo][1])
        p1 = project(pts[hi][0], pts[hi][1])
        seg = f"M{p0[0]:.1f} {p0[1]:.1f}L{p1[0]:.1f} {p1[1]:.1f}"
        if role == "province-border":
            province_d.append(seg)
        elif role == "region-border":
            region_d.append(seg)
        else:
            coast_d.append(seg)

    land: list[str] = []
    region_fills: list[dict] = []
    labels: list[dict] = []
    region_acc: dict[str, list[tuple[float, float]]] = defaultdict(list)

    for area in topology["areas"]:
        region = region_by_id.get(area["regionId"])
        color = region["fill"] if region else "#e9dfc8"
        rname = region["name"] if region else area["regionId"]
        # 外輪 = 最初のループ
        ring = area["loops"][0]
        ll_pts = loop_points(topology, area, ring)
        map_pts = [project(lng, lat) for lng, lat in ll_pts]
        ring_str = " ".join(f"{x:.2f},{y:.2f}" for x, y in map_pts)
        region_fills.append(
            {"areaId": area["id"], "regionId": area["regionId"], "name": area["label"], "region": rname, "color": color, "points": ring_str}
        )
        land.append(" ".join(f"{lng:.2f},{lat:.2f}" for lng, lat in ll_pts))
        cx = sum(p[0] for p in map_pts) / len(map_pts)
        cy = sum(p[1] for p in map_pts) / len(map_pts)
        labels.append({"areaId": area["id"], "name": area["label"], "lng": ll_pts[0][0], "lat": ll_pts[0][1], "x": cx, "y": cy})
        region_acc[rname].append((cx, cy))

    region_labels = []
    for rname, cs in region_acc.items():
        region_labels.append(
            {
                "name": rname,
                "x": sum(c[0] for c in cs) / len(cs),
                "y": sum(c[1] for c in cs) / len(cs),
            }
        )

    return {
        "meta": {"topologyVersion": topology["meta"]["version"]},
        "land": land,
        "regionFills": region_fills,
        "provinceEdges": "".join(province_d),
        "regionEdges": "".join(region_d),
        "coastEdges": "".join(coast_d),
        "provinceLabels": [[lb["name"], lb["x"], lb["y"]] for lb in labels],
        "regionLabels": [[lb["name"], lb["x"], lb["y"]] for lb in region_labels],
    }


def write_bundle(data_dir: Path, topology: dict, render: dict, geo_legacy: dict) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "topology.json").write_text(json.dumps(topology, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (data_dir / "render.json").write_text(json.dumps(render, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    geo_out = {
        "land": render["land"],
        "provinces": geo_legacy.get("provinces", []),
        "sourceNote": topology["meta"]["sourceNote"],
    }
    (data_dir / "geo.json").write_text(json.dumps(geo_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
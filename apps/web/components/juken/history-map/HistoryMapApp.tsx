"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildFigureIndex } from "../../../lib/juken/history-map/figures";
import { landPolygons, project } from "../../../lib/juken/history-map/geo";
import { maskText, shuffleQuizFields, type QuizField } from "../../../lib/juken/history-map/quiz";
import { currentEvent, eraLabel, laneName, visibleEvents } from "../../../lib/juken/history-map/selectors";
import type { FigureIndex } from "../../../lib/juken/history-map/figures";
import type { HistoryAxis, HistoryEvent, HistoryMapBundle } from "../../../lib/juken/history-map/types";
import { EventDetailCard } from "./EventDetailCard";
import { FigureRichText } from "./FigureRichText";
import { axesForView, HistoryMapFilters, RegionLegend, type AxisView } from "./HistoryMapFilters";
import { QuizFieldValue } from "./QuizFieldValue";
import { QuizModal } from "./QuizModal";
import { QuizToggleButtons } from "./QuizToggleButtons";
import { YearScrubber } from "./YearScrubber";
import { MobileFilterPanel } from "./mobile/MobileFilterPanel";
import { MobileSheet } from "./mobile/MobileSheet";
import { MobileStatusBar } from "./mobile/MobileStatusBar";
import { MobileTabBar } from "./mobile/MobileTabBar";
import { MobileTopBar } from "./mobile/MobileTopBar";
import type { MobileTab, SheetSize } from "./mobile/types";
import "./history-map.css";

const MAP_FULL: [number, number, number, number] = [0, 0, 390, 405];

function sheetOverlap(svg: SVGSVGElement, size: SheetSize): number {
  if (size !== "h") return 0;
  const app = svg.closest(".history-map-app");
  const sheet = app?.querySelector(".hm-sheet");
  if (!app || !sheet) return 0;
  const shown = getComputedStyle(sheet);
  if (shown.display === "none" || shown.visibility === "hidden") return 0;
  const peek = parseFloat(getComputedStyle(app).getPropertyValue("--hm-sh-peek")) || 88;
  const half = Math.min(window.innerHeight * 0.44, 380);
  const mapH = svg.getBoundingClientRect().height;
  return Math.min(mapH, Math.max(0, half - peek));
}

/** Place (fx, fy) at the center of the map area that is not covered by the detail sheet. */
function placePoint(
  svg: SVGSVGElement | null,
  fx: number,
  fy: number,
  vw: number,
  vh: number,
  size: SheetSize,
): [number, number, number, number] {
  if (!svg) return [fx - vw / 2, fy - vh / 2, vw, vh];
  const r = svg.getBoundingClientRect();
  const k = Math.min(r.width / vw, r.height / vh);
  if (!Number.isFinite(k) || k <= 0 || r.width <= 0 || r.height <= 0) return [fx - vw / 2, fy - vh / 2, vw, vh];
  const ox = (r.width - vw * k) / 2;
  const oy = (r.height - vh * k) / 2;
  const vcx = r.width / 2;
  const vcy = (r.height - sheetOverlap(svg, size)) / 2;
  return [fx - (vcx - ox) / k, fy - (vcy - oy) / k, vw, vh];
}

type Props = { bundle: HistoryMapBundle };

export function HistoryMapApp({ bundle }: Props) {
  const { meta, events, wars, taxonomy, geo, boundaries, figures } = bundle;
  const landRings = useMemo(() => landPolygons(geo.land), [geo.land]);
  const figureIndex = useMemo(() => buildFigureIndex(figures), [figures]);

  const [year, setYear] = useState(meta.defaultYear);
  const [level, setLevel] = useState(2);
  const [axisView, setAxisView] = useState<AxisView>("a");
  const [selected, setSelected] = useState<HistoryEvent | null>(null);
  const [hiddenBubble, setHiddenBubble] = useState(false);
  const [viewBox, setViewBox] = useState<[number, number, number, number]>([...MAP_FULL]);
  const [manualMap, setManualMap] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [quizFields, setQuizFields] = useState<QuizField[]>(() => shuffleQuizFields(events.length));
  const [quizRevealed, setQuizRevealed] = useState<Set<number>>(() => new Set());
  const [quizModal, setQuizModal] = useState<{ index: number; mode: "q" | "a" } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("map");
  const [sheet, setSheet] = useState<SheetSize>("p");
  const [bubble, setBubble] = useState<{ left: number; top: number; width: number } | null>(null);
  const [leaderHtml, setLeaderHtml] = useState("");

  const mapRef = useRef<SVGSVGElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<HTMLElement>(null);
  const animRef = useRef(0);
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const pointersRef = useRef(new Map<number, [number, number]>());
  const pinchRef = useRef(0);
  const dragStartRef = useRef<[number, number] | null>(null);
  const gesturingRef = useRef(false);

  const axesOn = useMemo(() => axesForView(axisView), [axisView]);
  const visible = useMemo(() => visibleEvents(events, level, axesOn), [events, level, axesOn]);
  const current = useMemo(() => currentEvent(visible, year, selected), [visible, year, selected]);
  const scale = viewBox[2] / 390;

  const axisColor = useCallback((ax: HistoryAxis) => taxonomy.axes[ax][1], [taxonomy.axes]);

  const pick = useCallback((event: HistoryEvent) => {
    setSelected(event);
    setYear(event.year);
    setHiddenBubble(false);
    setManualMap(false);
    setMobileTab("map");
  }, []);

  const selectMobileTab = useCallback((next: MobileTab) => {
    setMobileTab((cur) => (next === cur && next !== "map" ? "map" : next));
  }, []);

  const eventIndex = useCallback((e: HistoryEvent) => events.indexOf(e), [events]);

  const openQuiz = useCallback((index: number, mode: "q" | "a") => {
    setQuizModal({ index, mode });
  }, []);

  const qText = useCallback(
    (e: HistoryEvent, text: string) => {
      const i = eventIndex(e);
      const field = quizFields[i] ?? "t";
      return maskText(e, text, quizMode, quizRevealed.has(i), field);
    },
    [eventIndex, quizFields, quizMode, quizRevealed],
  );

  const animateViewBox = useCallback((target: [number, number, number, number], durationMs: number) => {
    cancelAnimationFrame(animRef.current);
    const from = viewBoxRef.current.slice() as [number, number, number, number];
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.max(0, Math.min((now - t0) / durationMs, 1));
      const e = k < 0.5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2;
      const next: [number, number, number, number] = [
        from[0] + (target[0] - from[0]) * e,
        from[1] + (target[1] - from[1]) * e,
        from[2] + (target[2] - from[2]) * e,
        from[3] + (target[3] - from[3]) * e,
      ];
      viewBoxRef.current = next;
      setViewBox(next);
      if (k < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, []);

  const viewTargetFor = useCallback(
    (c: HistoryEvent | null, override?: [number, number, number, number]): [number, number, number, number] => {
      if (override) return override;
      let t: [number, number, number, number] = [...MAP_FULL];
      const w = c && c.axis === "w" ? wars[c.title] : undefined;
      if (w && c) {
        const pts = w.pp.map((p) => project(p[1], p[2]));
        const [cx, cy] = project(w.ar[0], w.ar[1]);
        const rx = w.ar[2] * 22;
        const ry = w.ar[3] * 26;
        pts.push(project(c.lng, c.lat), [cx - rx, cy - ry], [cx + rx, cy + ry]);
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        const wd = Math.max((x1 - x0) * 1.5, (y1 - y0) * 1.5 * (390 / 405), 10);
        const ht = (wd * 405) / 390;
        t = placePoint(mapRef.current, (x0 + x1) / 2, (y0 + y1) / 2, wd, ht, sheet);
      } else if (c) {
        const [x, y] = project(c.lng, c.lat);
        const wd = 160;
        const ht = (wd * 405) / 390;
        t = placePoint(mapRef.current, x, y, wd, ht, sheet);
      }
      return t;
    },
    [sheet, wars],
  );

  const focusKey = current ? `${current.year}-${current.title}` : "";
  const lastFocusRef = useRef<string | null>(null);
  const sheetWasRef = useRef(sheet);
  useEffect(() => {
    const prevSheet = sheetWasRef.current;
    const sheetChanged = prevSheet !== sheet;
    sheetWasRef.current = sheet;
    if (!current) return;
    const focusChanged = focusKey !== lastFocusRef.current;
    if (focusChanged) {
      lastFocusRef.current = focusKey;
      setManualMap(false);
    }
    if (manualMap && !focusChanged) {
      if (!sheetChanged) return;
      const svg = mapRef.current;
      const vb = viewBoxRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const k = Math.min(r.width / vb[2], r.height / vb[3]);
      if (!Number.isFinite(k) || k <= 0) return;
      const ox = (r.width - vb[2] * k) / 2;
      const oy = (r.height - vb[3] * k) / 2;
      const prevVcy = (r.height - sheetOverlap(svg, prevSheet)) / 2;
      const fx = vb[0] + (r.width / 2 - ox) / k;
      const fy = vb[1] + (prevVcy - oy) / k;
      animateViewBox(placePoint(svg, fx, fy, vb[2], vb[3], sheet), 250);
      return;
    }
    if (manualMap) return;
    const target = viewTargetFor(current);
    const vb = viewBoxRef.current;
    if (sheetChanged) {
      animateViewBox(target, 250);
      return;
    }
    const far =
      Math.hypot(vb[0] + vb[2] / 2 - target[0] - target[2] / 2, vb[1] + vb[3] / 2 - target[1] - target[3] / 2) >
      0.4 * Math.max(vb[2], target[2]);
    if (vb[2] < 385 && target[2] < 385 && far) {
      animateViewBox(MAP_FULL, 400);
      const t = window.setTimeout(() => animateViewBox(target, 800), 450);
      return () => window.clearTimeout(t);
    }
    animateViewBox(target, target[2] < vb[2] ? 900 : 450);
    return undefined;
  }, [focusKey, manualMap, animateViewBox, viewTargetFor, current, sheet]);

  const regionLegend = useMemo(() => {
    const seen = new Set<string>();
    const items: { name: string; color: string }[] = [];
    boundaries.regionFills.forEach((cell) => {
      if (seen.has(cell.region)) return;
      seen.add(cell.region);
      items.push({ name: cell.region, color: cell.color });
    });
    return items;
  }, [boundaries.regionFills]);

  const mapSvgInner = useMemo(() => {
    const k = 390 / viewBox[2] >= 1.8;
    let s = `<clipPath id="hm-lc">${landRings.map((p) => `<polygon points="${p}"/>`).join("")}</clipPath>`;
    s += `<g clip-path="url(#hm-lc)">`;
  boundaries.regionFills.forEach((cell) => {
      s += `<polygon class="hm-region" points="${cell.points}" style="fill:${cell.color};fill-opacity:0.92"/>`;
    });
    if (k)
      s += `<path d="${boundaries.provinceEdges}" fill="none" stroke="var(--hm-mut)" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" vector-effect="non-scaling-stroke"/>`;
    s += `<path d="${boundaries.regionEdges}" fill="none" stroke="var(--hm-mut)" stroke-width="${k ? 2 : 1.5}" stroke-dasharray="7 3" opacity="0.8" vector-effect="non-scaling-stroke"/></g>`;
    s += landRings
      .map((p) => `<polygon class="hm-coast" vector-effect="non-scaling-stroke" points="${p}"/>`)
      .join("");
    const labels = k ? boundaries.provinceLabels : boundaries.regionLabels;
    s += labels
      .map(
        (a) =>
          `<text x="${a[1]}" y="${a[2]}" style="font-size:${(k ? 12 : 15) * scale}px;stroke-width:${3 * scale}px;opacity:0.4;fill:var(--hm-mut)">${a[0]}</text>`,
      )
      .join("");

    if (current) {
      const war = current.axis === "w" ? wars[current.title] : undefined;
      if (war) {
        const [x, y] = project(war.ar[0], war.ar[1]);
        s += `<ellipse cx="${x}" cy="${y}" rx="${war.ar[2] * 22}" ry="${war.ar[3] * 26}" fill="#c23b3b" fill-opacity="0.18" stroke="#c23b3b" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`;
      }
    }

    const dot = (e: HistoryEvent, big: boolean, idx: number) => {
      const [x, y] = project(e.lng, e.lat);
      const col = axisColor(e.axis);
      return `<circle data-idx="${idx}" cx="${x}" cy="${y}" r="${(big ? 9 : 6) * scale}" vector-effect="non-scaling-stroke" fill="${col}" opacity="${big ? 1 : 0.5}" stroke="${big ? "var(--hm-fg)" : "none"}" stroke-width="2"/>`;
    };

    visible
      .filter((e) => e.year <= year && e !== current)
      .forEach((e) => {
        s += dot(e, false, eventIndex(e));
      });

    if (current) {
      const war = current.axis === "w" ? wars[current.title] : undefined;
      if (war) {
        war.pp.forEach((p) => {
          const [px, py] = project(p[1], p[2]);
          const col = p[3] ? "#2f6fb5" : "#c23b3b";
          s += `<rect x="${px - 6 * scale}" y="${py - 6 * scale}" width="${12 * scale}" height="${12 * scale}" fill="${col}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" transform="rotate(45 ${px} ${py})"/>`;
          s += `<text x="${px + p[4] * 10 * scale}" y="${py + (p[4] ? 4 : -12) * scale}" style="font-size:${11 * scale}px;stroke-width:${3 * scale}px;text-anchor:${["end", "middle", "start"][p[4] + 1]}">${qText(current, p[0])}</text>`;
        });
      }
      s += dot(current, true, eventIndex(current));
      const [x, y] = project(current.lng, current.lat);
      s += `<text x="${Math.min(Math.max(x, viewBox[0] + 50 * scale), viewBox[0] + viewBox[2] - 50 * scale)}" y="${y + (war ? 20 : -14) * scale}" style="font-size:${11 * scale}px;stroke-width:${3 * scale}px">${qText(current, current.place)}</text>`;
    }
    return s;
  }, [axisColor, boundaries, current, eventIndex, landRings, qText, scale, viewBox, visible, wars, year]);

  useEffect(() => {
    const svg = mapRef.current;
    if (!svg) return;
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as SVGElement;
      const idx = t.getAttribute("data-idx");
      if (idx != null) pick(events[Number(idx)]!);
    };
    svg.addEventListener("click", onClick);
    return () => svg.removeEventListener("click", onClick);
  }, [events, pick]);

  const placeBubble = useCallback(() => {
    if (!current || hiddenBubble || !mapRef.current || !mapWrapRef.current || !bubbleRef.current) {
      setBubble(null);
      setLeaderHtml("");
      return;
    }
    const rect = mapRef.current.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const k = Math.min(W / viewBox[2], H / viewBox[3]);
    const px = (x: number, y: number) => [
      (W - viewBox[2] * k) / 2 + (x - viewBox[0]) * k,
      (H - viewBox[3] * k) / 2 + (y - viewBox[1]) * k,
    ];
    const [ex, ey] = px(...project(current.lng, current.lat));
    const pts = visible.filter((e) => e.year <= year).map((e) => px(...project(e.lng, e.lat)));
    const war = current.axis === "w" ? wars[current.title] : undefined;
    if (war) war.pp.forEach((p) => pts.push(px(...project(p[1], p[2]))));
    const bw = Math.min(230, W - 8);
    const bh = 100;
    const candidates: [number, number][] = [
      [W - bw - 6, 6],
      [6, 6],
      [W - bw - 6, H - bh - 6],
      [6, H - bh - 6],
    ];
    let best = candidates[0]!;
    let bestCost = 1e9;
    candidates.forEach((q) => {
      let cost = 0;
      pts.forEach((p) => {
        if (p[0] > q[0] - 10 && p[0] < q[0] + bw + 10 && p[1] > q[1] - 10 && p[1] < q[1] + bh + 10) cost += 100;
      });
      if (ex > q[0] - 14 && ex < q[0] + bw + 14 && ey > q[1] - 14 && ey < q[1] + bh + 14) cost += 10000;
      if (cost < bestCost) {
        bestCost = cost;
        best = q;
      }
    });
    setBubble({ left: best[0], top: best[1], width: bw });
    const col = axisColor(current.axis);
    setLeaderHtml(
      `<line x1="${best[0] + bw / 2}" y1="${best[1] + bh / 2}" x2="${ex}" y2="${ey}" stroke="${col}" stroke-width="2" stroke-dasharray="4 3"/><circle cx="${ex}" cy="${ey}" r="12" fill="none" stroke="${col}" stroke-width="2"/>`,
    );
  }, [axisColor, current, hiddenBubble, viewBox, visible, wars, year]);

  useEffect(() => {
    placeBubble();
  }, [placeBubble, mapSvgInner]);

  const stepYear = (delta: number) => {
    const c = current;
    let i = c ? visible.indexOf(c) + delta : delta > 0 ? 0 : -1;
    const next = visible[i];
    if (next) pick(next);
  };

  const setViewClamped = (x: number, y: number, w: number) => {
    w = Math.max(8, Math.min(w, 390));
    const h = (w * 405) / 390;
    const next: [number, number, number, number] = [
      Math.max(-w, Math.min(390, x)),
      Math.max(-h, Math.min(405, y)),
      w,
      h,
    ];
    viewBoxRef.current = next;
    setViewBox(next);
  };

  const mapGeo = () => {
    const vb = viewBoxRef.current;
    const r = mapRef.current!.getBoundingClientRect();
    const k = Math.min(r.width / vb[2], r.height / vb[3]);
    return { r, k, ox: (r.width - vb[2] * k) / 2, oy: (r.height - vb[3] * k) / 2, vb };
  };

  const zoomAt = (factor: number, sx: number, sy: number) => {
    cancelAnimationFrame(animRef.current);
    animRef.current = 0;
    setManualMap(true);
    const g = mapGeo();
    if (!Number.isFinite(g.k) || g.k <= 0) return;
    const ux = g.vb[0] + (sx - g.r.left - g.ox) / g.k;
    const uy = g.vb[1] + (sy - g.r.top - g.oy) / g.k;
    const nw = Math.max(8, Math.min(g.vb[2] / factor, 390));
    const q = nw / g.vb[2];
    setViewClamped(ux - (ux - g.vb[0]) * q, uy - (uy - g.vb[1]) * q, nw);
  };
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const endPointer = (id: number) => {
      pointersRef.current.delete(id);
      if (pointersRef.current.size < 2) pinchRef.current = 0;
      if (!pointersRef.current.size) {
        gesturingRef.current = false;
        dragStartRef.current = null;
      }
    };
    const onDown = (e: PointerEvent) => {
      // A primary contact starts a new gesture. Extra touches (a pinch) are not
      // primary, so they keep the finger already down. Clearing here drops a
      // contact whose pointerup was lost, which otherwise turns the next drag
      // into a pinch.
      if (e.isPrimary) {
        pointersRef.current.clear();
        pinchRef.current = 0;
        gesturingRef.current = false;
      }
      pointersRef.current.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointersRef.current.size === 1) {
        dragStartRef.current = [e.clientX, e.clientY];
        return;
      }
      setManualMap(true);
      gesturingRef.current = true;
      pinchRef.current = 0;
      try {
        m.setPointerCapture(e.pointerId);
      } catch {
        // The pointer is already gone; the matching up/cancel will clear it.
      }
    };
    const onMove = (e: PointerEvent) => {
      const o = pointersRef.current.get(e.pointerId);
      if (!o) return;
      pointersRef.current.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointersRef.current.size > 1) {
        const vals = [...pointersRef.current.values()];
        const d = Math.hypot(vals[0]![0] - vals[1]![0], vals[0]![1] - vals[1]![1]);
        if (pinchRef.current) {
          zoomAtRef.current(d / pinchRef.current, (vals[0]![0] + vals[1]![0]) / 2, (vals[0]![1] + vals[1]![1]) / 2);
        }
        pinchRef.current = d;
        return;
      }
      if (!gesturingRef.current) {
        const start = dragStartRef.current;
        if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 6) return;
        setManualMap(true);
        gesturingRef.current = true;
        try {
          m.setPointerCapture(e.pointerId);
        } catch {
          // Already released.
        }
      }
      cancelAnimationFrame(animRef.current);
      animRef.current = 0;
      const g = mapGeo();
      if (!Number.isFinite(g.k) || g.k <= 0) return;
      setViewClamped(g.vb[0] - (e.clientX - o[0]) / g.k, g.vb[1] - (e.clientY - o[1]) / g.k, g.vb[2]);
    };
    const onUp = (e: PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      endPointer(e.pointerId);
      if (m.hasPointerCapture(e.pointerId)) m.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setManualMap(true);
      zoomAtRef.current(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    m.addEventListener("pointerdown", onDown);
    m.addEventListener("pointermove", onMove);
    m.addEventListener("pointerup", onUp);
    m.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    m.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      m.removeEventListener("pointerdown", onDown);
      m.removeEventListener("pointermove", onMove);
      m.removeEventListener("pointerup", onUp);
      m.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      m.removeEventListener("wheel", onWheel);
    };
  }, []);

  const shuffleQuiz = useCallback(() => {
    setQuizFields(shuffleQuizFields(events.length));
    setQuizRevealed(new Set());
  }, [events.length]);

  const toggleQuiz = () => {
    const next = !quizMode;
    setQuizMode(next);
    if (next) shuffleQuiz();
    setQuizModal(null);
  };

  const axisButtons: { id: AxisView; label: string; color: string }[] = [
    { id: "a", label: "すべて", color: "#555" },
    { id: "sw", label: "政治・戦い", color: "#2f6fb5" },
    ...(["r", "c", "e"] as const).map((k) => ({ id: k, label: taxonomy.axes[k][0], color: taxonomy.axes[k][1] })),
  ];

  const yearDisplay =
    quizMode && current && quizFields[eventIndex(current)] === "y" && !quizRevealed.has(eventIndex(current))
      ? "????年"
      : `${year}年`;

  const timeline = useMemo(() => {
    const eras = [...new Set(visible.map((e) => eraLabel(e.year)))];
    return eras.map((eraName) => {
      const eraEvents = visible.filter((e) => eraLabel(e.year) === eraName);
      if (axisView === "a") {
        return (
          <div key={eraName}>
            <div className="hm-era-h">{eraName}</div>
            <div className="hm-col">
              {eraEvents.map((e) => (
                <TimelineItem
                  key={e.title + e.year}
                  event={e}
                  eventIndex={eventIndex(e)}
                  current={current}
                  year={year}
                  compact={false}
                  axisColor={axisColor}
                  onPick={pick}
                  qt={qText}
                  quizMode={quizMode}
                  quizFields={quizFields}
                  quizRevealed={quizRevealed}
                  onOpenQuiz={openQuiz}
                  figureIndex={figureIndex}
                />
              ))}
            </div>
          </div>
        );
      }
      const lanes = [...new Set(eraEvents.map((e) => laneName(e, taxonomy.laneByTitle)))].sort(
        (a, b) => (taxonomy.laneOrder[axisView === "sw" ? "sw" : axisView]?.indexOf(a) ?? 99) - (taxonomy.laneOrder[axisView === "sw" ? "sw" : axisView]?.indexOf(b) ?? 99),
      );
      let row = 2;
      return (
        <div key={eraName}>
          <div className="hm-era-h">{eraName}</div>
          <div className="hm-lane-grid" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
            {lanes.map((lane, i) => (
              <div key={lane} className="hm-lane-h" style={{ gridColumn: i + 1 }}>
                {lane}
              </div>
            ))}
            {eraEvents.map((e) => {
              const col = lanes.indexOf(laneName(e, taxonomy.laneByTitle)) + 1;
              const items = [
                <TimelineItem
                  key={e.title + e.year}
                  event={e}
                  eventIndex={eventIndex(e)}
                  current={current}
                  year={year}
                  compact
                  axisColor={axisColor}
                  onPick={pick}
                  qt={qText}
                  quizMode={quizMode}
                  quizFields={quizFields}
                  quizRevealed={quizRevealed}
                  onOpenQuiz={openQuiz}
                  figureIndex={figureIndex}
                  style={{ gridColumn: col, gridRow: row }}
                />,
              ];
              row++;
              if (e === current) {
                items.push(
                  <div key={`${e.title}-detail`} className="hm-dt" style={{ gridColumn: col, gridRow: row }}>
                    <FigureRichText text={qText(e, e.body)} index={figureIndex} />
                    <div className="hm-sm">
                      📍{qText(e, e.place)}　👤
                      <QuizFieldValue
                        event={e}
                        eventIndex={eventIndex(e)}
                        field="who"
                        quizMode={quizMode}
                        quizField={quizFields[eventIndex(e)] ?? "t"}
                        quizRevealed={quizRevealed.has(eventIndex(e))}
                        onOpenQuiz={openQuiz}
                        figureIndex={figureIndex}
                      />
                    </div>
                  </div>,
                );
                row++;
              }
              return items;
            })}
          </div>
        </div>
      );
    });
  }, [axisColor, axisView, current, eventIndex, figureIndex, openQuiz, pick, qText, quizFields, quizMode, quizRevealed, taxonomy, visible, year]);

  useEffect(() => {
    if (mobileTab !== "t") return;
    const root = tlRef.current;
    if (!root) return;
    const sel = root.querySelector<HTMLElement>(".hm-it.sel");
    if (!sel) return;
    const top = sel.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTop = Math.max(0, top - 70);
  }, [mobileTab, current, timeline]);

  const onYearChange = (next: number) => {
    setYear(next);
    setSelected(null);
  };

  const onLevel = (next: number) => {
    setLevel(next);
    setSelected(null);
  };

  const onAxis = (next: AxisView) => {
    setAxisView(next);
    setSelected(null);
  };

  const detailProps = {
    current,
    axisColor,
    qText,
    wars,
    taxonomy,
    quizMode,
    quizFields,
    quizRevealed,
    eventIndex,
    onOpenQuiz: openQuiz,
    figureIndex,
  };

  return (
    <div className="history-map-app" data-tab={mobileTab} data-sh={sheet}>
      <MobileTopBar title={meta.title} quizMode={quizMode} onToggleQuiz={toggleQuiz} onShuffleQuiz={shuffleQuiz} />
      <div className="hm-desktop-head">
        <div className="hm-row">
          <h1 style={{ flex: 1 }}>
            🗾 {meta.title}
            {meta.subtitle ? `（${meta.subtitle}）` : ""}
          </h1>
          <QuizToggleButtons quizMode={quizMode} onToggle={toggleQuiz} onShuffle={shuffleQuiz} />
        </div>
        <div className="hm-era">{eraLabel(year)}</div>
      </div>
      <div className="hm-wrap">
        <div>
          <div className="hm-mapw" ref={mapWrapRef}>
            <svg
              ref={mapRef}
              className="hm-map"
              viewBox={viewBox.join(" ")}
              dangerouslySetInnerHTML={{ __html: mapSvgInner }}
            />
            <svg className="hm-ldr" viewBox={`0 0 ${mapWrapRef.current?.clientWidth ?? 400} ${mapWrapRef.current?.clientHeight ?? 300}`} dangerouslySetInnerHTML={{ __html: leaderHtml }} />
            <div className="hm-zb">
              <button type="button" className="hm-btn" onClick={() => zoomAt(1.6, mapRef.current!.getBoundingClientRect().left + mapRef.current!.clientWidth / 2, mapRef.current!.getBoundingClientRect().top + mapRef.current!.clientHeight / 2)}>
                ＋
              </button>
              <button type="button" className="hm-btn" onClick={() => zoomAt(1 / 1.6, mapRef.current!.getBoundingClientRect().left + mapRef.current!.clientWidth / 2, mapRef.current!.getBoundingClientRect().top + mapRef.current!.clientHeight / 2)}>
                －
              </button>
              <button
                type="button"
                className="hm-btn"
                onClick={() => {
                  setManualMap(true);
                  animateViewBox(MAP_FULL, 500);
                }}
              >
                ⌂
              </button>
            </div>
            <div
              ref={bubbleRef}
              className={`hm-bub${bubble && current && !hiddenBubble ? " open" : ""}`}
              style={bubble ? { width: bubble.width, left: bubble.left, top: bubble.top } : undefined}
            >
              {current ? (
                <>
                  <button type="button" className="hm-bub-x" onClick={() => setHiddenBubble(true)}>
                    ×
                  </button>
                  <b>
                    <QuizFieldValue
                      event={current}
                      eventIndex={eventIndex(current)}
                      field="y"
                      quizMode={quizMode}
                      quizField={quizFields[eventIndex(current)] ?? "t"}
                      quizRevealed={quizRevealed.has(eventIndex(current))}
                      onOpenQuiz={openQuiz}
                    />{" "}
                    <QuizFieldValue
                      event={current}
                      eventIndex={eventIndex(current)}
                      field="t"
                      quizMode={quizMode}
                      quizField={quizFields[eventIndex(current)] ?? "t"}
                      quizRevealed={quizRevealed.has(eventIndex(current))}
                      onOpenQuiz={openQuiz}
                    />
                  </b>
                  <div className="hm-mut">
                    <QuizFieldValue
                      event={current}
                      eventIndex={eventIndex(current)}
                      field="who"
                      quizMode={quizMode}
                      quizField={quizFields[eventIndex(current)] ?? "t"}
                      quizRevealed={quizRevealed.has(eventIndex(current))}
                      onOpenQuiz={openQuiz}
                      figureIndex={figureIndex}
                    />
                  </div>
                  <div>
                    <FigureRichText text={qText(current, current.body)} index={figureIndex} />
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div className="hm-desktop-controls">
            <YearScrubber
              year={year}
              yearDisplay={yearDisplay}
              min={meta.yearMin}
              max={meta.yearMax}
              onStep={stepYear}
              onChange={onYearChange}
            />
            <HistoryMapFilters
              level={level}
              levelLabels={taxonomy.levelLabels}
              onLevel={onLevel}
              axisButtons={axisButtons}
              axisView={axisView}
              onAxis={onAxis}
            />
            <RegionLegend items={regionLegend} />
            <EventDetailCard {...detailProps} />
          </div>
          <MobileStatusBar era={eraLabel(year)}>
            <YearScrubber
              className="hm-row hm-srow"
              year={year}
              yearDisplay={yearDisplay}
              min={meta.yearMin}
              max={meta.yearMax}
              onStep={stepYear}
              onChange={onYearChange}
            />
          </MobileStatusBar>
          <MobileSheet sheet={sheet} onSheet={setSheet}>
            <EventDetailCard {...detailProps} />
            <HistoryMapCredits figureCount={Object.keys(figures).length} />
          </MobileSheet>
          <MobileFilterPanel>
            <HistoryMapFilters
              level={level}
              levelLabels={taxonomy.levelLabels}
              onLevel={onLevel}
              axisButtons={axisButtons}
              axisView={axisView}
              onAxis={onAxis}
            />
            <RegionLegend items={regionLegend} />
          </MobileFilterPanel>
        </div>
        <aside className="hm-tl" ref={tlRef}>
          {timeline.length ? timeline : <div className="hm-mut">この条件の出来事はありません。</div>}
        </aside>
      </div>
      <MobileTabBar tab={mobileTab} onTab={selectMobileTab} />
      <QuizModal
        modal={quizModal}
        events={events}
        quizFields={quizFields}
        quizRevealed={quizRevealed}
        onClose={() => setQuizModal(null)}
        onReveal={(i) => setQuizRevealed((prev) => new Set(prev).add(i))}
        qText={qText}
      />
      <div className="hm-desktop-credits">
        <HistoryMapCredits figureCount={Object.keys(figures).length} />
      </div>
    </div>
  );
}

function HistoryMapCredits({ figureCount }: { figureCount: number }) {
  if (figureCount === 0) return null;
  return (
    <p className="hm-credits hm-mut">人物肖像: Wikimedia Commons（各ポップアップにライセンス表示）</p>
  );
}

function TimelineItem(props: {
  event: HistoryEvent;
  eventIndex: number;
  current: HistoryEvent | null;
  year: number;
  compact: boolean;
  axisColor: (ax: HistoryAxis) => string;
  onPick: (e: HistoryEvent) => void;
  qt: (e: HistoryEvent, t: string) => string;
  quizMode: boolean;
  quizFields: QuizField[];
  quizRevealed: Set<number>;
  onOpenQuiz: (index: number, mode: "q" | "a") => void;
  figureIndex: FigureIndex;
  style?: CSSProperties;
}) {
  const {
    event: e,
    eventIndex: idx,
    current,
    year,
    compact,
    axisColor,
    onPick,
    qt,
    quizMode,
    quizFields,
    quizRevealed,
    onOpenQuiz,
    figureIndex,
    style,
  } = props;
  const col = axisColor(e.axis);
  const axLabel = e.axis === "s" || e.axis === "w" ? (e.axis === "s" ? "政治" : "戦い") : undefined;
  const quizField = quizFields[idx] ?? "t";
  const revealed = quizRevealed.has(idx);
  return (
    <button
      type="button"
      className={`hm-it${e === current ? " sel" : ""}${e.year > year ? " fut" : ""}`}
      style={{ borderColor: col, ...style }}
      onClick={() => onPick(e)}
    >
      <b>
        <QuizFieldValue
          event={e}
          eventIndex={idx}
          field="y"
          quizMode={quizMode}
          quizField={quizField}
          quizRevealed={revealed}
          onOpenQuiz={onOpenQuiz}
        />
      </b>{" "}
      <QuizFieldValue
        event={e}
        eventIndex={idx}
        field="t"
        quizMode={quizMode}
        quizField={quizField}
        quizRevealed={revealed}
        onOpenQuiz={onOpenQuiz}
      />
      <span className="hm-tg" style={{ background: col }}>
        {axLabel ?? taxonomyLabelFallback(e.axis)}
      </span>
      {compact ? (
        <div className="hm-sm">📍{qt(e, e.place)}</div>
      ) : (
        <>
          <div>
            <FigureRichText text={qt(e, e.body)} index={figureIndex} />
          </div>
          <div className="hm-sm">
            📍{qt(e, e.place)}　👤
            <QuizFieldValue
              event={e}
              eventIndex={idx}
              field="who"
              quizMode={quizMode}
              quizField={quizField}
              quizRevealed={revealed}
              onOpenQuiz={onOpenQuiz}
              figureIndex={figureIndex}
            />
          </div>
        </>
      )}
    </button>
  );
}

function taxonomyLabelFallback(ax: HistoryAxis): string {
  const map: Record<HistoryAxis, string> = { s: "政治", w: "戦い", r: "宗教", c: "文化", e: "社会" };
  return map[ax];
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBoard, getEpisode, getSubscription } from "./api.ts";
import { DetailTop, LowerDock } from "./Detail.tsx";
import { EpisodeList } from "./EpisodeList.tsx";
import { Split } from "./Splitter.tsx";
import { SubscriptionView } from "./Subscription.tsx";
import type { BoardResponse, EpisodeDetail, SubscriptionResponse } from "../shared/types.ts";
import { formatJst } from "../shared/time.ts";

type ViewId = "board" | "attention" | "subscription";
type FilterId = "all" | "active" | "failed" | "published";

export function App() {
  const [view, setView] = useState<ViewId>("board");
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [age, setAge] = useState("—");
  const [lowerFolded, setLowerFolded] = useState(() => localStorage.getItem("ops-lower-collapsed") === "1");

  const reload = useCallback(async () => {
    const next = await getBoard();
    setBoard(next);
    setError(null);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const tick = async () => {
      try {
        const next = await getBoard();
        if (cancelled) return;
        setBoard(next);
        setError(null);
        const delay = next.episodes.some((episode) => episode.active) ? 3000 : 15000;
        timer = window.setTimeout(() => void tick(), delay);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the local database.");
        timer = window.setTimeout(() => void tick(), 5000);
      }
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!board) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.round((Date.now() - new Date(board.fetchedAt).getTime()) / 1000));
      setAge(seconds < 60 ? `${seconds}s ago` : formatJst(board.fetchedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [board]);

  useEffect(() => {
    if (view !== "subscription") return;
    let cancelled = false;
    const load = () => {
      getSubscription()
        .then((data) => { if (!cancelled) setSubscription(data); })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the subscription.");
        });
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [view]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    const load = () => {
      getEpisode(selectedId)
        .then((data) => { if (!cancelled) setDetail(data); })
        .catch(() => { if (!cancelled) setDetail({ attempts: [], events: [] }); });
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  const rows = useMemo(() => {
    const episodes = board?.episodes ?? [];
    const needle = query.trim().toLowerCase();
    return episodes.filter((episode) => {
      if (view === "attention" && !episode.attention) return false;
      if (view === "board") {
        if (filter === "active" && !episode.active) return false;
        if (filter === "failed" && !episode.attention) return false;
        if (filter === "published" && !episode.published) return false;
      }
      if (!needle) return true;
      return episode.title.toLowerCase().includes(needle)
        || (episode.path ?? "").toLowerCase().includes(needle)
        || episode.id.includes(needle)
        || episode.overviewStatus.includes(needle);
    });
  }, [board, view, filter, query]);

  const selected = rows.find((episode) => episode.id === selectedId)
    ?? board?.episodes.find((episode) => episode.id === selectedId)
    ?? null;
  const attentionCount = (board?.episodes.filter((episode) => episode.attention).length ?? 0)
    + (board?.subscription.stuck ? 1 : 0);

  return (
    <div className="app">
      <header className="header">
        <h1>Production console</h1>
        <nav className="nav">
          <button type="button" className={view === "board" ? "pill active" : "pill"} onClick={() => setView("board")}>Board</button>
          <button type="button" className={view === "attention" ? "pill active" : "pill"} onClick={() => setView("attention")}>
            Needs attention {attentionCount}
          </button>
          <button type="button" className={view === "subscription" ? "pill active" : "pill"} onClick={() => setView("subscription")}>Event subscription</button>
        </nav>
        <div className={`stat ${board && board.subscription.lag > 0 ? "warn" : ""}`}>
          <strong>{board?.subscription.lag ?? "—"}</strong>
          Unprocessed events
        </div>
        <div className="meta">{board?.projectRef ?? "remote"} · {window.location.host} · updated {age}</div>
        <button type="button" className="button" onClick={() => void reload().catch((err: unknown) => setError(err instanceof Error ? err.message : "Refresh failed."))}>Refresh</button>
      </header>
      {error ? <div className="banner danger"><p>{error}</p></div> : null}
      {view === "subscription" ? (
        <div className="workspace"><SubscriptionView data={subscription} failed={Boolean(error)} /></div>
      ) : (
        <div className="board-wrap">
          {view === "attention" && board?.subscription.stuck ? (
            <div className="banner danger">
              <h2>production-policy is stuck processing position {board.subscription.stuck.position}</h2>
              <p>
                {board.subscription.lag === 1
                  ? `The 1 event from ${board.subscription.processedPosition + 1} on will not become a job.`
                  : `The ${board.subscription.lag} events from ${board.subscription.processedPosition + 1} on will not become jobs.`}
                {" "}The lease has expired.
                {board.subscription.stuck.error ? ` ${board.subscription.stuck.error}` : ""}
              </p>
              <button type="button" className="button" onClick={() => setView("subscription")}>Open event subscription</button>
            </div>
          ) : null}
          {view === "board" ? (
            <div className="filters" style={{ padding: "10px 16px 0" }}>
              {([
                ["all", "All"],
                ["active", "In progress"],
                ["failed", "Failed and stalled"],
                ["published", "Published"],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" className={filter === id ? "pill active" : "pill"} onClick={() => setFilter(id)}>{label}</button>
              ))}
              <input className="search" value={query} placeholder="Title, path, or status" onChange={(event) => setQuery(event.target.value)} />
            </div>
          ) : null}
          <Split
            direction="row"
            storageKey="ops-main"
            initialRatio={0.58}
            minFirst={320}
            minSecond={340}
            first={<EpisodeList episodes={rows} selectedId={selected?.id ?? null} onSelect={setSelectedId} />}
            second={
              <Split
                direction="column"
                storageKey="ops-detail"
                initialRatio={0.48}
                minFirst={180}
                minSecond={160}
                collapsed={lowerFolded}
                first={<DetailTop key={selected?.id ?? "none"} episode={selected} onChanged={() => void reload()} />}
                second={
                  <LowerDock
                    folded={lowerFolded}
                    onToggle={() => {
                      setLowerFolded((value) => {
                        const next = !value;
                        localStorage.setItem("ops-lower-collapsed", next ? "1" : "0");
                        return next;
                      });
                    }}
                    selected={selected != null}
                    attempts={detail?.attempts ?? null}
                    events={detail?.events ?? null}
                  />
                }
              />
            }
          />
        </div>
      )}
    </div>
  );
}

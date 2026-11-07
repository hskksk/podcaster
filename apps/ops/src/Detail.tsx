import { useState } from "react";
import { mediaUrl, postProduction, postPublication } from "./api.ts";
import { StageMark } from "./EpisodeList.tsx";
import { Split } from "./Splitter.tsx";
import type { AttemptView, BoardEpisode, EpisodeDetail, EventView, ProductionScope } from "../shared/types.ts";
import { formatJst } from "../shared/time.ts";

type ActionId = "full" | "audio" | "artwork" | "publish";

const COPY: Record<ActionId, { title: string; body: string; confirm: string; scope?: ProductionScope }> = {
  full: {
    title: "Rebuild from the script",
    confirm: "Rebuild",
    scope: "full",
    body: "Append one ProductionRequested (scope=full, trigger=manual) and call domain-subscriber. In-progress jobs are not stopped. The published version stays until the new version is assembled and published.",
  },
  audio: {
    title: "Rebuild audio only",
    confirm: "Rebuild",
    scope: "audio",
    body: "Reuse the script from the latest assembled version and append one ProductionRequested (scope=audio). If that script cannot be read, no job is created and the result is ProductionFailed (stage=audio, failed_job_id=null). episode_overview.status becomes audio_failed.",
  },
  artwork: {
    title: "Rebuild artwork only",
    confirm: "Rebuild",
    scope: "artwork",
    body: "Reuse the script from the latest assembled version and append one ProductionRequested (scope=artwork). If that script cannot be read, the result is ProductionFailed with stage=artwork, and episode_overview.status becomes image_failed.",
  },
  publish: {
    title: "Publish the latest assembled version",
    confirm: "Publish",
    body: "Call publish once. No ProductionRequested is appended. This stays disabled when there is no assembled version.",
  },
};

export function DetailTop({
  episode,
  sources,
  onChanged,
}: {
  episode: BoardEpisode | null;
  sources: EpisodeDetail | null;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<ActionId | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!episode) return <p className="empty">Select an episode.</p>;
  const current = episode;
  const locked = !current.assembled;
  const pendingCopy = pending ? COPY[pending] : null;

  async function run(action: ActionId) {
    setBusy(true);
    setError(null);
    try {
      const copy = COPY[action];
      const result = copy.scope
        ? await postProduction(current.id, copy.scope)
        : null;
      if (!copy.scope) await postPublication(current.id);
      setPending(null);
      const wake = result && "wakeStatus" in result && result.wakeStatus >= 400
        ? ` domain-subscriber returned ${result.wakeStatus}.`
        : "";
      setSent(`${copy.title}.${wake}`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail">
      <div>
        <h2>{episode.title}</h2>
        <div className="path">{episode.path ?? episode.id}</div>
        <div className="sub">{episode.overviewStatus}</div>
      </div>
      {episode.failure ? (
        <div className="banner danger">
          <h2>ProductionFailed{episode.failure.stage ? ` · stage=${episode.failure.stage}` : " · no stage"}</h2>
          <p>
            {episode.failure.reason}
            {" "}
            {episode.failure.failedJobId ? `failed_job_id=${episode.failure.failedJobId}` : "failed_job_id=null"}
            {episode.failure.at ? ` · ${formatJst(episode.failure.at)}` : ""}
          </p>
        </div>
      ) : null}
      <div className="stages">
        <StageBlock name="Script" stage={episode.stages.script} />
        <StageBlock name="Audio" stage={episode.stages.audio} />
        <StageBlock name="Artwork" stage={episode.stages.artwork} />
        <StageBlock name="Publish" stage={episode.stages.publish} />
      </div>
      <div className="media">
        {episode.audioPath ? <audio controls src={mediaUrl(episode.audioPath)} /> : null}
        {episode.imagePath ? <img alt={episode.title} src={mediaUrl(episode.imagePath)} /> : null}
      </div>
      {pendingCopy ? (
        <div className="banner warn">
          <h2>{pendingCopy.title}</h2>
          <p>{pendingCopy.body}</p>
          <div className="actions">
            <button type="button" className="button primary" disabled={busy} onClick={() => void run(pending!)}>
              {pendingCopy.confirm}
            </button>
            <button type="button" className="button ghost" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="actions">
            <button type="button" className="button" onClick={() => { setSent(null); setPending("full"); }}>From script</button>
            <button type="button" className="button" disabled={locked} onClick={() => { setSent(null); setPending("audio"); }}>Audio only</button>
            <button type="button" className="button" disabled={locked} onClick={() => { setSent(null); setPending("artwork"); }}>Artwork only</button>
            <button type="button" className="button ghost" disabled={locked} onClick={() => { setSent(null); setPending("publish"); }}>Publish</button>
          </div>
          {locked ? (
            <p className="hint">Audio only, Artwork only, and Publish are available only when an assembled version exists. If the first production stopped midway, rebuild from the script.</p>
          ) : null}
        </div>
      )}
      {error ? <div className="banner danger"><p>{error}</p></div> : null}
      {sent ? <div className="banner info"><h2>Requested</h2><p>{sent}</p></div> : null}
      <SourceTabs article={sources?.article ?? null} script={sources?.script ?? null} loading={sources == null} />
    </div>
  );
}

function SourceTabs({
  article,
  script,
  loading,
}: {
  article: EpisodeDetail["article"];
  script: EpisodeDetail["script"];
  loading: boolean;
}) {
  const [tab, setTab] = useState<"article" | "script">("article");
  const current = tab === "article" ? article : script;
  return (
    <div className="source">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className={tab === "article" ? "tab active" : "tab"} aria-selected={tab === "article"} onClick={() => setTab("article")}>Article</button>
        <button type="button" role="tab" className={tab === "script" ? "tab active" : "tab"} aria-selected={tab === "script"} onClick={() => setTab("script")}>Script</button>
      </div>
      <div className="source-body" role="tabpanel">
        {loading ? <p className="hint">Loading…</p> : current ? (
          <>
            {current.title ? <p className="hint">{current.title}</p> : null}
            <pre>{current.body}</pre>
          </>
        ) : (
          <p className="hint">{tab === "article" ? "No article text for this episode." : "No script for this episode."}</p>
        )}
      </div>
    </div>
  );
}

function Disclosure({ open, title, onClick }: { open: boolean; title: string; onClick: () => void }) {
  return (
    <button type="button" className="disclosure" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${title}`} onClick={onClick}>
      <span className={open ? "chevron open" : "chevron"} aria-hidden="true" />
      <span>{title}</span>
    </button>
  );
}
function StageBlock({ name, stage }: { name: string; stage: BoardEpisode["stages"]["script"] }) {
  return (
    <div className="stage-block">
      <div className="name">{name}</div>
      <StageMark stage={stage} />
      {stage.detail ? <div className="detail-line">{stage.detail}</div> : null}
    </div>
  );
}

export function LowerDock({
  folded,
  onToggle,
  selected,
  attempts,
  events,
}: {
  folded: boolean;
  onToggle: () => void;
  selected: boolean;
  attempts: AttemptView[] | null;
  events: EventView[] | null;
}) {
  if (folded) {
    return (
      <div className="lower-bar">
        <Disclosure open={false} title="Jobs for this production" onClick={onToggle} />
        <Disclosure open={false} title="Events" onClick={onToggle} />
      </div>
    );
  }
  return (
    <Split
      direction="row"
      storageKey="ops-lower"
      initialRatio={0.5}
      minFirst={220}
      minSecond={220}
      first={<JobsPanel attempts={selected ? attempts : []} idle={!selected} onCollapse={onToggle} />}
      second={<EventsPanel events={selected ? events : []} idle={!selected} onCollapse={onToggle} />}
    />
  );
}

function SectionHead({ title, onCollapse }: { title: string; onCollapse: () => void }) {
  return <Disclosure open title={title} onClick={onCollapse} />;
}

export function JobsPanel({
  attempts,
  idle = false,
  onCollapse,
}: {
  attempts: AttemptView[] | null;
  idle?: boolean;
  onCollapse?: () => void;
}) {
  return (
    <section className="section">
      {onCollapse ? <SectionHead title="Jobs for this production" onCollapse={onCollapse} /> : <h3>Jobs for this production</h3>}
      {idle ? <p className="hint">Select an episode.</p> : attempts == null ? <p className="hint">Loading jobs…</p> : attempts.length === 0 ? (
        <p className="hint">The latest production has no job attempts yet.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Attempt</th>
                <th>Time</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((row, index) => (
                <tr key={`${row.jobType}-${row.attempt}-${index}`} className={rowClass(row.status)}>
                  <td>{row.jobType}</td>
                  <td>{row.status}</td>
                  <td>{row.attempt}</td>
                  <td>{formatJst(row.finishedAt ?? row.startedAt)}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Errors from retries stay on JobAttempt. ProductionFailed.reason is the last attempt's error, clipped to 2000 characters.</p>
        </>
      )}
    </section>
  );
}

export function EventsPanel({
  events,
  idle = false,
  onCollapse,
}: {
  events: EventView[] | null;
  idle?: boolean;
  onCollapse?: () => void;
}) {
  return (
    <section className="section">
      {onCollapse ? <SectionHead title="Events" onCollapse={onCollapse} /> : <h3>Events</h3>}
      {idle ? <p className="hint">Select an episode.</p> : events == null ? <p className="hint">Loading events…</p> : events.length === 0 ? <p className="hint">No events for this episode.</p> : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>actor</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {events.map((row) => (
              <tr key={row.position} className={row.type === "ProductionFailed" ? "danger" : undefined}>
                <td>{formatJst(row.at)}</td>
                <td>{row.type}</td>
                <td>{row.actor}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function rowClass(status: string): string | undefined {
  if (status === "failed" || status === "terminal") return "danger";
  if (status === "retryable" || status === "waiting_external" || status === "rate_limited") return "warn";
  if (status === "running" || status === "requested") return "info";
  return undefined;
}

import type { SubscriptionResponse } from "../shared/types.ts";
import { formatJst } from "../shared/time.ts";

export function SubscriptionView({ data, failed }: { data: SubscriptionResponse | null; failed?: boolean }) {
  if (!data) {
    return <p className="empty">{failed ? "Could not load the event subscription." : "Loading the event subscription…"}</p>;
  }
  return (
    <div className="section">
      <div className="stats">
        <div className="stat"><strong>{data.processedPosition}</strong>Processed position</div>
        <div className="stat"><strong>{data.latestPosition}</strong>Latest position</div>
        <div className={`stat ${data.lag > 0 ? "warn" : ""}`}><strong>{data.lag}</strong>Lag</div>
        <div className={`stat ${data.leaseExpired ? "danger" : ""}`}><strong>{data.leaseExpired ? "Expired" : "Held"}</strong>Lease</div>
      </div>
      {data.stuck ? (
        <div className="banner danger">
          <h2>Processing of {data.stuck.position} is still failed</h2>
          <p>
            {data.stuck.error ?? "The subscriber did not record an error."}
            {" "}
            The processed position has not advanced. Events from that position on stay unprocessed.
          </p>
        </div>
      ) : null}
      <h3>Unprocessed events</h3>
      <p className="hint">production-policy · {data.pending.length} shown</p>
      {data.pending.length === 0 ? <p className="hint">The subscriber is caught up.</p> : (
        <table>
          <thead>
            <tr>
              <th>position</th>
              <th>Type</th>
              <th>Stream</th>
              <th>actor</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {data.pending.map((row, index) => (
              <tr key={row.position} className={index === 0 && data.stuck ? "danger" : "warn"}>
                <td>{row.position}</td>
                <td>{row.type}</td>
                <td>{row.streamType}</td>
                <td>{row.actor}</td>
                <td>{formatJst(row.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Subscription failure log</h3>
      {data.failures.length === 0 ? <p className="hint">No subscription failures are recorded.</p> : (
        <table>
          <thead>
            <tr>
              <th>position</th>
              <th>subscriber</th>
              <th>failed_at</th>
              <th>error</th>
            </tr>
          </thead>
          <tbody>
            {data.failures.map((row) => (
              <tr key={`${row.position}-${row.failedAt}`} className={row.position > data.processedPosition ? "danger" : undefined}>
                <td>{row.position}</td>
                <td>production-policy</td>
                <td>{formatJst(row.failedAt)}</td>
                <td>{row.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">A failure record remains after a later success. Needs attention includes only records whose event_position is greater than last_processed_position. This screen does not advance the processed position.</p>
    </div>
  );
}

/** postgres.js over the session pooler may return jsonb columns as strings. */
export function parseDomainEventPayload<T = Record<string, unknown>>(
  payload: unknown,
): T {
  if (typeof payload === "string") {
    return JSON.parse(payload) as T;
  }
  if (payload !== null && typeof payload === "object") {
    return payload as T;
  }
  return {} as T;
}

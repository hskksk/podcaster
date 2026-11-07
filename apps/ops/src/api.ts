import type {
  BoardResponse,
  EpisodeDetail,
  ProductionScope,
  SubscriptionResponse,
} from "../shared/types.ts";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as { error?: string } : {};
  if (!response.ok) throw new ApiError(body.error ?? response.statusText);
  return body as T;
}

export function getBoard(): Promise<BoardResponse> {
  return request("/api/board");
}

export function getEpisode(id: string): Promise<EpisodeDetail> {
  return request(`/api/episodes/${encodeURIComponent(id)}`);
}

export function getSubscription(): Promise<SubscriptionResponse> {
  return request("/api/subscription");
}

export function postProduction(episodeId: string, scope: ProductionScope): Promise<{ productionId: string; wakeStatus: number }> {
  return request("/api/productions", {
    method: "POST",
    body: JSON.stringify({ episodeId, scope }),
  });
}

export function postPublication(episodeId: string): Promise<{ body: string }> {
  return request("/api/publications", {
    method: "POST",
    body: JSON.stringify({ episodeId }),
  });
}

export function mediaUrl(path: string): string {
  return `/api/media?path=${encodeURIComponent(path)}`;
}

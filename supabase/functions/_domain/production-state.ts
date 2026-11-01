import type { DomainEvent, ProductionRequestedPayload } from "./events.ts";

/** In-memory production progress for tests and pure replay. */
export interface ProductionProgress {
  productionId: string;
  episodeId: string;
  scope: ProductionRequestedPayload["scope"];
  artworkRequired: boolean;
  scriptId: string | null;
  audioId: string | null;
  artworkId: string | null;
  assembledRevisionId: string | null;
  failed: boolean;
}

export function emptyProductionProgress(
  payload: ProductionRequestedPayload,
  artworkRequired: boolean,
): ProductionProgress {
  return {
    productionId: payload.production_id,
    episodeId: payload.episode_id,
    scope: payload.scope,
    artworkRequired,
    scriptId: null,
    audioId: null,
    artworkId: null,
    assembledRevisionId: null,
    failed: false,
  };
}

export function applyProductionEvent(
  state: ProductionProgress,
  event: DomainEvent,
): ProductionProgress {
  if (event.type === "ScriptWritten" && event.correlation_id === state.productionId) {
    return { ...state, scriptId: event.payload.script_id };
  }
  if (event.type === "AudioRendered" && event.correlation_id === state.productionId) {
    return { ...state, audioId: event.payload.audio_id };
  }
  if (event.type === "ArtworkPainted" && event.correlation_id === state.productionId) {
    return { ...state, artworkId: event.payload.artwork_id };
  }
  if (event.type === "EpisodeAssembled" && event.correlation_id === state.productionId) {
    return { ...state, assembledRevisionId: event.payload.episode_revision_id };
  }
  if (event.type === "ProductionFailed" && event.payload.production_id === state.productionId) {
    return { ...state, failed: true };
  }
  return state;
}

export function canAssemble(state: ProductionProgress): boolean {
  if (!state.scriptId || !state.audioId) return false;
  if (state.artworkRequired && !state.artworkId) return false;
  return state.assembledRevisionId === null;
}

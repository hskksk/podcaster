import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { JobRow } from "../../_jobs/types.ts";
import type { PodcastConfigMap } from "../types.ts";
import { deliveryMimeType } from "./config.ts";
import { deleteBlobById, registerDeliveryBlob } from "../../_adapters/storage.ts";
import { resolveObjectByteSize } from "./signed-urls.ts";

export interface FinalizeTranscodeParams {
  db: SupabaseClient;
  job: JobRow;
  attemptId: string;
  cfg: PodcastConfigMap;
  transcode: Record<string, unknown>;
}

export async function loadEpisodeIdForJob(
  db: SupabaseClient,
  job: JobRow,
): Promise<string> {
  const productionId = job.correlation_id;
  if (!productionId) throw new Error("render_audio: job missing correlation_id (production)");
  const { data, error } = await db
    .schema("podcast")
    .from("productions")
    .select("episode_id")
    .eq("id", productionId)
    .maybeSingle();
  if (error) throw new Error(`loadEpisodeIdForJob: ${error.message}`);
  const episodeId = data?.episode_id as string | undefined;
  if (!episodeId) throw new Error(`loadEpisodeIdForJob: no production for ${productionId}`);
  return episodeId;
}

export async function finalizeTranscodedAudioBlob(
  params: FinalizeTranscodeParams,
): Promise<Record<string, unknown>> {
  const { db, job, attemptId, cfg, transcode } = params;
  const priorOutput = (job.output ?? {}) as Record<string, unknown>;
  const deliveryBlobId = String(transcode.delivery_blob_id ?? "").trim();
  if (deliveryBlobId && String(priorOutput.blob_id ?? "") === deliveryBlobId) {
    return priorOutput;
  }

  const input = job.input as Record<string, unknown>;
  const scriptId = String(input.script_id ?? "").trim();
  const outputStoragePath = String(
    transcode.output_storage_path ?? "",
  ).trim();
  const wavBlobId = String(transcode.wav_blob_id ?? "").trim();
  if (!outputStoragePath) throw new Error("finalizeTranscodedAudioBlob: missing output_storage_path");

  const byteSize = await resolveObjectByteSize(db, outputStoragePath);
  const mimeType = deliveryMimeType(cfg);
  const durationMsRaw = transcode.duration_ms;
  const durationMs = typeof durationMsRaw === "number" && Number.isFinite(durationMsRaw)
    ? durationMsRaw
    : null;

  const stored = await registerDeliveryBlob(db, {
    attemptId,
    storagePath: outputStoragePath,
    mimeType,
    byteSize,
    durationMs,
  });

  if (wavBlobId) {
    await deleteBlobById(db, wavBlobId).catch((err) => {
      console.warn("[finalizeTranscodedAudioBlob] wav delete failed", wavBlobId, err);
    });
  }

  const jobOutput = (job.output ?? {}) as Record<string, unknown>;
  const batchMeta = jobOutput.batch ?? {};
  const casting = jobOutput.casting ??
    ((batchMeta as Record<string, unknown>).casting ?? {});

  return {
    script_id: scriptId,
    blob_id: stored.blobId,
    storage_path: stored.storagePath,
    mime_type: stored.mimeType,
    byte_size: stored.byteSize,
    duration_ms: durationMs,
    casting,
    chunk_count: jobOutput.chunk_count,
    transcode: {
      ...transcode,
      finalized: true,
      ready_to_finalize: false,
      delivery_blob_id: stored.blobId,
    },
  };
}

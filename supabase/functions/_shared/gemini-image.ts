import { GoogleGenAI } from "npm:@google/genai";
import { resolveGeminiApiRoot } from "./gemini-endpoint.ts";
import type { PodcastConfigMap } from "./types.ts";

const MOCK_API_KEY = "mock-api-key";
const DEFAULT_GEMINI_API_ROOT = "https://generativelanguage.googleapis.com";
/** Gemini interactions image response_format only accepts image/jpeg. */
const GEMINI_IMAGE_RESPONSE_MIME = "image/jpeg";
/**
 * The image model sometimes answers with text only ("no image payload").
 * Retry here because the caller treats image failures as non-fatal and does
 * not rethrow, so pgflow would never retry the step.
 */
const IMAGE_ATTEMPTS = 3;

function resolveApiKey(apiRoot: string): string {
  const envApiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (envApiKey && envApiKey.length > 0) return envApiKey;
  const normalized = apiRoot.replace(/\/+$/, "");
  if (normalized !== DEFAULT_GEMINI_API_ROOT.replace(/\/+$/, "")) {
    return MOCK_API_KEY;
  }
  throw new Error("GEMINI_API_KEY is required when using the default Gemini API Root");
}

function createClient(cfg: Record<string, string>): GoogleGenAI {
  const apiRoot = resolveGeminiApiRoot(cfg);
  return new GoogleGenAI({
    apiKey: resolveApiKey(apiRoot),
    httpOptions: { baseUrl: apiRoot },
  });
}

type ImageOutput = { bytes: Uint8Array; mimeType: string };

function decodeBase64Image(data: string): Uint8Array {
  const binary = atob(data);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toImageOutput(candidate: unknown): ImageOutput | null {
  if (!candidate || typeof candidate !== "object") return null;
  const rec = candidate as Record<string, unknown>;
  const data = rec.data;
  if (typeof data !== "string" || data.length === 0) return null;
  const mime = typeof rec.mime_type === "string" && rec.mime_type
    ? rec.mime_type
    : GEMINI_IMAGE_RESPONSE_MIME;
  return { bytes: decodeBase64Image(data), mimeType: mime };
}

function contentBlocks(container: unknown): unknown[] {
  if (!container || typeof container !== "object") return [];
  const content = (container as Record<string, unknown>).content;
  return Array.isArray(content) ? content : [];
}

/**
 * Reads an image from any Interactions API shape the SDK has shipped:
 * the `output_image` convenience field, the legacy `outputs` array, and the
 * `steps[].content[]` array used since the May 2026 schema change.
 */
function extractImageFromInteraction(interaction: Record<string, unknown>): ImageOutput | null {
  const direct = toImageOutput(interaction.output_image);
  if (direct) return direct;

  const outputs = interaction.outputs;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if ((item as Record<string, unknown> | null)?.type !== "image") continue;
      const image = toImageOutput(item);
      if (image) return image;
    }
  }

  const steps = interaction.steps;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      for (const block of contentBlocks(step)) {
        if ((block as Record<string, unknown> | null)?.type !== "image") continue;
        const image = toImageOutput(block);
        if (image) return image;
      }
    }
  }

  return null;
}

/** Model text from the interaction, used to explain a missing image. */
function extractTextFromInteraction(interaction: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  };

  push(interaction.output_text);

  const outputs = interaction.outputs;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if ((item as Record<string, unknown> | null)?.type !== "text") continue;
      push((item as Record<string, unknown>).text);
    }
  }

  const steps = interaction.steps;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      for (const block of contentBlocks(step)) {
        const rec = block as Record<string, unknown> | null;
        if (rec?.type !== "text") continue;
        push(rec.text);
      }
    }
  }

  return parts.join(" ");
}


export type EpisodeImageGenerationConfig = {
  model: string;
  aspectRatio: string;
  imageSize: string;
  mimeType: string;
};

function normalizeGeminiImageResponseMime(_mime: string | undefined): string {
  return GEMINI_IMAGE_RESPONSE_MIME;
}

export function readEpisodeImageConfig(cfg: PodcastConfigMap): EpisodeImageGenerationConfig {
  const modelRaw = cfg["image.model"];
  const aspectRaw = cfg["image.aspect_ratio"];
  const sizeRaw = cfg["image.image_size"];
  const mimeRaw = cfg["image.mime_type"];

  return {
    model: typeof modelRaw === "string" && modelRaw.trim() ? modelRaw.trim() : "gemini-3.1-flash-image",
    aspectRatio: typeof aspectRaw === "string" && aspectRaw.trim() ? aspectRaw.trim() : "16:9",
    imageSize: typeof sizeRaw === "string" && sizeRaw.trim() ? sizeRaw.trim() : "1K",
    mimeType: normalizeGeminiImageResponseMime(
      typeof mimeRaw === "string" ? mimeRaw : undefined,
    ),
  };
}

export function isEpisodeImageEnabled(cfg: PodcastConfigMap): boolean {
  const v = cfg["image.enabled"] as unknown;
  if (v === false || v === "false" || v === 0) return false;
  return true;
}

export async function generateEpisodeImageWithGemini(
  prompt: string,
  cfg: PodcastConfigMap,
): Promise<ImageOutput> {
  const imageCfg = readEpisodeImageConfig(cfg);
  const ai = createClient(cfg as Record<string, string>);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= IMAGE_ATTEMPTS; attempt++) {
    try {
      const interaction = await ai.interactions.create({
        model: imageCfg.model,
        input: prompt,
        response_format: {
          type: "image",
          mime_type: imageCfg.mimeType,
          aspect_ratio: imageCfg.aspectRatio,
          image_size: imageCfg.imageSize,
        },
      });

      const record = interaction as unknown as Record<string, unknown>;
      if (record.status === "failed") {
        throw new Error(`Image interaction failed: ${JSON.stringify(record)}`);
      }

      const image = extractImageFromInteraction(record);
      if (!image) {
        const text = extractTextFromInteraction(record).slice(0, 300);
        throw new Error(
          `Image interaction returned no image payload${text ? ` (model text: ${text})` : ""}`,
        );
      }
      return image;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < IMAGE_ATTEMPTS) {
        console.error(
          `[episode-image] attempt ${attempt}/${IMAGE_ATTEMPTS} failed: ${lastError.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  throw lastError ?? new Error("Image generation failed");
}

export function storageExtensionForMime(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

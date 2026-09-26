import { GoogleGenAI } from "npm:@google/genai";
import { resolveGeminiApiRoot } from "./gemini-endpoint.ts";
import type { PodcastConfigMap } from "./types.ts";

const MOCK_API_KEY = "mock-api-key";
const DEFAULT_GEMINI_API_ROOT = "https://generativelanguage.googleapis.com";
/** Gemini interactions image response_format only accepts image/jpeg. */
const GEMINI_IMAGE_RESPONSE_MIME = "image/jpeg";

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

function extractImageFromInteraction(interaction: Record<string, unknown>): ImageOutput | null {
  const outputImage = interaction.output_image;
  if (outputImage && typeof outputImage === "object") {
    const rec = outputImage as Record<string, unknown>;
    const data = rec.data;
    const mime = typeof rec.mime_type === "string" ? rec.mime_type : GEMINI_IMAGE_RESPONSE_MIME;
    if (typeof data === "string" && data.length > 0) {
      return { bytes: decodeBase64Image(data), mimeType: mime };
    }
  }

  const outputs = interaction.outputs;
  if (!Array.isArray(outputs)) return null;
  for (const item of outputs) {
    if (!item || typeof item !== "object") continue;
    const out = item as Record<string, unknown>;
    if (out.type !== "image") continue;
    const data = out.data;
    const mime = typeof out.mime_type === "string" ? out.mime_type : GEMINI_IMAGE_RESPONSE_MIME;
    if (typeof data === "string" && data.length > 0) {
      return { bytes: decodeBase64Image(data), mimeType: mime };
    }
  }
  return null;
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
    aspectRatio: typeof aspectRaw === "string" && aspectRaw.trim() ? aspectRaw.trim() : "1:1",
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
    throw new Error("Image interaction returned no image payload");
  }
  return image;
}

export function storageExtensionForMime(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

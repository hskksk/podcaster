#!/usr/bin/env tsx
import dotenv from "dotenv";
import { createSign, generateKeyPairSync, randomUUID, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";

dotenv.config({ path: ".env" });

type ScriptMockConfig = {
  delayMs?: number;
  title?: string;
  description?: string;
  script?: string;
  thoughts?: string[];
  tokenUsage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type AudioMockConfig = {
  delayMs?: number;
  mimeType?: string;
  sampleRate?: number;
  durationSeconds?: number;
  base64Data?: string;
  tokenUsage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

type GeminiMockConfig = {
  enabled?: boolean;
  server?: {
    uploadBaseUrl?: string;
  };
  webhook?: {
    enabled?: boolean;
    issuer?: string;
  };
  script?: ScriptMockConfig;
  audio?: AudioMockConfig;
};

type DevConfig = {
  geminiMock?: GeminiMockConfig;
};

type BatchJob = {
  name: string;
  createdAt: number;
  readyAt: number;
  completionLogged: boolean;
  webhookDispatched: boolean;
  model?: string;
  webhookUri?: string;
  webhookAudience?: string;
  outputFile: string;
  metadata?: Record<string, string>;
  response: Record<string, unknown>;
};

type MockFile = {
  name: string;
  mimeType: string;
  displayName?: string;
  bytes: Buffer;
};

type UploadSession = {
  id: string;
  mimeType: string;
  displayName?: string;
};

const DEFAULT_SCRIPT =
  "Host: 皆さんこんにちは。これは Gemini API のモック応答です。\n" +
  "CoHost: 開発時に API コストなしで動作検証できますね。\n" +
  "Host: dev.gemini.mock.toml を編集すると返り値を変えられます。";

const DEFAULT_CONFIG_PATH = resolve("dev.gemini.mock.toml");
const DEFAULT_PORT = 8099;
const DEFAULT_WEBHOOK_ISSUER = "https://accounts.google.com";

const batchJobs = new Map<string, BatchJob>();
const mockFiles = new Map<string, MockFile>();
const uploadSessions = new Map<string, UploadSession>();
const mockWebhookKeyId = `gemini-mock-${randomUUID()}`;
const mockWebhookKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

function base64UrlEncode(value: Buffer | string): string {
  const asBuffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return asBuffer.toString("base64url");
}

function buildMockWebhookJwks(): Record<string, unknown> {
  const exported = mockWebhookKeyPair.publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  return {
    keys: [{
      ...exported,
      kid: mockWebhookKeyId,
      alg: "RS256",
      use: "sig",
      key_ops: ["verify"],
    }],
  };
}

const mockWebhookJwks = buildMockWebhookJwks();

function signWebhookJwt(privateKey: KeyObject, payload: Record<string, unknown>): string {
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: mockWebhookKeyId,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function readMockConfig(): DevConfig {
  const configPath = process.env.GEMINI_MOCK_CONFIG_PATH?.trim() || DEFAULT_CONFIG_PATH;
  const content = readFileSync(configPath, "utf8");
  const parsed = parseToml(content) as DevConfig;
  return parsed;
}

function isEnabled(config: DevConfig): boolean {
  return config.geminiMock?.enabled === true;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body).toString(),
  });
  res.end(body);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function readRequestJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

async function readRequestBytes(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function generateSilencePcmBase64(sampleRate: number, durationSeconds: number): string {
  const totalSamples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const bytes = Buffer.alloc(totalSamples * 2);
  return bytes.toString("base64");
}

function createScriptResponse(mock: ScriptMockConfig): Record<string, unknown> {
  const title = mock.title ?? "モック台本";
  const description = mock.description ?? "Gemini API モックで生成した台本です。";
  const script = mock.script ?? DEFAULT_SCRIPT;
  const thoughts = mock.thoughts ?? [];
  const payload = JSON.stringify({ title, description, script });

  return {
    text: payload,
    candidates: [{
      content: {
        parts: [
          ...thoughts.map((thought) => ({ text: thought, thought: true })),
          { text: payload },
        ],
      },
    }],
    usageMetadata: {
      promptTokenCount: mock.tokenUsage?.promptTokenCount ?? 120,
      candidatesTokenCount: mock.tokenUsage?.candidatesTokenCount ?? 380,
      totalTokenCount: mock.tokenUsage?.totalTokenCount ?? 500,
    },
  };
}

function createAudioResponse(mock: AudioMockConfig): Record<string, unknown> {
  const sampleRate = mock.sampleRate ?? 24000;
  const durationSeconds = mock.durationSeconds ?? 5;
  const mimeType = mock.mimeType ?? `audio/L16;rate=${sampleRate}`;
  const data = mock.base64Data ?? generateSilencePcmBase64(sampleRate, durationSeconds);

  return {
    candidates: [{
      content: {
        parts: [{
          inlineData: {
            mimeType,
            data,
          },
        }],
      },
    }],
    usageMetadata: {
      promptTokenCount: mock.tokenUsage?.promptTokenCount ?? 240,
      candidatesTokenCount: mock.tokenUsage?.candidatesTokenCount ?? 420,
      totalTokenCount: mock.tokenUsage?.totalTokenCount ?? 660,
    },
  };
}

function extractMetadata(body: Record<string, unknown>): Record<string, string> | undefined {
  const src = Array.isArray(body.src) ? body.src[0] : undefined;
  const metadata = (src && typeof src === "object")
    ? (src as Record<string, unknown>).metadata
    : undefined;
  if (!metadata || typeof metadata !== "object") {
    const requests = (((body.batch as Record<string, unknown> | undefined)?.inputConfig as Record<string, unknown> | undefined)
      ?.requests as Record<string, unknown> | undefined)?.requests;
    const firstRequest = Array.isArray(requests) ? requests[0] : undefined;
    const requestMetadata = (firstRequest && typeof firstRequest === "object")
      ? (firstRequest as Record<string, unknown>).metadata
      : undefined;
    if (!requestMetadata || typeof requestMetadata !== "object") return undefined;
    const outFromRequest: Record<string, string> = {};
    for (const [key, value] of Object.entries(requestMetadata as Record<string, unknown>)) {
      if (typeof value === "string") outFromRequest[key] = value;
    }
    return Object.keys(outFromRequest).length > 0 ? outFromRequest : undefined;
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function matchesGenerateContentPath(pathname: string): boolean {
  return /\/models\/[^/]+:generateContent$/.test(pathname);
}

function matchesBatchCreatePath(pathname: string): boolean {
  return pathname.endsWith("/batches") || pathname === "/batches";
}

function matchesModelBatchGeneratePath(pathname: string): boolean {
  return /\/models\/[^/]+:batchGenerateContent$/.test(pathname);
}

function matchesFilesUploadStartPath(pathname: string): boolean {
  return /^\/upload\/(v1|v1beta)\/files$/.test(pathname);
}

function matchesUploadSessionPath(pathname: string): boolean {
  return /^\/upload-resumable\/[^/]+$/.test(pathname);
}

function matchesFileDownloadPath(pathname: string): boolean {
  return /^\/(v1|v1beta)\/files\/[^/]+:download$/.test(pathname);
}

function extractBatchName(pathname: string): string | null {
  const match = pathname.match(/\/batches\/([^/]+)$/);
  if (!match) return null;
  return `batches/${decodeURIComponent(match[1])}`;
}

function extractUploadSessionId(pathname: string): string | null {
  const match = pathname.match(/^\/upload-resumable\/([^/]+)$/);
  return match?.[1] ?? null;
}

function extractFileNameFromDownloadPath(pathname: string): string | null {
  const match = pathname.match(/^\/(?:v1|v1beta)\/files\/([^/]+):download$/);
  if (!match) return null;
  return `files/${decodeURIComponent(match[1])}`;
}

function readHeader(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

function readFirstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function stripQuoted(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseForwardedHeader(
  forwarded: string | null,
): { host?: string; proto?: string } {
  const first = readFirstHeaderValue(forwarded);
  if (!first) return {};
  const parts = first.split(";").map((part) => part.trim());
  const hostPart = parts.find((part) => part.toLowerCase().startsWith("host="));
  const protoPart = parts.find((part) => part.toLowerCase().startsWith("proto="));
  const host = hostPart ? stripQuoted(hostPart.slice("host=".length).trim()) : undefined;
  const proto = protoPart ? stripQuoted(protoPart.slice("proto=".length).trim()) : undefined;
  return { host, proto };
}

function resolveUploadBaseUrl(req: IncomingMessage, config: DevConfig): string {
  const fromConfig = config.geminiMock?.server?.uploadBaseUrl?.trim();
  if (fromConfig && fromConfig.length > 0) {
    return fromConfig.replace(/\/+$/, "");
  }

  const forwarded = parseForwardedHeader(readHeader(req, "forwarded"));
  const host = forwarded.host ??
    readFirstHeaderValue(readHeader(req, "x-forwarded-host")) ??
    readFirstHeaderValue(readHeader(req, "host"));
  const proto = forwarded.proto ??
    readFirstHeaderValue(readHeader(req, "x-forwarded-proto")) ??
    "http";

  if (host && host.length > 0) {
    console.log(`${proto}://${host}`.replace(/\/+$/, ""));
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  return `http://127.0.0.1:${port}`;
}

function readInputFileName(body: Record<string, unknown>): string | undefined {
  const inputConfigSnake = (body.batch as Record<string, unknown> | undefined)?.input_config as Record<string, unknown> | undefined;
  const snake = inputConfigSnake?.file_name;
  if (typeof snake === "string" && snake.length > 0) return snake;

  const inputConfigCamel = (body.batch as Record<string, unknown> | undefined)?.inputConfig as Record<string, unknown> | undefined;
  const camel = inputConfigCamel?.fileName;
  if (typeof camel === "string" && camel.length > 0) return camel;
  return undefined;
}

function readWebhookUri(body: Record<string, unknown>): string | undefined {
  const batch = body.batch as Record<string, unknown> | undefined;
  const webhookConfig = (batch?.webhook_config ?? batch?.webhookConfig) as Record<string, unknown> | undefined;
  if (!webhookConfig) return undefined;
  const uris = webhookConfig.uris;
  if (!Array.isArray(uris)) return undefined;
  const uri = uris.find((item): item is string => typeof item === "string" && item.trim().length > 0);
  return uri?.trim();
}

function readWebhookAudience(body: Record<string, unknown>, webhookUri?: string): string | undefined {
  const batch = body.batch as Record<string, unknown> | undefined;
  const webhookConfig = (batch?.webhook_config ?? batch?.webhookConfig) as Record<string, unknown> | undefined;
  const userMetadata = webhookConfig?.user_metadata as Record<string, unknown> | undefined;
  const explicitAudience = userMetadata?.audience;
  if (typeof explicitAudience === "string" && explicitAudience.trim().length > 0) {
    return explicitAudience.trim();
  }
  return webhookUri;
}

function rewriteLocalHttpsWebhookUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    const isLocalHost = parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "host.docker.internal";
    if (parsed.protocol === "https:" && isLocalHost) {
      parsed.protocol = "http:";
      return parsed.toString();
    }
  } catch {
    // noop: invalid URL is handled by fetch
  }
  return uri;
}

async function dispatchBatchWebhook(job: BatchJob, config: DevConfig): Promise<void> {
  if (!job.webhookUri || job.webhookDispatched) return;
  const now = Math.floor(Date.now() / 1000);
  const issuer = config.geminiMock?.webhook?.issuer?.trim() || DEFAULT_WEBHOOK_ISSUER;
  const audience = job.webhookAudience ?? job.webhookUri;
  const deliveryUri = rewriteLocalHttpsWebhookUri(job.webhookUri);
  if (deliveryUri !== job.webhookUri) {
    console.log(`[gemini-mock] rewrite local webhook URI: ${job.webhookUri} -> ${deliveryUri}`);
  }
  const token = signWebhookJwt(mockWebhookKeyPair.privateKey, {
    iss: issuer,
    aud: audience,
    iat: now,
    nbf: now - 2,
    exp: now + 300,
    sub: "gemini-mock-webhook",
  });

  const webhookPayload = {
    type: "batch.succeeded",
    version: "v1",
    timestamp: new Date().toISOString(),
    data: {
      id: job.name,
      output_file_uri: `mock://${job.outputFile}`,
      file_name: job.outputFile,
    },
  };
  const webhookId = `mock-wh-${randomUUID()}`;
  try {
    const response = await fetch(deliveryUri, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Webhook-Signature": token,
        "webhook-id": webhookId,
        "webhook-timestamp": String(now),
      },
      body: JSON.stringify(webhookPayload),
    });
    const responseBody = await response.text().catch(() => "");
    console.log(
      `[gemini-mock] webhook delivered batch=${job.name} uri=${deliveryUri} status=${response.status}`,
    );
    if (!response.ok) {
      console.log(`[gemini-mock] webhook response body: ${responseBody}`);
    }
    job.webhookDispatched = response.ok;
  } catch (error) {
    console.error(`[gemini-mock] webhook delivery failed batch=${job.name} uri=${deliveryUri}`, error);
  }
}

function scheduleBatchWebhook(job: BatchJob, config: DevConfig): void {
  if (!job.webhookUri) return;
  if (config.geminiMock?.webhook?.enabled === false) return;
  const delayMs = Math.max(0, job.readyAt - Date.now());
  setTimeout(() => {
    void dispatchBatchWebhook(job, config);
  }, delayMs);
}

function isAudioGenerateRequest(body: Record<string, unknown>): boolean {
  const config = body.config;
  if (!config || typeof config !== "object") return false;
  const modalities = (config as Record<string, unknown>).responseModalities;
  if (!Array.isArray(modalities)) return false;
  return modalities.some((item) => item === "AUDIO");
}

function writeDisabledError(res: ServerResponse): void {
  writeJson(res, 503, {
    error: {
      code: 503,
      message: "Gemini mock server is disabled in dev.gemini.mock.toml",
      status: "UNAVAILABLE",
    },
  });
}

function createBatchJobResponse(
  body: Record<string, unknown>,
  audioMock: AudioMockConfig,
  config: DevConfig,
): Record<string, unknown> {
  const now = Date.now();
  const jobName = `batches/mock-audio-${randomUUID()}`;
  const delayMs = Math.max(0, audioMock.delayMs ?? 0);
  const metadata = extractMetadata(body);
  const model = typeof body.model === "string" ? body.model : undefined;
  const webhookUri = readWebhookUri(body);
  const webhookAudience = readWebhookAudience(body, webhookUri);
  const nowIso = new Date(now).toISOString();
  const inputFile = readInputFileName(body);
  if (inputFile && !mockFiles.has(inputFile)) {
    console.log(`[gemini-mock] warning input file not found: ${inputFile}`);
  }

  const outputFileName = `files/mock-batch-output-${randomUUID()}`;
  const outputLine = JSON.stringify({
    response: createAudioResponse(audioMock),
    ...(metadata ? { metadata } : {}),
  }) + "\n";
  mockFiles.set(outputFileName, {
    name: outputFileName,
    mimeType: "application/jsonl",
    displayName: "tts-batch-output.jsonl",
    bytes: Buffer.from(outputLine, "utf8"),
  });

  batchJobs.set(jobName, {
    name: jobName,
    createdAt: now,
    readyAt: now + delayMs,
    completionLogged: false,
    webhookDispatched: false,
    model,
    webhookUri,
    webhookAudience,
    outputFile: outputFileName,
    metadata,
    response: createAudioResponse(audioMock),
  });
  const createdJob = batchJobs.get(jobName);
  if (createdJob) {
    scheduleBatchWebhook(createdJob, config);
  }

  return {
    name: jobName,
    metadata: {
      state: "BATCH_STATE_RUNNING",
      createTime: nowIso,
      updateTime: nowIso,
      ...(model ? { model } : {}),
    },
    response: {
      dest: {
        fileName: outputFileName,
      },
    },
    // Legacy fields for easier manual debugging
    state: "JOB_STATE_RUNNING",
    createTime: nowIso,
    ...(webhookUri ? { webhookConfigured: true } : {}),
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  console.log(`[gemini-mock] request ${method} ${pathname}`);

  let config: DevConfig;
  try {
    config = readMockConfig();
  } catch (error) {
    writeJson(res, 500, {
      error: {
        code: 500,
        message: `Failed to load mock config: ${String(error)}`,
        status: "INTERNAL",
      },
    });
    return;
  }

  if (method === "POST" && matchesGenerateContentPath(pathname)) {
    if (!isEnabled(config)) return writeDisabledError(res);

    const body = await readRequestJson(req);
    const useAudioMock = isAudioGenerateRequest(body);

    if (useAudioMock) {
      const audioMock = config.geminiMock?.audio ?? {};
      await sleep(audioMock.delayMs ?? 0);
      writeJson(res, 200, createAudioResponse(audioMock));
      return;
    }

    const scriptMock = config.geminiMock?.script ?? {};
    await sleep(scriptMock.delayMs ?? 0);
    writeJson(res, 200, createScriptResponse(scriptMock));
    return;
  }

  if (method === "GET" && pathname === "/.well-known/jwks.json") {
    writeJson(res, 200, mockWebhookJwks);
    return;
  }

  if (method === "POST" && matchesFilesUploadStartPath(pathname)) {
    if (!isEnabled(config)) return writeDisabledError(res);
    const body = await readRequestJson(req);
    const sessionId = randomUUID();
    const uploadBaseUrl = resolveUploadBaseUrl(req, config);
    const uploadUrl = `${uploadBaseUrl}/upload-resumable/${sessionId}`;
    const mimeType = readHeader(req, "x-goog-upload-header-content-type") ?? "application/jsonl";
    const displayName = ((body.file as Record<string, unknown> | undefined)?.display_name ??
      (body.file as Record<string, unknown> | undefined)?.displayName);
    uploadSessions.set(sessionId, {
      id: sessionId,
      mimeType,
      displayName: typeof displayName === "string" ? displayName : undefined,
    });
    res.writeHead(200, {
      "Content-Type": "application/json",
      "x-goog-upload-url": uploadUrl,
    });
    res.end("{}");
    return;
  }

  if (method === "POST" && matchesUploadSessionPath(pathname)) {
    if (!isEnabled(config)) return writeDisabledError(res);
    const sessionId = extractUploadSessionId(pathname);
    if (!sessionId || !uploadSessions.has(sessionId)) {
      writeJson(res, 404, {
        error: { code: 404, message: "Upload session not found", status: "NOT_FOUND" },
      });
      return;
    }
    const uploadCommand = readHeader(req, "x-goog-upload-command") ?? "";
    const bytes = await readRequestBytes(req);
    const session = uploadSessions.get(sessionId)!;
    const fileName = `files/mock-upload-${randomUUID()}`;
    mockFiles.set(fileName, {
      name: fileName,
      mimeType: session.mimeType,
      displayName: session.displayName,
      bytes,
    });
    if (uploadCommand.includes("finalize")) {
      uploadSessions.delete(sessionId);
    }
    writeJson(res, 200, {
      file: {
        name: fileName,
        ...(session.displayName ? { displayName: session.displayName } : {}),
        mimeType: session.mimeType,
        sizeBytes: String(bytes.byteLength),
      },
    });
    return;
  }

  if (method === "GET" && matchesFileDownloadPath(pathname)) {
    if (!isEnabled(config)) return writeDisabledError(res);
    const fileName = extractFileNameFromDownloadPath(pathname);
    if (!fileName) {
      writeJson(res, 404, {
        error: { code: 404, message: "File name is missing", status: "NOT_FOUND" },
      });
      return;
    }
    const file = mockFiles.get(fileName);
    if (!file) {
      writeJson(res, 404, {
        error: { code: 404, message: `File not found: ${fileName}`, status: "NOT_FOUND" },
      });
      return;
    }
    res.writeHead(200, {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.bytes.byteLength),
    });
    res.end(file.bytes);
    return;
  }

  if (
    method === "POST" &&
    (matchesBatchCreatePath(pathname) || matchesModelBatchGeneratePath(pathname))
  ) {
    if (!isEnabled(config)) return writeDisabledError(res);

    const body = await readRequestJson(req);
    const audioMock = config.geminiMock?.audio ?? {};
    writeJson(res, 200, createBatchJobResponse(body, audioMock, config));
    return;
  }

  if (method === "GET" && pathname.includes("/batches/")) {
    if (!isEnabled(config)) return writeDisabledError(res);

    const batchName = extractBatchName(pathname);
    if (!batchName) {
      writeJson(res, 404, {
        error: { code: 404, message: "Batch name is missing", status: "NOT_FOUND" },
      });
      return;
    }

    const job = batchJobs.get(batchName);
    if (!job) {
      writeJson(res, 404, {
        error: { code: 404, message: `Batch not found: ${batchName}`, status: "NOT_FOUND" },
      });
      return;
    }

    const now = Date.now();
    const ready = now >= job.readyAt;
    const state = ready ? "JOB_STATE_SUCCEEDED" : "JOB_STATE_RUNNING";
    const mldevState = ready ? "BATCH_STATE_SUCCEEDED" : "BATCH_STATE_RUNNING";
    if (ready && !job.completionLogged) {
      job.completionLogged = true;
      console.log(`[gemini-mock] batch completed ${job.name}`);
      void dispatchBatchWebhook(job, config);
    }
    const nowIso = new Date(now).toISOString();
    const response = {
      name: job.name,
      state,
      createTime: new Date(job.createdAt).toISOString(),
      updateTime: nowIso,
      metadata: {
        state: mldevState,
        createTime: new Date(job.createdAt).toISOString(),
        updateTime: nowIso,
        ...(ready ? { endTime: nowIso } : {}),
        ...(job.model ? { model: job.model } : {}),
        ...(ready
          ? {
            output: {
              fileName: job.outputFile,
              responsesFile: job.outputFile,
              inlinedResponses: {
                inlinedResponses: [{
                  response: job.response,
                  ...(job.metadata ? { metadata: job.metadata } : {}),
                }],
              },
            },
          }
          : {}),
      },
      ...(ready
        ? {
          response: {
            dest: {
              fileName: job.outputFile,
            },
          },
          dest: {
            fileName: job.outputFile,
            inlinedResponses: [{
              response: job.response,
              ...(job.metadata ? { metadata: job.metadata } : {}),
            }],
          },
        }
        : {}),
    };

    writeJson(res, 200, response);
    return;
  }

  writeJson(res, 404, {
    error: {
      code: 404,
      message: `Unsupported route: ${method} ${pathname}`,
      status: "NOT_FOUND",
    },
  });
}

const port = Number(process.env.GEMINI_MOCK_PORT ?? DEFAULT_PORT);
if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid GEMINI_MOCK_PORT: ${process.env.GEMINI_MOCK_PORT}`);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    writeJson(res, 500, {
      error: {
        code: 500,
        message: `Unhandled mock server error: ${String(error)}`,
        status: "INTERNAL",
      },
    });
  });
});

server.listen(port, () => {
  const configPath = process.env.GEMINI_MOCK_CONFIG_PATH?.trim() || DEFAULT_CONFIG_PATH;
  console.log(`[gemini-mock] listening on http://127.0.0.1:${port}`);
  console.log(`[gemini-mock] config: ${configPath}`);
});

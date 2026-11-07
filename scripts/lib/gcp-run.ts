/**
 * GCP Cloud Run Job API helpers for operator scripts (Node).
 * Mirrors supabase/functions/_shared/transcode/gcp-token.ts and cloud-run.ts.
 */
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const RUN_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
}

export function loadServiceAccountFromEnv(): ServiceAccountJson {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("GCP_SERVICE_ACCOUNT_JSON is not set");
  return JSON.parse(raw) as ServiceAccountJson;
}

export function gcpRunPlacementFromEnv(): {
  projectId: string;
  region: string;
  jobName: string;
} {
  const sa = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
  let projectFromSa = "";
  if (sa) {
    try {
      projectFromSa = String((JSON.parse(sa) as ServiceAccountJson).project_id ?? "").trim();
    } catch {
      projectFromSa = "";
    }
  }
  return {
    projectId: (process.env.GCP_PROJECT_ID?.trim() || projectFromSa),
    region: process.env.GCP_REGION?.trim() || "asia-northeast1",
    jobName: process.env.GCP_RUN_JOB_NAME?.trim() || "audio-transcode",
  };
}

export function assertGcpRunPlacement(): {
  projectId: string;
  region: string;
  jobName: string;
} {
  const gcp = gcpRunPlacementFromEnv();
  if (!gcp.projectId) {
    throw new Error(
      "GCP_PROJECT_ID (or project_id in GCP_SERVICE_ACCOUNT_JSON) is required",
    );
  }
  return gcp;
}

function base64UrlEncode(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

async function mintAccessToken(): Promise<string> {
  const sa = loadServiceAccountFromEnv();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri ?? TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: RUN_SCOPE,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key);
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const tokenUri = sa.token_uri ?? TOKEN_URL;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`GCP token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("GCP token response missing access_token");
  cachedToken = {
    accessToken: json.access_token,
    expiresAtMs: Date.now() + (Number(json.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.accessToken;
}

async function getGcpAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs) {
    return cachedToken.accessToken;
  }
  return mintAccessToken();
}

export async function gcpFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getGcpAccessToken();
  const url = path.startsWith("https://")
    ? path
    : `https://run.googleapis.com/v2/${path.replace(/^\//, "")}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function isCloudRunExecutionName(operationName: string): boolean {
  return operationName.startsWith("projects/") && operationName.includes("/executions/");
}

export async function submitCloudRunTranscode(opts: {
  wavStoragePath: string;
  outputStoragePath: string;
  jobId: string;
  attemptId: string;
  bitrateKbps: number;
  signedInputUrl: string;
  signedOutputUrl: string;
}): Promise<string> {
  const gcp = assertGcpRunPlacement();
  const parent =
    `projects/${gcp.projectId}/locations/${gcp.region}/jobs/${gcp.jobName}`;
  const res = await gcpFetch(`${parent}:run`, {
    method: "POST",
    body: JSON.stringify({
      overrides: {
        containerOverrides: [{
          env: [
            { name: "INPUT_URL", value: opts.signedInputUrl },
            { name: "OUTPUT_UPLOAD_URL", value: opts.signedOutputUrl },
            { name: "OUTPUT_OBJECT_PATH", value: opts.outputStoragePath },
            { name: "BITRATE_KBPS", value: String(opts.bitrateKbps) },
            { name: "JOB_ID", value: opts.jobId },
            { name: "ATTEMPT_ID", value: opts.attemptId },
          ],
        }],
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Cloud Run Job run failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json() as {
    name?: string;
    metadata?: { name?: string };
    response?: { name?: string };
  };
  const executionName = String(body.metadata?.name ?? body.response?.name ?? "").trim();
  if (!isCloudRunExecutionName(executionName)) {
    throw new Error(
      `Cloud Run Job run returned no execution name (operation=${body.name ?? "(none)"})`,
    );
  }
  return executionName;
}

export const CLOUD_RUN_SUCCESS_STATES = new Set([
  "EXECUTION_SUCCEEDED",
  "CONDITION_SUCCEEDED",
]);

export const CLOUD_RUN_FAILURE_STATES = new Set([
  "EXECUTION_FAILED",
  "CONDITION_FAILED",
  "EXECUTION_CANCELLED",
]);

function mapExecutionState(execution: Record<string, unknown>): string {
  const conditions = execution.conditions as Array<{ type?: string; state?: string }> | undefined;
  const completed = conditions?.find((c) => c.type === "Completed");
  if (completed?.state === "CONDITION_FAILED") return "EXECUTION_FAILED";
  if (execution.cancelledCount && Number(execution.cancelledCount) > 0) {
    return "EXECUTION_CANCELLED";
  }
  if (completed?.state === "CONDITION_SUCCEEDED") return "EXECUTION_SUCCEEDED";
  if (execution.failedCount && Number(execution.failedCount) > 0) {
    return "EXECUTION_FAILED";
  }
  if (execution.completionTime) return "EXECUTION_SUCCEEDED";
  return "EXECUTION_RUNNING";
}

export async function pollCloudRunExecution(
  executionName: string,
): Promise<{ state: string; execution: Record<string, unknown> }> {
  const res = await gcpFetch(executionName, { method: "GET" });
  if (!res.ok) {
    throw new Error(`pollCloudRunExecution: ${res.status} ${await res.text()}`);
  }
  const execution = await res.json() as Record<string, unknown>;
  return { state: mapExecutionState(execution), execution };
}

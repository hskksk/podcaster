function captureUrl(): string {
  const base = (process.env.CAPTURE_API_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("CAPTURE_API_URL is not set");
  return `${base}/api/capture`;
}

function captureToken(): string {
  const token = (process.env.CAPTURE_API_TOKEN || "").trim();
  if (!token) throw new Error("CAPTURE_API_TOKEN is not set");
  return token;
}

/**
 * Writes go through Capture. Do not use GITHUB_TOKEN here (NFR-02).
 */
export async function capturePost(body: {
  title: string;
  content: string;
  url?: string;
}): Promise<unknown> {
  const res = await fetch(captureUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${captureToken()}`,
    },
    body: JSON.stringify({
      title: body.title,
      content: body.content,
      url: body.url,
      collection: "web-clips",
      podcast: "none",
    }),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text
  }
  if (!res.ok && res.status !== 202) {
    throw new Error(`Capture ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  }
  return parsed;
}

export async function capturePatch(path: string, podcast: "queued"): Promise<unknown> {
  const res = await fetch(captureUrl(), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${captureToken()}`,
    },
    body: JSON.stringify({ path, podcast }),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text
  }
  if (!res.ok) {
    throw new Error(`Capture ${res.status}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  }
  return parsed;
}

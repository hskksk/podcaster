import "server-only";

export function knowledgeRevalidateSecret(): string {
  return (process.env.KNOWLEDGE_REVALIDATE_SECRET || "").trim();
}

export function knowledgeRevalidateOk(authorization: string | null): boolean {
  const secret = knowledgeRevalidateSecret();
  if (!secret) return false;
  const header = authorization?.trim() ?? "";
  if (header === `Bearer ${secret}`) return true;
  return header === secret;
}
import { ThinkingLevel } from "npm:@google/genai";
import { generateScriptWithGemini } from "../../_adapters/gemini/script-provider.ts";
import { generateScriptFromArticle } from "../../../../shared/script-generation.ts";
import { recordLlmInvocation } from "../job-db.ts";
import { resolveGeneratorPrompts, resolveProfile } from "../runner.ts";
import type { JobHandler, WriteScriptInput } from "../types.ts";

export const handleWriteScript: JobHandler = async (ctx) => {
  const input = ctx.job.input as WriteScriptInput;
  const content = String(input.article_content ?? "").trim();
  if (!content) throw new Error("write_script requires article_content");

  const profile = await resolveProfile(input.profile as Record<string, unknown> | undefined);
  const { systemInstruction, promptTemplate, model, apiRoot } =
    await resolveGeneratorPrompts(profile);

  const started = Date.now();
  const generated = await generateScriptFromArticle({
    articleContent: content,
    model,
    systemInstruction,
    promptTemplate,
    thinkingLevel: ThinkingLevel.HIGH,
    generateContent: (params) => generateScriptWithGemini(params, { apiRoot }),
  });

  await recordLlmInvocation(ctx.db, {
    attempt_id: ctx.attemptId,
    model,
    input_tokens: generated.tokenUsage.prompt_tokens ?? null,
    output_tokens: generated.tokenUsage.completion_tokens ?? null,
    latency_ms: Date.now() - started,
    finish_reason: "stop",
  });

  return {
    outcome: "succeeded",
    output: {
      title: generated.title,
      description: generated.description,
      script: generated.script,
      token_usage: generated.tokenUsage,
    },
  };
};

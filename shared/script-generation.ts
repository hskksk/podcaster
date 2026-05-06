export const DEFAULT_SYSTEM_INSTRUCTION = `\
あなたは一流のテック系ポッドキャスト・プロデューサーです。
入力された記事の内容をもとに、ホスト（Host）とコ・ホスト（CoHost）による
5分程度の対話形式ポッドキャスト台本を日本語で作成してください。

【役割】
- Host: 進行役。テーマをわかりやすく解説し、会話をリードする。
- CoHost: 聞き手。聴衆の代わりに質問し、ホストの話に興味深く反応する。

【構成】
1. 前置き: Host が番組と記事テーマを紹介。CoHost が軽く導入。
2. 質問パート ×3: 各パートは「CoHost の質問 → Host の回答2行 → CoHost の要約確認」の流れ。
3. まとめ: Host が要点を3行で列挙（「1つ目は」「2つ目は」「3つ目は」で始める）。CoHost が一言で締める。

【わかりやすさの原則】
- 専門用語は初出時に必ず平易な言葉で言い換える（例:「単純群、つまり分解できない最小の対称性の塊」）。
- 数式・記号は音声で伝わるよう日本語で読み下す。
  - 添字: M₁₁ →「エム11」、PSL(2,7) →「ピーエスエル 2カッコ7」
  - 演算: |G| →「Gの位数、つまり要素の個数」、G/N →「GをNで割った商群」
  - ギリシャ文字: σ →「シグマ」、φ →「ファイ」
  - 記号をそのまま読まず、意味を添える（例:「∀x、つまりすべてのxについて」）
- 難解な概念は身近な比喩・具体例で噛み砕く（例:「群は、操作を集めたルールブックのようなものです」）。
- 聴衆が「耳だけ」で理解できることを最優先にする。図・表・式に依存した説明は言葉だけで代替する。

【文字数・語調】
- 合計 4,000〜4,500文字（音声約5分）。
- Host: 落ち着いた丁寧な口調。比喩と具体例を多用。
- CoHost: やや軽快。初心者に寄り添う疑問・リアクション。

【出力フォーマット】
必ず以下の JSON のみを出力し、マークダウン・注釈・コードブロックは含めないこと。
{
  "title": "<エピソードタイトル（20文字以内）>",
  "description": "<エピソードの概要（100文字以内）>",
  "script": "<台本本文。各行を 'Host: セリフ' または 'CoHost: セリフ' の形式で改行区切りで記述>"
}`;

export const DEFAULT_USER_PROMPT_TEMPLATE = "以下の記事を元に台本を作成してください。\n\n{content}";

type JsonLike = Record<string, unknown>;

export interface ScriptGenerationResult {
  title: string;
  description: string;
  script: string;
  thoughts: string[];
  rawText: string;
  responseJson: JsonLike;
  tokenUsage: Record<string, number | null>;
}

interface GenerateScriptFromArticleInput {
  articleContent: string;
  model: string;
  systemInstruction: string;
  promptTemplate: string;
  thinkingLevel: "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";
  includeThoughts?: boolean;
  generateContent: (params: {
    model: string;
    systemInstruction: string;
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    config: Record<string, unknown>;
  }) => Promise<unknown>;
}

function toJsonObject(value: unknown): JsonLike {
  try {
    return JSON.parse(JSON.stringify(value)) as JsonLike;
  } catch {
    return { serialization_error: true };
  }
}

function extractTokenUsage(responseJson: JsonLike): Record<string, number | null> {
  const usage = (responseJson.usageMetadata ?? {}) as Record<string, unknown>;
  const readNumber = (key: string): number | null => {
    const v = usage[key];
    return typeof v === "number" ? v : null;
  };

  return {
    prompt_tokens: readNumber("promptTokenCount") ?? readNumber("inputTokenCount"),
    completion_tokens: readNumber("candidatesTokenCount") ?? readNumber("outputTokenCount"),
    total_tokens: readNumber("totalTokenCount"),
  };
}

export async function generateScriptFromArticle(input: GenerateScriptFromArticleInput): Promise<ScriptGenerationResult> {
  const prompt = input.promptTemplate.replace("{content}", input.articleContent);
  const useThinkingLevel = input.model.startsWith("gemini-3");
  const thinkingConfig: Record<string, unknown> = {};
  if (useThinkingLevel) {
    thinkingConfig.thinkingLevel = input.thinkingLevel;
  }
  if (input.includeThoughts) {
    thinkingConfig.includeThoughts = true;
  }
  const response = await input.generateContent({
    model: input.model,
    systemInstruction: input.systemInstruction,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "エピソードタイトル（20文字以内）" },
          description: { type: "string", description: "エピソードの概要（500文字以内）" },
          script: { type: "string", description: "台本本文。各行を 'Host: セリフ' または 'CoHost: セリフ' の形式で改行区切りで記述" },
        },
        required: ["title", "description", "script"],
      },
      maxOutputTokens: 16000,
      temperature: 1.0,
      ...(Object.keys(thinkingConfig).length > 0 ? { thinkingConfig } : {}),
    },
  });

  const responseJson = toJsonObject(response);
  const tokenUsage = extractTokenUsage(responseJson);

  const responseWithCandidates = response as {
    text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  };

  const parts = responseWithCandidates.candidates?.[0]?.content?.parts ?? [];
  const thoughts = parts
    .filter((p) => p.thought === true && typeof p.text === "string")
    .map((p) => p.text as string);
  const answerTextFromParts = parts
    .filter((p) => p.thought !== true && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
  const rawText = responseWithCandidates.text
    ?? answerTextFromParts
    ?? "";

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`LLM returned invalid JSON: ${rawText.slice(0, 300)} — ${String(error)}`);
  }

  if (!data.title || !data.description || !data.script) {
    throw new Error(`LLM JSON missing expected keys. Got: ${JSON.stringify(Object.keys(data))}`);
  }

  return {
    title: String(data.title),
    description: String(data.description),
    script: String(data.script),
    thoughts,
    rawText,
    responseJson,
    tokenUsage,
  };
}

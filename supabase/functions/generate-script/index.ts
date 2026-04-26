import { GoogleGenAI } from "npm:@google/genai";
import { createSupabaseClient } from "../_shared/db.ts";
import { queueDelete, queueRead, queueSend } from "../_shared/queue.ts";
import { loadConfig } from "../_shared/config.ts";

const SYSTEM_INSTRUCTION = `\
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

const USER_PROMPT_TEMPLATE = `以下の記事を元に台本を作成してください。\n\n{content}`;

Deno.serve(async (_req) => {
  EdgeRuntime.waitUntil(processQueue());
  return Response.json({ ok: true });
});

async function processQueue(): Promise<void> {
  const db = createSupabaseClient();
  const msg = await queueRead(db, "script-queue");
  if (!msg) return;

  const articleId = msg.message.article_id as string;

  try {
    const { data: article, error: fetchErr } = await db
      .from("articles")
      .select("content")
      .eq("id", articleId)
      .single();
    if (fetchErr || !article) throw new Error(`Article not found: ${articleId}`);

    const cfg = await loadConfig();
    const gemini = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });

    const prompt = USER_PROMPT_TEMPLATE.replace("{content}", article.content);
    const response = await gemini.models.generateContent({
      model: cfg["generator.model"] || "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title:       { type: "string", description: "エピソードタイトル（20文字以内）" },
            description: { type: "string", description: "エピソードの概要（100文字以内）" },
            script:      { type: "string", description: "台本本文。各行を 'Host: セリフ' または 'CoHost: セリフ' の形式で改行区切りで記述" },
          },
          required: ["title", "description", "script"],
        },
      },
    });

    // Extract text — try text getter, then candidates path
    const parts = response?.candidates?.[0]?.content?.parts ?? [];
    const rawText = (response as unknown as { text?: string }).text
      ?? parts
        .filter((p: Record<string, unknown>) => typeof p.text === "string")
        .map((p: Record<string, unknown>) => p.text as string)
        .join("")
      ?? "";
    console.log("LLM raw response (first 300 chars):", rawText.slice(0, 300));

    // Parse the JSON the schema should guarantee
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`LLM returned invalid JSON: ${rawText.slice(0, 300)} — ${e}`);
    }
    if (!data.title || !data.description || !data.script) {
      throw new Error(`LLM JSON missing expected keys. Got: ${JSON.stringify(Object.keys(data))}`);
    }

    const { data: episode, error: insertErr } = await db
      .from("episodes")
      .insert({
        article_id: articleId,
        title: String(data.title).slice(0, 20),
        description: String(data.description).slice(0, 100),
        script: String(data.script),
        status: "script_ready",
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(`Episode insert failed: ${insertErr.message}`);

    await queueSend(db, "audio-queue", { episode_id: episode.id });
    await queueDelete(db, "script-queue", msg.msg_id);
    console.log(`Script generated for article ${articleId}, episode ${episode.id}`);
  } catch (err) {
    console.error(`generate-script failed for article ${articleId}:`, err);
    await db.from("episodes").insert({
      article_id: articleId,
      title: "Error",
      description: "",
      script: "",
      status: "failed",
      error: String(err),
    });
    await queueDelete(db, "script-queue", msg.msg_id);
  }
}

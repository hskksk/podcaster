from __future__ import annotations

import json
from dataclasses import dataclass

from litellm import completion

DEFAULT_SYSTEM_INSTRUCTION = """\
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
}
"""

DEFAULT_PROMPT_TEMPLATE = """\
以下の記事を元に台本を作成してください。

{content}
"""


@dataclass
class ScriptResult:
    title: str
    description: str
    script: str


class ScriptGenerator:
    """Generate a podcast script from article content using litellm."""

    def __init__(self, model: str = "openai/gpt-5-mini") -> None:
        self.model = model

    def generate(
        self,
        content: str,
        system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION,
        prompt: str = DEFAULT_PROMPT_TEMPLATE,
    ) -> ScriptResult:
        """Generate a podcast script with title and description from article content.

        Args:
            content: Source article text.
            system_instruction: System message defining the model's persona and rules.
            prompt: User message template. Use ``{content}`` as a placeholder.

        Returns:
            ScriptResult with title, description, and script text.
        """
        user_message = prompt.format(content=content)

        response = completion(
            model=self.model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content.strip()
        data = json.loads(raw)
        return ScriptResult(
            title=data["title"],
            description=data["description"],
            script=data["script"],
        )

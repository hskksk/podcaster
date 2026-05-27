# AIセキュリティプロキシOSS完全ガイド — LLMを守るオープンソースツール最前線

## 概要

大規模言語モデル（LLM）が企業システムに深く組み込まれる今、AIそのものを狙う攻撃が急増している。プロンプトインジェクション、個人情報の漏洩、ジェイルブレイク、モデルサプライチェーン汚染——これらはOWASP LLM Top 10 2025に列挙された現実の脅威だ。

こうした課題に対し、OSSコミュニティはLLMへのリクエスト・レスポンスを監視・フィルタリング・保護する多様なツールを生み出している。本レポートでは「AIセキュリティプロキシ」を広義に捉え、APIゲートウェイ、ランタイムガードレール、セーフティ分類モデル、PII保護、レッドチーミングツール、サプライチェーン対策まで、ローカル動作が可能なOSSプロジェクトを網羅的に解説する。

---

## 背景・歴史

### なぜ「プロキシ」でLLMを守るのか

2023年以前、AI安全性の議論は主にモデルのアラインメント（価値観の整合）に集中していた。しかし、ChatGPTなどのLLMが企業のコードやデータに接続する「エージェント」として利用されるようになると、従来のアプリケーションセキュリティと全く同じ問題——入力値の検証不足、認証・認可の不備、機密情報の漏洩——がAI固有の形で再現されることが明らかになった。

「プロキシでLLMを守る」アイデアはAPIゲートウェイの発展形だ。通常のAPIプロキシがレート制限やルーティングを担うように、AIセキュリティプロキシはLLMへのリクエストと応答を検査し、有害なコンテンツや機密情報が往来しないようにする。

### OSSエコシステムの成熟

2024〜2025年にかけてエコシステムは急速に成熟した。主要なターニングポイントは以下の通りだ。

- **2024年初頭**: NeMo Guardrails（NVIDIA）、Guardrails AI、LLM Guard（ProtectAI）が実運用に耐える水準に達する
- **2024年後半**: LiteLLMがProxy機能を大幅強化し、エンタープライズ向けセキュリティ機能（レート制限、予算管理、監査ログ）を搭載
- **2025年4月**: MetaがLlamaFirewallを公開。エージェント環境に特化した多層防御を提供
- **2025年7月**: Palo Alto NetworksがProtect AIを買収。LLM GuardとModelScanのOSS版は継続
- **2025年10月**: OpenAIがgpt-oss-safeguardをApache 2.0で公開。20Bと120BのモデルをOllamaでローカル実行可能に
- **2026年3月**: PortkeyがゲートウェイをフルOSS化。ガバナンスと可観測性も含めて無償提供
- **2026年5月**: PipelockがMCPセキュリティに対応したエージェントファイアウォールとしてv2.4.0をリリース

---

## OWASP LLM Top 10 2025 — 攻撃の地図

ツールを理解する前に、防御すべき脅威の地図を把握しよう。OWASP LLM Top 10 2025は以下の10項目を定義している。

| 順位 | リスク | 説明 |
|------|--------|------|
| LLM01 | プロンプトインジェクション | ユーザー入力でLLMの挙動を操作 |
| LLM02 | 機密情報の漏洩 | 学習データや会話内容の漏洩 |
| LLM03 | サプライチェーン脆弱性 | 悪意あるモデルや依存関係の混入 |
| LLM04 | データ・モデル汚染 | 学習データへの攻撃 |
| LLM05 | 不適切な出力処理 | LLM出力の安全でない使用 |
| LLM06 | 過剰な機能・権限 | エージェントへの過剰な権限付与 |
| LLM07 | システムプロンプト漏洩 | システムプロンプトの暴露 |
| LLM08 | ベクトル・埋め込み脆弱性 | RAGへの攻撃 |
| LLM09 | 誤情報 | ハルシネーションによる誤情報 |
| LLM10 | 無制限消費 | コスト爆発、サービス劣化 |

2025年版の特筆点は、RAGアーキテクチャの普及を受けてベクトルDB関連の脆弱性（LLM08）が独立項目化されたこと、およびエージェント型AIのリスクを扱う「Top 10 for Agentic AI」が別途公開されたことだ。

---

## 核となる概念

### AIセキュリティプロキシの4層モデル

現代のAIセキュリティプロキシは概ね4つの層で構成される。

**第1層: トラフィック制御層**
- レート制限（RPM/TPM）、コスト予算管理
- 認証・認可（APIキー、JWT、OAuth）
- ロードバランシング、フェイルオーバー
- 代表ツール: LiteLLM、Portkey、Bifrost、Kong AI Gateway

**第2層: コンテンツ検査層**
- プロンプトインジェクション検出
- 毒性・有害コンテンツのフィルタリング
- 禁止トピック・キーワードのブロック
- 代表ツール: LLM Guard、NeMo Guardrails、LlamaFirewall

**第3層: データ保護層**
- PII（個人情報）検出と仮名化・削除
- シークレット（APIキー、パスワード）漏洩防止
- DLP（データ損失防止）ポリシー適用
- 代表ツール: Microsoft Presidio、Pipelock

**第4層: セーフティ分類層**
- 入力・出力をMLモデルで安全性分類
- ハザードカテゴリへのマッピング
- チェーン・オブ・ソートによる判断根拠の透明化
- 代表ツール: Llama Guard 3、GPT-OSS Safeguard、PromptGuard 2

---

## 主要OSSツール詳解

### カテゴリ1: LLMゲートウェイ / APIプロキシ

#### LiteLLM

**概要**: 100以上のLLMプロバイダーへのアクセスを統一OpenAI互換APIで提供する、最も広く使われているOSSプロキシ。MITライセンス。GitHub Stars: 20,000超。

**セキュリティ機能**:
- APIキー管理（仮想キーでプロバイダーキーを隠蔽）
- RPM/TPMレート制限（モデル・チーム・ユーザー単位）
- 予算上限（日次・月次）の強制
- 監査ログ（全リクエスト・レスポンスの記録）
- 内蔵コンテンツフィルター（LiteLLM Content Filter）
- Guardrails AI、NeMo Guardrailsとの統合

**ローカル動作**: 完全対応。`docker compose up`で即起動。OllamaなどのローカルLLMも`ollama/llama3`形式で接続可能。

```bash
# Dockerで起動（PostgreSQL連携）
docker run -e DATABASE_URL=... ghcr.io/berriai/litellm:main-latest --config config.yaml
```

**アーキテクチャの特徴**: Pythonベースのため、大規模高負荷環境ではPythonのGILがボトルネックになりうる。5,000RPS以上では複数インスタンス＋ロードバランサー構成が推奨。

**ユースケース**: 複数LLMプロバイダーの統一管理、コスト可視化、チームごとのアクセス制御、OllamaとOpenAI APIの統合ゲートウェイ。

---

#### Portkey Gateway

**概要**: 1,600以上のLLMへの統一ルーティングと50以上のガードレールを<1msのレイテンシで提供するAIゲートウェイ。2026年3月にフルOSS化（MIT）。GitHub Stars: 7,000超。

**セキュリティ機能**:
- セキュアなAPIキー管理
- PII削除（リクエスト送信前のマスキング）
- インバウンドルール（アクセス制御）
- セマンティックキャッシュ
- SOC2、ISO、HIPAA、GDPR準拠対応
- Ollamaをはじめとするローカルモデルとのシームレス統合

**ローカル動作**: 完全対応。122KBの軽量バイナリで動作。

```bash
# npmで即起動
npx @portkey-ai/gateway

# Dockerで起動
docker run -p 8787:8787 portkeyai/gateway:latest
```

**特筆点**: 2026年3月のフルOSS化により、ガバナンス・可観測性・認証機能がSaaSサブスクリプション不要で利用可能になった。1日に2兆トークンを処理する実績から生まれた戦闘済みコードベース。

---

#### Bifrost

**概要**: Goで書かれた高性能AIゲートウェイ。LiteLLMと同等機能を持ちながら、ベンチマークでLiteLLMの50〜54倍の性能を発揮。Apache 2.0ライセンス。

**性能比較（500 RPS持続負荷時）**:
| 指標 | Bifrost | LiteLLM |
|------|---------|---------|
| P99レイテンシ | 1.68秒 | 90.72秒 |
| スループット | 424 req/s | 44.84 req/s |
| メモリ使用量 | 120MB | 372MB |
| リクエストオーバーヘッド | 11µs | - |

**セキュリティ機能**:
- セマンティックキャッシング
- 予算管理・レート制限
- MCP（Model Context Protocol）サポート
- OpenTelemetryによる可観測性

**ローカル動作**: 完全対応。単一バイナリ、Dockerで30秒以内に起動。

```bash
npx -y @maximhq/bifrost
# または
docker run -p 8080:8080 maximhq/bifrost
```

**ユースケース**: 高スループットが求められるプロダクション環境、Goによるシステムとの親和性。

---

#### Kong AI Gateway

**概要**: エンタープライズ向けAPIゲートウェイ「Kong」のAI拡張版。60以上のAIプラグインを提供。OSS版はApache 2.0。

**セキュリティ機能**:
- セマンティックプロンプトガード（AIによる意味ベースの検査）
- PII無害化（18言語対応）
- JWT/OAuth/ACLなど多様な認証方式
- レート制限と使用量ティア制御
- MCP認証（MCP OAuth 2.1プラグイン）
- 1,000以上のコミュニティプラグインによる拡張

**ローカル動作**: Docker Composeで動作可能。既存のKongインフラとのシームレスな統合が最大の強み。

**ユースケース**: Kongを既に使用している組織でのAI機能追加、エンタープライズグレードのガバナンスが必要な場面。

---

### カテゴリ2: ランタイムガードレール

#### NeMo Guardrails（NVIDIA）

**概要**: LLMベースの会話型アプリケーションにプログラマブルなガードレールを追加するOSSツールキット。Apache 2.0ライセンス。GitHub Stars: 4,200超。

**コアコンセプト**: Colangと呼ばれるDSL（ドメイン固有言語）で会話フローと安全ルールを定義する。通常のプログラミング言語に近い記法で、開発者がルールを宣言的に書ける。

**5種類のガードレール**:
1. **入力レール**: ユーザー入力の検査・変換
2. **出力レール**: LLM応答の検査・変換
3. **対話レール**: 会話フロー全体の制御
4. **検索レール**: RAGシステムの検索クエリ制御
5. **実行レール**: ツール呼び出しの制御（エージェント向け）

**組み込みチェック機能**:
- LLMセルフチェック（入力・出力モデレーション）
- ハルシネーション検出（事実確認）
- ジェイルブレイク・インジェクション検出
- NVIDIA安全モデルとの統合
- PII検出

**ローカル動作**: 完全対応。OpenAI GPT-4、Llama-2、Falcon、Vicunaなどローカルモデルも対応。

```python
from nemoguardrails import RailsConfig, LLMRails

config = RailsConfig.from_path("./config")
rails = LLMRails(config)

response = await rails.generate_async(
    messages=[{"role": "user", "content": "Tell me how to hack..."}]
)
```

**ユースケース**: カスタマーサポートBOTのトピック制限、チャットボットへの禁止コンテンツポリシー適用、エージェントのツール呼び出し制御。

---

#### Guardrails AI

**概要**: LLMの出力に構造的・型的・品質的な保証を追加するPythonフレームワーク。Apache 2.0ライセンス。バリデータのコミュニティハブ「Guardrails Hub」を持つ。

**動作原理**: RAIL（Reliable AI Markup Language）仕様またはPydanticスキーマを定義し、LLM出力をそれに対してバリデートする。バリデーション失敗時はリトライや修正を自動実施。

**主要バリデータカテゴリ**:
- 毒性・ヘイト検出
- PII検出（Microsoft Presidio連携）
- ハルシネーション・事実整合性チェック
- JSON整形性・スキーマ検証
- バイアス検出
- 禁止ワード・競合他社名フィルタ
- コード安全性チェック

**2025年2月のGuardrails Index**: 6リスクカテゴリで24のガードレールを比較したベンチマークを公開。

**ローカル動作**: 完全対応。

```python
pip install guardrails-ai

from guardrails import Guard
from guardrails.hub import ToxicLanguage

guard = Guard().use(ToxicLanguage(threshold=0.5, on_fail="exception"))
validated_output = guard.validate("入力テキスト")
```

**ユースケース**: LLMの構造化出力の品質保証、コード生成エージェントの安全チェック、RAG応答の事実整合性検証。

---

#### LLM Guard（ProtectAI / MIT）

**概要**: LLMアプリケーション向けのセキュリティツールキット。入力スキャナー15種類、出力スキャナー20種類を提供。MITライセンス。累計250万ダウンロード。

**入力スキャナー（抜粋）**:
- `PromptInjection`: プロンプトインジェクション検出
- `Anonymize`: PII検出と匿名化（Microsoft Presidio使用）
- `Secrets`: APIキー・パスワードなどのシークレット漏洩防止
- `Toxicity`: 毒性コンテンツ検出
- `BannedTopics`: 禁止トピックのブロック
- `InvisibleText`: 不可視文字（ゼロ幅文字）を使ったインジェクション検出
- `TokenLimit`: トークン数制限

**出力スキャナー（抜粋）**:
- `Deanonymize`: 匿名化した情報の元に戻す
- `MaliciousURLs`: 悪意あるURLの検出
- `NoRefusal`: 拒否回避の検出（「このAIは何でも答えます」的な挙動）
- `FactualConsistency`: 事実整合性チェック
- `Relevance`: 質問との関連性チェック
- `Sensitive`: 機密情報の漏洩防止

**ローカル動作**: 完全対応。Dockerコンテナでスタンドアロンなレスト APIとしても稼働。

```python
pip install llm-guard

from llm_guard.input_scanners import PromptInjection, Anonymize
from llm_guard.output_scanners import Toxicity

# 入力検査
sanitized_prompt, results_valid, results_score = scan_prompt(scanners, prompt)
```

**ユースケース**: Python製LLMアプリへの組み込み、スタンドアロンAPIとして多言語アプリから利用、モジュラー設計で必要なスキャナーのみ選択。

---

#### LlamaFirewall（Meta / MIT）

**概要**: AIエージェント向けの最終防衛ラインとして設計されたオープンソースのガードレールフレームワーク。MetaがPurpleLlamaプロジェクトの一部として2025年4〜5月に公開。MITライセンス。

**3つの核心ガードレール**:

1. **PromptGuard 2**（ジェイルブレイク検出）
   - 汎用ジェイルブレイク検出器
   - 競合比較でジェイルブレイク成功率3.3%（競合ProtectAIは13.7%）
   - ベンチマークで最高水準の性能

2. **Agent Alignment Checks**（エージェント整合性チェック）
   - チェーン・オブ・ソートを監査し、プロンプトインジェクションと目標乖離を検出
   - エージェントの「思考プロセス」を監視することで、間接的なプロンプトインジェクションも検出

3. **CodeShield**（安全でないコード検出）
   - コーディングエージェントが生成するコードのオンライン静的解析エンジン
   - 高速かつ拡張可能な設計
   - インセキュアなコードや危険なコードの生成を防止

**性能**: AgentDojoベンチマークで攻撃成功率を90%以上削減。

**ローカル動作**: 完全対応。Metaのプロダクション環境でも使用。

**ユースケース**: LangChain、LangGraph、CrewAI、AutoGenなどのエージェントフレームワークへの最終防衛層の追加、コーディングエージェントのセキュリティ強化。

---

#### Pipelock（PipeLab / Apache 2.0）

**概要**: AIエージェントのアウトバウンドHTTP、WebSocket、MCPトラフィックを保護するエージェントファイアウォール。Go製の単一バイナリ（約20MB）。Apache 2.0ライセンス。2026年5月にv2.4.0をリリース。

**設計哲学「ケイパビリティ分離」**:
- エージェントプロセス: シークレット（APIキー等）を保持するが直接ネットワークアクセスなし
- プロキシプロセス: ネットワークアクセスを持つがシークレットなし
- 全トラフィックがスキャン境界を通過

**11層スキャンパイプライン**:
1. スキームチェック（https強制等）
2. CRLF インジェクション検出
3. パストラバーサルブロック
4. ドメインブロックリスト
5. DLP（データ損失防止、48種類の認証情報パターン）
6. パス・サブドメインエントロピー分析
7. SSRF保護
8. レート制限
9. URL長チェック
10. ドメインごとのデータ予算
11. 応答スキャン（25パターン、6種類の正規化処理）

**MCP対応**: 双方向MCPスキャン。MCPプロトコルでの通信も保護。

**ローカル動作**: 完全対応。Go単一バイナリなので依存関係なしで即起動。

**ユースケース**: MCPエージェントのセキュリティ、ゼロ依存でデプロイできるエージェントファイアウォール。

---

### カテゴリ3: セーフティ分類モデル（ローカル実行可能）

#### Llama Guard 3（Meta）

**概要**: LLMの入力と出力をコンテンツ安全性分類するLlama-3.1-8Bベースのファインチューニングモデル。MetaのPurpleLlamaプロジェクト。Metaライセンス（研究・商用利用可）。

**サイズバリアント**:
- **Llama Guard 3 1B**: デバイス上でのインライン入出力フィルタリングに対応する低レイテンシモデル
- **Llama Guard 3 8B**: メインストリーム。GPT-4を上回る精度、偽陽性率が低い
- **Llama Guard 3 Vision**: Llama-3.2-11Bベース、画像入力にも対応

**特徴**:
- MLCommons標準ハザード分類（14カテゴリ）に準拠
- 8言語対応の多言語安全分類
- マルチターン会話の分析
- 検索・コードインタープリターのツール呼び出し対応
- OllamaやvLLMでローカル実行可能

```bash
# Ollamaでローカル実行
ollama run llama-guard3

# 直接推論
curl http://localhost:11434/api/generate -d '{
  "model": "llama-guard3",
  "prompt": "User: [ユーザーの発言]\nAgent:"
}'
```

**ユースケース**: 既存パイプラインへの安全性フィルタとしての組み込み、軽量1Bモデルでのリアルタイム入出力監視。

---

#### GPT-OSS Safeguard（OpenAI / Apache 2.0）

**概要**: 2025年10月にOpenAIが公開した安全性分類専用のオープンウェイト推論モデル。Discordやセーフティ専門機関との共同開発。Apache 2.0ライセンス。

**独自のアプローチ「ポリシー駆動型分類」**:
- 従来の安全分類モデルは固定ルールベース
- GPT-OSS Safeguardは開発者が提供するポリシー（テキスト）を推論時に適用
- チェーン・オブ・ソートで判断根拠を透明化
- 未知のポリシーや外部ポリシーにも対応

**モデルサイズ**:
- **gpt-oss-safeguard-20b**: 16GB GPU（RTX 4090等）でローカル実行可能
- **gpt-oss-safeguard-120b**: H100クラスGPU（1枚）で実行可能

**ローカル動作**: 完全対応。OllamaやLM Studioで実行可能。Hugging FaceからApache 2.0でダウンロード。

```bash
# Ollamaで実行
ollama run gpt-oss-safeguard-20b
```

**ユースケース**: 組織固有のコンプライアンスポリシーに基づく分類、ファインチューニング不要のカスタム安全分類。

---

### カテゴリ4: PII・機密情報保護

#### Microsoft Presidio

**概要**: テキスト、画像、構造化データ全体にわたってPII（個人識別情報）を検出・仮名化・マスキング・匿名化するオープンソースフレームワーク。MITライセンス。

**コンポーネント**:
- **Presidio Analyzer**: NLPとパターンマッチングでPIIを検出し信頼スコアを付与
- **Presidio Anonymizer**: 検出されたPIIをマスク・置換・削除・暗号化

**対応PII種別（抜粋）**:
- クレジットカード番号、社会保障番号
- メールアドレス、電話番号
- IPアドレス、暗号通貨ウォレットアドレス
- 氏名、住所、生年月日
- APIキー、パスワード（カスタム拡張で）

**ローカル動作**: 完全対応。全処理がローカル環境内で完結し、データが外部に送信されない。Python/REST API/コンテナで利用可能。複数言語対応。

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

results = analyzer.analyze(text="私の名前は田中太郎で、電話番号は090-1234-5678です", language="ja")
anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
```

**LLMパイプラインへの統合**: LLMへリクエストを送る前にPresidioでPIIを検出・マスキングし、LLMの応答を受け取った後に元の値に戻す（Deanonymize）パターンが一般的。LangChainのモジュールとしても利用可能。

---

### カテゴリ5: レッドチーミング / 脆弱性スキャン

#### Garak（NVIDIA）

**概要**: LLMの脆弱性を体系的にスキャンする「LLM版Nessus」。Generative AI Red-teaming and Assessment Kitの略。MITライセンス。GitHub Stars: 7,500超。

**スキャン対象の脆弱性**:
- ハルシネーション・誤情報生成
- 学習データ漏洩
- プロンプトインジェクション
- ジェイルブレイク
- 毒性コンテンツ生成
- Base64エンコードによるフィルタ回避
- 過剰な権限行使

**動作方式**: 静的・動的・適応的プローブを組み合わせて最大20,000プロンプトでターゲットLLMを評価。結果はOWASP LLM Top 10にマッピングされたレポートとして出力。

**対応プラットフォーム**: OpenAI、Anthropic、HuggingFaceモデル、Replicate、Cohere、カスタムRESTエンドポイント（ローカルLLM対応）。

```bash
pip install garak
garak -m ollama -n llama3.1 --probes jailbreak,injection
```

**ユースケース**: リリース前のLLMアプリの脆弱性評価、継続的セキュリティテストのCI/CD組み込み。

---

#### Promptfoo

**概要**: LLMアプリのテスト・評価・レッドチーミングを行うCLIライブラリ。2026年3月にOpenAIに買収されたが、MITライセンスのOSSとして継続。GitHub Stars: 10,400超。月間アクティブユーザー13万人。

**セキュリティ機能**:
- 50以上の脆弱性タイプのカバー（インジェクションからジェイルブレイクまで）
- AIエージェント駆動の適応的攻撃生成（静的プロンプトに依存しない）
- OWASP LLM Top 10、NIST AI RMF、MITRE ATLASへのマッピング
- CI/CDへのシームレスな統合

**宣言的設定によるテスト定義**:
```yaml
providers:
  - openai:gpt-4
  - ollama:llama3.1

redteam:
  plugins:
    - prompt-injection
    - jailbreak
    - pii
  strategies:
    - jailbreak
    - base64
```

**特徴**: Fortune 500企業の25%が採用。OpenAI、Anthropicも社内利用。

---

#### PyRIT（Microsoft）

**概要**: Microsoft Azureが公開したジェネレーティブAI向けリスク識別ツール。MIT ライセンス。GitHub Stars: 3,800超。

**コンポーネント**:
- **Targets**: テスト対象のAIシステム
- **Converters**: プロンプト変換（Base64、音声、画像、数学的変換）
- **Scorers**: 応答の評価（Azure Content Safetyとの統合）
- **Orchestrators**: マルチターン会話の複雑な攻撃チェーン管理

**高度な機能**:
- XPIAOrchestrator: クロスドメインプロンプトインジェクション攻撃
- DuckDBでの会話履歴・スコアリングデータ管理
- Azure AI Foundryの「AI Red Teaming Agent」として統合

**ユースケース**: Azureエコシステムと統合した包括的なレッドチーミング、エンタープライズレベルの攻撃キャンペーン自動化。

---

### カテゴリ6: サプライチェーン対策

#### ModelScan（ProtectAI / Apache 2.0）

**概要**: AIモデルファイルのサプライチェーン攻撃（シリアライゼーション攻撃）を検出する業界初のOSSスキャナー。Apache 2.0ライセンス。

**攻撃シナリオ**: PyTorchのPickleシリアライゼーション形式にはコード実行を仕込める。悪意ある行為者がHugging Faceにマルウェアを埋め込んだモデルをアップロードし、ダウンロードした組織のシステムで任意コードが実行される——これが「モデルシリアライゼーション攻撃」だ。

**動作方式**: モデルファイルをロードせずにバイト単位で読み込み、Pickleオペコードストリームを検査し危険なcallableを識別。

**対応フォーマット**: PyTorch (.pt, .pth)、TensorFlow/Keras (.h5, SavedModel)、Sklearn、XGBoost

```bash
pip install modelscan
modelscan -p ./models/my_model.pt
```

**ユースケース**: Hugging Faceからのモデルダウンロード前のスキャン、CI/CDパイプラインへの組み込み、MLOpsワークフローのセキュリティゲート。

---

## ツール比較マトリックス

| ツール | カテゴリ | ライセンス | 言語 | ローカル動作 | 主な用途 |
|--------|---------|-----------|------|------------|---------|
| LiteLLM | APIプロキシ | MIT | Python | ○ | 多プロバイダー統合、コスト管理 |
| Portkey Gateway | APIプロキシ | MIT | TypeScript | ○ | 軽量ゲートウェイ、PII削除 |
| Bifrost | APIプロキシ | Apache 2.0 | Go | ○ | 高スループット環境 |
| Kong AI Gateway | APIプロキシ | Apache 2.0 | Lua/Go | ○ | エンタープライズ既存Kong統合 |
| NeMo Guardrails | ランタイムガードレール | Apache 2.0 | Python | ○ | 会話フロー制御、エージェント |
| Guardrails AI | ランタイムガードレール | Apache 2.0 | Python | ○ | 構造化出力検証 |
| LLM Guard | ランタイムガードレール | MIT | Python | ○ | モジュラーなスキャン |
| LlamaFirewall | ランタイムガードレール | MIT | Python | ○ | エージェントの最終防衛 |
| Pipelock | エージェントファイアウォール | Apache 2.0 | Go | ○ | MCP・アウトバウンド制御 |
| Llama Guard 3 | 分類モデル | Meta License | PyTorch | ○ | インライン安全フィルタ |
| GPT-OSS Safeguard | 分類モデル | Apache 2.0 | PyTorch | ○ | ポリシー駆動型分類 |
| Microsoft Presidio | PII保護 | MIT | Python | ○ | PII検出・匿名化 |
| Garak | レッドチーミング | MIT | Python | ○ | 脆弱性スキャン |
| Promptfoo | レッドチーミング | MIT | TypeScript | ○ | CI/CDテスト統合 |
| PyRIT | レッドチーミング | MIT | Python | ○ | エンタープライズレッドチーム |
| ModelScan | サプライチェーン | Apache 2.0 | Python | ○ | モデルファイルスキャン |

---

## 詳細な仕組み・アーキテクチャ

### リクエスト・レスポンスのライフサイクル

AIセキュリティプロキシを通過するリクエストの典型的なライフサイクルは以下の通りだ。

```
ユーザー/アプリ
    |
    v
[第1層: トラフィック制御]
  認証・認可 → レート制限チェック → 予算チェック
    |
    v（制限超過・未認証なら拒否）
[第2層: 入力コンテンツ検査]
  PII検出・匿名化 → シークレット検出 → プロンプトインジェクション検出
  → トピックフィルタ → 毒性チェック → トークン数制限
    |
    v（有害コンテンツなら拒否）
[第3層: セーフティ分類（オプション）]
  Llama Guard / GPT-OSS Safeguardによる分類
    |
    v（Unsafe判定なら拒否）
LLMプロバイダー（OpenAI/Anthropic/ローカルOllama等）
    |
    v
[第4層: 出力コンテンツ検査]
  PII逆匿名化 → 有害URL検出 → 機密情報フィルタ
  → 事実整合性チェック → 関連性チェック → 毒性チェック
    |
    v（有害出力なら修正・拒否）
ユーザー/アプリ
```

### エージェント環境での追加レイヤー

AIエージェントがツール呼び出し（Web検索、コード実行、ファイル操作等）を行う場合、追加の保護が必要だ。

**間接プロンプトインジェクション問題**: エージェントが外部ソース（Webページ、PDFファイル、APIレスポンス）を処理する際、その外部コンテンツに「以前の指示を忘れて...」と書かれていると、エージェントが攻撃者の意図した行動をとってしまう。

LlamaFirewallのAgent Alignment Checks、PipelockのMCPスキャン、NeMo GuardrailsのExecution Railsがこれに対応する。

---

## 具体例・応用事例

### 事例1: 企業内チャットボットのセキュリティ強化

**課題**: 従業員向けチャットボットに機密文書（契約書、人事情報）がRAGとして接続されており、プロンプトインジェクションや機密漏洩が懸念された。

**構成**:
```
社内アプリ → LiteLLM Proxy（認証・レート制限）
          → NeMo Guardrails（トピック制限・禁止質問）
          → Microsoft Presidio（PII マスキング）
          → OpenAI GPT-4
```

**結果**: PII含む回答の自動マスキング、禁止トピック（他社比較、給与情報）への回答拒否、1ユーザーあたりのレート制限を実現。

### 事例2: ローカルLLM環境のフル構築

**課題**: データを一切外部に送信できない医療系スタートアップが、GPUサーバー上でLLMを動かしつつセキュリティを確保したい。

**構成**:
```
アプリ → Portkey Gateway（ローカルデプロイ）
       → LLM Guard（プロンプトインジェクション・PII検出）
       → Ollama + Llama-3.1-8B（ローカル推論）
       → Llama Guard 3 1B（出力の安全性分類）
```

**特徴**: 全コンポーネントがローカルで動作し、患者情報が外部に送信されることはない。GPUを効率的に活用。

### 事例3: コーディングエージェントのセキュリティ強化

**課題**: GitHub Actions上でコードを自動生成するエージェントが、インセキュアなコードを生成したり、プロンプトインジェクションによって意図しないファイルを書き換えたりするリスク。

**構成**:
```
コーディングエージェント → LlamaFirewall
  (PromptGuard 2: ジェイルブレイク防止)
  (CodeShield: 生成コードの静的解析)
  (AlignmentCheck: エージェントの目標乖離検出)
→ ModelScan（使用するモデルのスキャン）
→ Promptfoo（CI/CDでの定期脆弱性テスト）
```

---

## 重要人物・文献

### 研究・論文

- **「LlamaFirewall: An open source guardrail system for building secure AI agents」** (Meta AI, arXiv:2505.03574, 2025) — LlamaFirewallの設計思想と評価
- **「Evaluating the Robustness of Large Language Model Safety Guardrails Against Adversarial Attacks」** (arXiv:2511.22047, 2025) — ガードレールの堅牢性評価
- **「No Free Lunch with Guardrails」** (arXiv:2504.00441, 2025) — ガードレールのトレードオフ分析
- **「TraceSafe: A Systematic Assessment of LLM Guardrails on Multi-Step Tool-Calling Trajectories」** (arXiv:2604.07223, 2026) — エージェント環境でのガードレール評価

### 標準・フレームワーク

- **OWASP Top 10 for LLM Applications 2025** — LLMリスクの業界標準定義
- **OWASP Top 10 for Agentic AI Systems** — エージェントAI専用リスク分類（2025年末公開）
- **MLCommons AI Safety Taxonomy** — Llama Guard 3が準拠するハザード分類体系
- **NIST AI Risk Management Framework (AI RMF)** — 米国標準技術研究所のAIリスク管理枠組み
- **MITRE ATLAS** — AI特化型の攻撃・技術マトリックス

---

## 最新動向・未解決問題

### 2025〜2026年の主要トレンド

**1. エージェントAIセキュリティへのシフト**

2024年まではチャットボット（単発の入出力）向けガードレールが中心だったが、2025年からはマルチステップでツールを使うエージェントへの対応が急加速。LlamaFirewall、Pipelock、NeMo GuardrailsのExecution Railsがその象徴。

**2. MCPセキュリティの台頭**

Model Context Protocol（MCP）の普及に伴い、MCPサーバーへのアクセス制御が新たな課題に。PipelockはMCPに特化した双方向スキャンを提供。KongもMCP OAuth 2.1対応プラグインをリリース。

**3. 商業化とOSSの共存**

- Protect AIのPalo Alto Networks買収（2025年7月）
- PromptfooのOpenAI買収（2026年3月）
- Lakera GuardのCheck Point買収（2025年）

これらの買収後も、中核OSSツール（LLM Guard、Promptfoo等）はMITライセンスで継続。エコシステムの基盤としてのOSSの重要性が業界で認識されている。

**4. ローカルセーフティモデルの成熟**

GPT-OSS Safeguard（20B）がOllamaで動作し、Llama Guard 3 1Bがデバイス上のリアルタイムフィルタとして使えるようになった。クラウドAPIを使わずに高精度の安全分類が可能になってきた。

**5. ガードレールのベンチマーク整備**

Fiddler AI「2025 Enterprise Guardrails Benchmarks Report」、Guardrails AI「Guardrails Index」など、ガードレールを客観評価する指標が整備されつつある。Qwen3Guard-8Bが全体精度85.3%でトップ。

### 未解決の課題

**過検出（偽陽性）問題**: 積極的なガードレールは正当なリクエストも誤ってブロックする。ビジネス用途によってはユーザー体験に深刻な影響。「No Free Lunch with Guardrails」論文が体系的に論じている。

**多段階・間接攻撃への対応**: 悪意ある外部コンテンツを経由する間接プロンプトインジェクションは、単純な入力フィルタでは防げない。LlamaFirewallのAlignment Checkも完全解決には至っていない。

**マルチモーダルへの対応**: テキストベースのガードレールは画像・音声・動画を処理するマルチモーダルエージェントには不十分。LlamaFirewallが画像対応を開発中。

**レイテンシとセキュリティのトレードオフ**: 複数のスキャナーを重ねるとレイテンシが増大。Azure Content Safetyの52ms vs LLM Guardの高精度版192msのような選択が生じる。

---

## 関連トピック

### RAGセキュリティ

RAG（検索拡張生成）アーキテクチャでは、ベクトルDBへの毒入れ（Vector Poisoning）が新たな攻撃経路になる。OWASP LLM08（ベクトル・埋め込み脆弱性）への対応が必要で、DeepEvalやRAGASを使った評価フレームワークと組み合わせることが重要。

### ゼロトラストとAIセキュリティ

企業のゼロトラストアーキテクチャにAIゲートウェイを組み込む動きが活発化。Pomerium、Cloudflare Access等のゼロトラストプロキシとLiteLLM・Portkeyの組み合わせが紹介されている。

### コンプライアンス対応

GDPR（EU個人情報保護）、HIPAA（米国医療情報保護）、EU AI Act（2025年施行）への対応として、PII削除とプロンプト・応答の監査ログが必須要件になりつつある。LiteLLM、Portkey、Kong AI Gatewayはこれらのコンプライアンス要件への対応を謳っている。

### AI SPM（AIセキュリティポスチャ管理）

AIシステムのセキュリティ態勢を継続的に評価・監視するAI SPM（AI Security Posture Management）カテゴリが台頭。個々のガードレールと組み合わせて、組織全体のAIリスクを一元管理する考え方。

---

## 参考リンク

- [LlamaFirewall - Meta AI Research](https://ai.meta.com/research/publications/llamafirewall-an-open-source-guardrail-system-for-building-secure-ai-agents/)
- [LiteLLM AI Gateway ドキュメント](https://docs.litellm.ai/docs/simple_proxy)
- [Portkey Gateway GitHub](https://github.com/Portkey-AI/gateway)
- [Bifrost GitHub (maximhq)](https://github.com/maximhq/bifrost)
- [Kong AI Gateway ドキュメント](https://developer.konghq.com/ai-gateway/)
- [NeMo Guardrails GitHub](https://github.com/NVIDIA-NeMo/Guardrails)
- [Guardrails AI GitHub](https://github.com/guardrails-ai/guardrails)
- [LLM Guard GitHub](https://github.com/protectai/llm-guard)
- [Pipelock GitHub](https://github.com/luckyPipewrench/pipelock)
- [Llama Guard 3 on HuggingFace](https://huggingface.co/meta-llama/Llama-Guard-3-8B)
- [GPT-OSS Safeguard on HuggingFace](https://huggingface.co/openai/gpt-oss-safeguard-20b)
- [Microsoft Presidio GitHub](https://github.com/microsoft/presidio)
- [Garak GitHub](https://github.com/NVIDIA/garak)
- [Promptfoo GitHub](https://github.com/promptfoo/promptfoo)
- [PyRIT GitHub](https://github.com/Azure/PyRIT)
- [ModelScan GitHub](https://github.com/protectai/modelscan)
- [OWASP LLM Top 10 2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [AI Security Tools Complete Guide - SlashLLM](https://slashllm.com/resources/ai-security-tools-guide)
- [Best LLM Gateways 2025 - Pomerium](https://www.pomerium.com/blog/best-llm-gateways-in-2025)
- [Fiddler AI Enterprise Guardrails Benchmarks 2025](https://www.fiddler.ai/guardrails-benchmarks)

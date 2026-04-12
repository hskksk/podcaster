# podcaster

記事テキスト（Markdown など）を入力として、**対話形式のポッドキャスト台本を LLM で生成**し、**VoiceCraft で音声化**して RSS を更新するためのツールです。HTTP サーバーで `feed.xml` と音声ファイルを配信します。

## できること

- **台本生成**（`src/podcast_gen/generator.py`）: LiteLLM 経由で、Host / CoHost の 2 人掛け合いの日本語台本（タイトル・説明・本文）を JSON で受け取る
- **音声合成**（`src/rss_manager.py`）: [VoiceCraft](https://github.com/hskksk/voicecraft) のマルチスピーカー合成で M4A を出力
- **配信**: `public/` をルートに静的配信（ポート 8080）、`feed.xml` を生成・更新
- **入力の監視**: `inbox/` に置いたファイルを一定間隔で検知し、処理後に削除

Claude Code 用のスキル [`.claude/podcast-research/SKILL.md`](.claude/podcast-research/SKILL.md) では、テーマ調査レポートを `draft/` に書き、`inbox/` にコピーしてこのパイプラインに渡す流れを定義しています。

## 要件

- Python **3.12 以上**
- [uv](https://docs.astral.sh/uv/)（推奨）または同等の仮想環境
- **API キー**（コード内のモデル設定に依存）
  - 台本: 既定は `openai/gpt-5-mini`（LiteLLM の [環境変数](https://docs.litellm.ai/docs/providers/openai) 例: `OPENAI_API_KEY`）
  - 音声: 既定は `gemini/gemini-2.5-flash-preview-tts`（Gemini 向けのキー設定が必要）

## セットアップ

リポジトリのルートで:

```bash
uv sync
```

依存の `voicecraft` は `pyproject.toml` から Git 参照で取り込みます。

## 設定

`src/rss_manager.py` 内の定数で挙動が決まります。

| 項目 | 内容 |
|------|------|
| `BASE_URL` | RSS の `<enclosure>` や `<image>` に使う公開 URL（既定はプレースホルダ的な値のため、**運用環境に合わせて変更**してください） |
| `ScriptGenerator` の `model` | 台本生成に使う LiteLLM モデル名 |
| `VOICECRAFT_MODEL` / `VOICECRAFT_CONFIG` | VoiceCraft のモデルとスピーカー（Charon / Achird など） |

チャンネル名や説明文は `update_rss()` 内の RSS テンプレートにあります。

## 使い方

1. 必要な環境変数で API キーを設定する
2. サーバーを起動する

```bash
uv run python src/rss_manager.py
```

3. 記事本文のテキストファイルを **`inbox/`** に置く（拡張子は問わず、ファイル単位で処理）
4. 処理が終わると台本は `scripts/`、音声は `public/audio/`、フィードは `public/feed.xml` に出力されます（`.gitignore` によりリポジトリには含めない想定）

起動時に既存の `public/feed.xml` があれば読み込み、エピソード一覧を引き継ぎます。

## ディレクトリ

| パス | 役割 |
|------|------|
| `inbox/` | 入力待ちテキスト（処理後に削除） |
| `scripts/` | 生成された台本（Markdown 風のテキスト） |
| `public/` | HTTP 配信ルート（`feed.xml`、`audio/`、`cover.png` など） |
| `draft/` | スキル利用時の調査ドラフト置き場 |

## 開発メモ

- エントリーポイントとして動かすのは主に **`src/rss_manager.py`** です。ルートの `main.py` はサンプルのままです。
- パッケージ名は `pyproject.toml` の `podcaster` ですが、インポートは `src/` 上の `podcast_gen` を `rss_manager.py` から参照する構成です。

## ライセンス

リポジトリに LICENSE ファイルが無い場合は、利用条件をリポジトリオーナーに確認してください。

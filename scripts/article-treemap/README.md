# Article treemap sidecar tooling

## Production (agent workflow)

| Script | Role |
|--------|------|
| `extract_nodes.ts` | Emit node manifest JSON (`id`, excerpts, `needsLabel`, chapters, `sourceSha256`). |
| `validate_treemap.ts` | Check `treemap.yml` next to `index.mdoc`. |

**`treemap.yml` の中身（ラベル・リンク）はエージェントが `article-treemap-labels` スキルに従って書く。** マニフェストと本文を読んで YAML を編集し、最後に `validate_treemap.ts` だけ実行する。

## `_dev/` (local stubs only)

Mechanical helpers for smoke tests or empty sidecars. **記事 PR・`podcast-research2` では使わない。** 要約や論理リンクの品質はスキル側の判断に任せる。

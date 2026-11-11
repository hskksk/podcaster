# Article section-visuals tooling

設計: [`docs/architecture/article-section-visuals.md`](../../docs/architecture/article-section-visuals.md)

## 導入順とこのディレクトリの役割

| Step | 内容 | 状態（podcaster） |
| --- | --- | --- |
| 1 | Cloudflare 記事由来の fixture | `fixtures/cloudflare-os.section-visuals.yml` |
| 2 | `@hskksk/markdoc-react` に Article Visual engine | **`packages/markdoc-react` 0.7.0**（upstream publish 待ち） |
| 3 | `apps/web` loader と responsive layout | **完了**（loader・rail・mobile slot） |
| 4 | validator と repository check | **完了**（parser は markdoc-react `/section-visual` と共有） |
| 5 | `article-section-visuals` スキル | 未着手 |
| 6 | `podcast-research2` 連携 | 未着手 |
| 7 | pilot 比較と上限固定 | 未着手 |

Step 1 の fixture を記事横へ置くときは、次で検証する。

```bash
cp scripts/article-section-visuals/fixtures/cloudflare-os.section-visuals.yml \
  content/docs/20261110_182100_cloudflare_cloudflare_os/section-visuals.yml
pnpm section-visuals:validate content/docs/20261110_182100_cloudflare_cloudflare_os/index.mdoc
```

## Commands

| Script | Role |
| --- | --- |
| `extract_sections.ts` | Section manifest JSON（`id`, 行範囲, `body`, `sourceSha256`） |
| `validate_section_visuals.ts` | `section-visuals.yml` の envelope と Article Visual spec v1 |
| `check_all_section_visuals.ts` | `content/docs` / `content/web-clips` 内の sidecar を一括検証 |

`spec-v1.ts` は `@hskksk/markdoc-react/section-visual` の re-export である。

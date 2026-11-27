# Knowledges PR → Vercel Preview (branch mirror)

本文プレビューは **knowledges の PR** から **podcaster** に同期ブランチを作り、Vercel の **Preview** ビルドを走らせます。本番 `main` の Deploy Hook とは独立です。

## 対応関係

| knowledges | podcaster (Git) | Vercel |
|------------|-----------------|--------|
| PR head branch `feature/aaa` | `knowledges-preview/feature/aaa`（`main` から、lock のみ差分） | Preview 環境 |
| `main` マージ後（既存） | `main` | Production（Deploy Hook） |

## podcaster 側（このリポ）

1. Vercel がビルドするブランチが `knowledges-preview/*` のとき、`scripts/checkout-knowledge.ts` は `knowledges-preview.lock.json`（またはブランチ名サフィックス）から knowledges の ref / sha を解決します。
2. 通常の `main` ビルドの挙動は変わりません。

## knowledges 側（手動セットアップ）

1. [knowledges-pr-preview.yml](./knowledges-pr-preview.yml) を `hskksk/knowledges` の `.github/workflows/knowledges-pr-preview.yml` に、`.github/scripts/vercel-preview-url.mjs` を `.github/scripts/` にコピー（前者は後者を呼びます）。このリポのコピーはミラーで、正は knowledges 側です。
2. **Secrets**
   - `PODCASTER_WRITE_TOKEN` — `hskksk/podcaster` への `contents: write`
3. **Repository variables**
   - `VERCEL_PROJECT_NAME` — Vercel → Project Settings → General → Project Name
   - `VERCEL_SCOPE_SLUG` — Hobby なら Account Username、Team なら team slug
4. workflow は `content/`・`styles/`・`notes/` と workflow 自身の変更時のみ走ります（podcaster のビルドが sparse checkout する範囲）。`scripts/checkout-knowledge.ts` の `sparsePaths()` を変えたら、workflow の `paths` も合わせて更新してください。

## プレビュー URL

```
https://<project>-git-<branch-slug>-<scope>.vercel.app
```

- `<branch-slug>`: podcaster ブランチ名を小文字化 → `_` を削除 → それ以外の非 `[a-z0-9-]` を `-` に置換（例: `knowledges-preview/feature/aaa` → `knowledges-preview-feature-aaa`）
- `.vercel.app` より前のラベルが **63 文字を超える**場合は、Vercel がブランチ部分を切り詰め、一意性のためのハッシュを差し込む:
  - `hash = sha256("git-" + <branch> + <project>)` の先頭 6 桁
  - 最終ラベル = `<ラベルの先頭 (63 - 1 - len("<hash>-<scope>")) 文字>-<hash>-<scope>`（必ず 63 文字になる）
  - 例: `podcaster` / `knowledges-preview/opencode/issue51-20261127083041` / `hskksk-6496s-projects` → `podcaster-git-knowledges-preview-o-68f5ff-hskksk-6496s-projects.vercel.app`

Vercel のドキュメントには切り詰めの存在と上限しか書かれておらず、ハッシュの仕様は非公開（[vercel/community#472](https://github.com/vercel/community/discussions/472) の回答と実デプロイで確認）。**手で組み立てず** `scripts/lib/knowledge-ref.ts` の `vercelPreviewBranchUrl()` を使ってください。期待値は `pnpm test:scripts` で検証できます。

ビルド完了前に開くと **直前の成功デプロイ** が見えることがあります（PR コメントに明記）。

## セキュリティ

- workflow は **同一リポの PR**（fork 以外）のみ（`head.repo.full_name == github.repository`）。
- `PODCASTER_WRITE_TOKEN` は knowledges Actions のみに置く。

## クリーンアップ

PR close で podcaster の `knowledges-preview/<branch>` を削除します。Vercel 上の Preview デプロイ履歴はプランの保持ポリシーに従います。
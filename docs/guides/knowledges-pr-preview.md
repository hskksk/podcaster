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

1. [knowledges-pr-preview.yml](./knowledges-pr-preview.yml) を `hskksk/knowledges` の `.github/workflows/knowledges-pr-preview.yml` にコピー。
2. **Secrets**
   - `PODCASTER_WRITE_TOKEN` — `hskksk/podcaster` への `contents: write`
3. **Repository variables**
   - `VERCEL_PROJECT_NAME` — Vercel → Project Settings → General → Project Name
   - `VERCEL_SCOPE_SLUG` — Hobby なら Account Username、Team なら team slug

## プレビュー URL（組み立て）

```
https://<VERCEL_PROJECT_NAME>-git-<branch-slug>-<VERCEL_SCOPE_SLUG>.vercel.app
```

`<branch-slug>` は podcaster ブランチ名の `/` を `-` にしたもの（例: `knowledges-preview/feature/aaa` → `knowledges-preview-feature-aaa`）。

初回は [Vercel の実デプロイ](https://vercel.com/docs/deployments/generated-urls) と突き合わせてください。63 文字超えで suffix が付く場合があります。

ビルド完了前に開くと **直前の成功デプロイ** が見えることがあります（PR コメントに明記）。

## セキュリティ

- workflow は **同一リポの PR**（fork 以外）のみ（`head.repo.full_name == github.repository`）。
- `PODCASTER_WRITE_TOKEN` は knowledges Actions のみに置く。

## クリーンアップ

PR close で podcaster の `knowledges-preview/<branch>` を削除します。Vercel 上の Preview デプロイ履歴はプランの保持ポリシーに従います。
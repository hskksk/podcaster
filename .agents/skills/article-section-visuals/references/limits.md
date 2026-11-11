# Pilot で固定した上限（Step 7）

Cloudflare OS 記事の手書き sidecar と validator で確認した運用値。parser の機械上限は `references/spec-v1.md` を正とする。

- 1 記事あたり **8 visual** まで
- `alt` は **400 字**以内（検証）
- `title` / `label` は短く（長い日本語は validator で落ちる場合あり — 短い表現に直す）
- 5 種類以上の `type` が出る長文が目安（必須ではない）

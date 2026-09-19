# Podcaster Capture — iOS ショートカット

Safari の **共有シート** から `POST /api/capture` へ送る未署名ショートカットです。

## ファイル

| ファイル | 説明 |
|----------|------|
| [Podcaster-Capture.shortcut](./Podcaster-Capture.shortcut) | 共有シート用（Web ページ → web-clips） |

再生成: `python3 scripts/generate-capture-shortcut.py`

## 取り込み方

### A. iPhone / iPad（Files から）

1. この `.shortcut` を端末に保存（AirDrop、GitHub の **Download raw**、iCloud Drive など）。
2. **設定 → ショートカット → 詳細** で **未署名ショートカットを許可**（表示名は OS バージョンで多少異なる）。
3. **ファイル** アプリで `.shortcut` をタップ → **ショートカットに追加**。
4. インポート時に **ベース URL** と **CAPTURE_API_TOKEN** を入力（Vercel の `CAPTURE_API_TOKEN` と同じ値）。
5. ショートカット編集画面で **共有シートに表示** がオンか確認。

**iOS 15 以降**では Apple の署名が必要な場合があります。そのときは **B（Mac で署名）** を使ってください。

### B. Mac で署名してから配る（推奨）

```bash
# Mac のショートカット CLI（Xcode Command Line Tools 付属）
shortcuts sign --mode anyone \
  --input docs/guides/ios/Podcaster-Capture.shortcut \
  --output ~/Desktop/Podcaster-Capture-signed.shortcut
```

署名済みファイルを iPhone に AirDrop → 追加。

### C. import URL（ホストした raw ファイル）

```text
shortcuts://import-shortcut/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhskksk%2Fpodcaster%2Fmain%2Fdocs%2Fguides%2Fios%2FPodcaster-Capture.shortcut&name=Podcaster%20Capture
```

`main` をマージしたブランチ名に差し替えてください。未署名のため端末によっては A / B と同様の制限があります。

## 使い方

1. Safari でページを開く。
2. **共有** → **Podcaster Capture**。
3. 結果（JSON）が表示されれば成功。`202` のときは [capture-clients.md](../capture-clients.md) のとおり同じ内容を再送。

## セキュリティ

- トークンはショートカット内に保存されます（GitHub 公開 repo のファイル自体にはトークンを書き込まないこと）。
- 端末紛失時は Vercel で `CAPTURE_API_TOKEN` をローテーション。

## テキストだけ送りたい

別途ショートカットを複製し、先頭を **共有されたテキスト** 入力に差し替えるか、Mac では `pnpm capture` を使う（[capture-clients.md](../capture-clients.md)）。

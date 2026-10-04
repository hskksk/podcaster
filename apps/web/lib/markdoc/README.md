# Markdoc (public site)

Server transform + client render for article / web-clip bodies.

| Entry | Role |
|-------|------|
| `prepareMarkdoc()` | RSC: parse, transform, TOC, serialize tree for client |
| `MarkdocArticleBody` | `next/dynamic` wrapper around `MarkdocContent` |
| `markdoc/config.ts` | Keystatic + `@markdoc/next.js` schema (same as `createSiteMarkdocConfig`) |
| `site-config.ts` | Server-safe copy of `@hskksk/markdoc-react` built-ins until a `/server` export exists |

After bumping `@hskksk/markdoc-react`:

1. Set `MARKDOC_REACT_SYNC_VERSION` in `site-config.ts`
2. Diff package `createMarkdocConfig` / built-in tags
3. Run `pnpm markdoc:check-config` and update `scripts/fixtures/markdoc-site-config.sha256` if intentional

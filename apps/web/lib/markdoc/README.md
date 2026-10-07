# Markdoc (public site)

| Entry | Role |
|-------|------|
| `prepareMarkdoc()` | RSC: parse, transform, TOC, serialize tree for client |
| `MarkdocArticleBody` | `next/dynamic` wrapper around `MarkdocContent` |
| `markdoc/config.ts` | Keystatic + `@markdoc/next.js` — uses `@hskksk/markdoc-react/server` |
| `extensions.ts` | App tag `podcastPlayer` |

Schema is **`createMarkdocConfig` from `@hskksk/markdoc-react/server`** (not a local copy).

After bumping `@hskksk/markdoc-react`, run `pnpm markdoc:check-config` and update the golden hash if the upstream schema changed intentionally.

# @podcaster/mcp

FastMCP server for Cloud Agents that should not receive a write `GITHUB_TOKEN`.

| Tool | Auth |
|------|------|
| `search_docs` / `get_doc` | Checkout of `content/` **or** `GITHUB_READ_TOKEN` (contents:read) |
| `write_clip` / `queue_podcast` | `CAPTURE_API_TOKEN` → Capture API. Never `GITHUB_TOKEN` |

```bash
# stdio (Cursor / Claude)
pnpm mcp

# env
CAPTURE_API_URL=https://your-app.vercel.app
CAPTURE_API_TOKEN=...
# optional read-only GitHub (when the process has no repo checkout)
GITHUB_READ_TOKEN=...
GITHUB_REPO=hskksk/podcaster
GITHUB_REF=main
```

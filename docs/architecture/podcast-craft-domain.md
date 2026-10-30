# Podcast craft domain (as-is and remodeling notes)

Scope: Supabase pipeline from `POST /ingest` through script, TTS, artwork, and RSS (`feed.xml`). Git PKM ingest contracts live in [pkm-next.md](./pkm-next.md); this document covers the **craft** bounded context only.

## Bounded contexts

| Context | Responsibility | Primary artifacts |
|---------|----------------|-------------------|
| **Knowledge ingest** | Snapshot wiki/clip text into `articles` | `content_path`, `content_sha`, article body |
| **Episode production** | Generate script, TTS job, artwork; track coarse `episodes.status` | `scripts`, `audio_files`, Storage WAV/cover |
| **Publication** | Channel RSS and “listener-visible” URLs | `feed.xml`, `published_at`, enclosure / itunes:image |
| **Orchestration** | Run stages with retries | pgflow `craftEpisodeSubmit`, `craftEpisodeDownload`, cron monitor |
| **Operations** | Human re-run and observability | CLI/TUI, `processing_logs` |

Production and publication are **separate concerns in the listener’s view**, but today both mutate `episodes` and share one status enum.

## Core entities (persistence)

- **Article** — immutable ingest snapshot; optional link to Git via `content_path` / `content_sha`.
- **Episode** — one podcast item in production/publication; holds pipeline status and display fields (`title`, `description`, `image_url`, legacy `audio_url`).
- **Script** — append-only generation attempts (`ready` / `failed`); TTS uses latest `ready` by `created_at`.
- **AudioFile** — append-only or updated pending row; Gemini batch in `batch_name` / `llm_response`; final WAV at `storage_path`.
- **PodcastConfig** — global runtime settings (not per episode).

## Use cases (as-is)

Primary automatic path: **UC-01 Ingest article** → `craftEpisodeSubmit` (script → audio start ∥ image) → monitor → **UC-04 Download audio** → **UC-06 Update RSS**.

### Re-run and regenerate (manual)

| ID | Intent | Entry | Flow input | Steps that run | RSS / feed |
|----|--------|-------|------------|----------------|------------|
| UC-R-S | Re-run script stage | `pnpm cli requeue script`, TUI Ctrl+S | `startFrom: script` | Script (always new LLM row), audio start (may no-op), image (skip if `image_url`) | Only if downstream completes download + updateRss |
| UC-R-S+ | Regenerate script **and downstream** | `regenerate-script`, TUI Ctrl+G | `script` + `regenerate: true` | Script, audio start (**new batch**), image (**regenerate**) | After download flow |
| UC-R-A | Re-run audio start | `requeue audio`, TUI Ctrl+A | `startFrom: audio` | Audio start only; skips if pending batch exists | No |
| UC-R-A+ | Regenerate audio **and republish** | `regenerate-audio`, TUI Ctrl+R | `audio` + `regenerate: true` | New batch; then monitor → download → updateRss | **Automatic** via updateRss |
| UC-R-I | Regenerate artwork only | `regenerate-image`, TUI Ctrl+I | `startFrom: image` | Image only (non-fatal failure) | **Not automatic** — TUI warns: run RSS (Ctrl+Y) |
| UC-R-RSS | Republish feed only | `requeue rss`, TUI Ctrl+Y | Download flow `startFrom: rss` | updateRss only | Rewrites full `feed.xml` |

Flow skipping is implemented in [craft-episode-submit.ts](../../supabase/flows/craft-episode-submit.ts): `startFrom` of `audio` or `image` skips script; `image` skips audio start; `audio` skips image. Image `regenerate` is true when `startFrom === "image"` or top-level `regenerate === true`.

### Published episodes

- **Audio regenerate**: `startGeneratingAudio` may claim from `published`; episode goes `audio_running` → … → `audio_ready` → `updateRss` → `published` (new `published_at` on success).
- **Image only**: DB and Storage update; **feed.xml unchanged** until UC-R-RSS.

## Target use cases (to-be, for remodeling)

Express **user intent** as application commands; avoid exposing `startFrom × regenerate` as the public model.

| To-be command | User goal | Suggested coupling |
|---------------|-----------|-------------------|
| `StartEpisodeProduction` | First-time craft from ingest | Script → audio job → artwork (current ingest) |
| `RegenerateScriptOnly` | New script; keep audio/art unless explicitly replaced | **Not implemented today** |
| `RegenerateScriptAndRefreshAudio` | New script + new TTS + optional art | Maps to current `regenerate-script` |
| `RegenerateAudioAndRepublish` | New WAV + RSS | Maps to `regenerate-audio` + implicit download |
| `ResumePendingAudioJob` | Don’t submit duplicate batch | Maps to `requeue audio` |
| `RegenerateArtwork` | Cover only | Maps to `regenerate-image` |
| `RegenerateArtworkAndRepublish` | Cover + RSS itunes:image | **Not implemented** (today: art + manual RSS) |
| `RepublishPodcastFeed` | Rebuild feed.xml | Maps to `requeue rss` |

## Aggregate boundaries (proposal)

```text
┌─────────────────────┐     ┌──────────────────────────┐
│ IngestSnapshot      │     │ EpisodeProduction        │
│ (Article)           │────▶│ root: Episode            │
│ content, git refs   │ 1:N │ Script*, AudioFile*      │
└─────────────────────┘     │ GeminiBatchJob (in Audio)  │
                            │ status: script/audio phases│
                            └────────────┬───────────────┘
                                         │ publishes
                                         ▼
                            ┌──────────────────────────┐
                            │ PodcastPublication       │
                            │ root: PodcastChannel     │
                            │ feed snapshot, item refs │
                            │ EpisodePublication slice   │
                            └──────────────────────────┘
```

- **EpisodeProduction** owns append-only **Script** and **AudioFile** attempts and coarse progress (`script_running`, `audio_running`, …).
- **PodcastPublication** owns **feed.xml** as a channel aggregate rebuilt from all items that should appear in RSS; each item references production outputs (`storage_path`, `image_url`, title, description, guid = episode id).

Today `updateRss` reads many episodes and uploads one file — channel-level transaction — while also flipping one episode to `published`. That mixes production completion with publication.

## CLI / TUI mapping

| CLI | TUI (Episodes detail) | Flow |
|-----|------------------------|------|
| `requeue script` | Ctrl+S | craftEpisodeSubmit |
| `requeue audio` | Ctrl+A | craftEpisodeSubmit |
| `requeue rss` | Ctrl+Y | craftEpisodeDownload |
| `regenerate-script` | Ctrl+G | craftEpisodeSubmit + regenerate |
| `regenerate-audio` | Ctrl+R | craftEpisodeSubmit + regenerate |
| `regenerate-image` | Ctrl+I | craftEpisodeSubmit (image only) |

Implementation: [scripts/podcast-cli.ts](../../scripts/podcast-cli.ts), [scripts/tui/data/client.ts](../../scripts/tui/data/client.ts).

## Remodeling backlog (from gap analysis)

1. Split **production status** from **publication status** (or document a composite state machine explicitly).
2. First-class “current” pointers vs latest-by-`created_at` queries for Script / AudioFile.
3. Align command names with behavior (`regenerate-script` triggers audio + image).
4. Optional `refreshFeed` flag on artwork regeneration for published episodes.
5. Keep Gemini batch metadata on a **TtsJob** value object or entity instead of only JSONB on `audio_files`.

## References

- Pipeline stages: [pipeline-stages.ts](../../supabase/functions/_shared/pipeline-stages.ts)
- Flows: [craft-episode-submit.ts](../../supabase/flows/craft-episode-submit.ts), [craft-episode-download.ts](../../supabase/flows/craft-episode-download.ts)
- Types: [types.ts](../../supabase/functions/_shared/types.ts)

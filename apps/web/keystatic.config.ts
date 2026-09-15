import { config, collection, fields } from "@keystatic/core";
import { markdocComponents, podcastSelect } from "./lib/markdoc-components";
import { titleSlugField } from "./lib/slug";
import { githubRepo, isGithubStorage } from "./lib/storage";

function storage() {
  if (isGithubStorage()) {
    return { kind: "github" as const, repo: githubRepo };
  }
  return { kind: "local" as const };
}

const markdocField = fields.markdoc({
  label: "Content",
  components: markdocComponents,
});

export default config({
  storage: storage(),
  ui: {
    brand: { name: "Podcaster PKM" },
  },
  collections: {
    docs: collection({
      label: "Wiki Documents",
      slugField: "title",
      path: `content/docs/${"*"}/`,
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["podcast", "publishedAt"],
      schema: {
        title: fields.slug(titleSlugField),
        publishedAt: fields.date({ label: "Published Date" }),
        sourceUrl: fields.text({ label: "Source URL" }),
        podcast: podcastSelect,
        contentSha: fields.text({
          label: "Content SHA",
          description: "Set by queued ingest CI after a successful episode.",
        }),
        legacyFilename: fields.text({
          label: "Legacy filename",
          description: "Original articles/ basename. Used for Pages URL redirects.",
        }),
        content: markdocField,
      },
    }),
    webClips: collection({
      label: "Web Clips & Notes",
      slugField: "title",
      path: `content/web-clips/${"*"}/`,
      format: { contentField: "content" },
      columns: ["podcast", "clippedAt"],
      schema: {
        title: fields.slug(titleSlugField),
        url: fields.text({ label: "Source URL" }),
        clippedAt: fields.text({
          label: "Clipped At",
          description: "ISO-8601 timestamp",
        }),
        podcast: podcastSelect,
        contentSha: fields.text({
          label: "Content SHA",
          description: "Set by queued ingest CI after a successful episode.",
        }),
        legacyFilename: fields.text({
          label: "Legacy filename",
          description: "Original inbox/ basename.",
        }),
        promotedTo: fields.text({
          label: "Promoted to",
          description: "Set to content/docs/{slug} after copy-promote. Do not git mv.",
        }),
        content: markdocField,
      },
    }),
  },
});

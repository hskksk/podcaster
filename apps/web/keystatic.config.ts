import { config, collection, fields } from "@keystatic/core";
import { KeystaticBrandMark } from "./lib/keystatic/brand-mark";
import { markdocEditorOptions } from "./lib/keystatic/markdoc-options";
import { parseSlugForSort } from "./lib/keystatic/slug-sort";
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
  description: "本文。見出しは H2 から（タイトルがページ H1）。",
  options: markdocEditorOptions,
  components: markdocComponents,
});

export default config({
  storage: storage(),
  ui: {
    brand: {
      name: "Podcaster PKM",
      mark: KeystaticBrandMark,
    },
    navigation: {
      ナレッジ: ["docs", "webClips"],
    },
  },
  collections: {
    docs: collection({
      label: "Wiki",
      slugField: "title",
      path: `content/docs/${"*"}/`,
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "podcast", "publishedAt"],
      parseSlugForSort,
      schema: {
        title: fields.slug(titleSlugField),
        publishedAt: fields.date({
          label: "Published date",
          description: "公開サイトの日付表示に使います。",
        }),
        sourceUrl: fields.url({
          label: "Source URL",
          description: "参照元（任意）。",
        }),
        podcast: podcastSelect,
        contentSha: fields.ignored(),
        legacyFilename: fields.ignored(),
        content: markdocField,
      },
    }),
    webClips: collection({
      label: "Web Clips",
      slugField: "title",
      path: `content/web-clips/${"*"}/`,
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "podcast", "clippedAt"],
      parseSlugForSort,
      schema: {
        title: fields.slug(titleSlugField),
        url: fields.url({
          label: "Source URL",
          description: "クリップ元の URL。",
          validation: { isRequired: true },
        }),
        clippedAt: fields.text({
          label: "Clipped at",
          description: "ISO-8601（例: 2026-06-09T07:42:19.000Z）。空ならファイル名から推定。",
        }),
        podcast: podcastSelect,
        contentSha: fields.ignored(),
        legacyFilename: fields.ignored(),
        promotedTo: fields.ignored(),
        content: markdocField,
      },
    }),
  },
});

import { BookOpen, Headphones, Scissors } from "lucide-react";

export function CollectionIntro() {
  return (
    <div className="mb-12 grid gap-4 sm:grid-cols-2">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <BookOpen className="mt-0.5 size-5 shrink-0 text-muted-fg" strokeWidth={1.75} />
          <div>
            <h3 className="font-medium text-fg">Wiki 記事</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-fg">
              調査・設計メモを Markdoc で公開。長文でも目次と読了時間で読みやすく。
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <Headphones className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
          <div>
            <h3 className="font-medium text-fg">Podcast エピソード</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-fg">
              記事から生成した音声を RSS で配信。カードや記事上部からその場で再生できます。
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-muted/40 p-5 sm:col-span-2">
        <div className="flex items-start gap-3">
          <Scissors className="mt-0.5 size-5 shrink-0 text-muted-fg" strokeWidth={1.75} />
          <div>
            <h3 className="font-medium text-fg">Web Clips</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-fg">
              外部記事の要約（要ログイン）。メインの wiki とは別コレクションです。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

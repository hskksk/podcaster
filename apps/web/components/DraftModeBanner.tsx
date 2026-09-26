import { getDraftPreviewContext } from "../lib/site/draft-context";

export async function DraftModeBanner() {
  const draft = await getDraftPreviewContext();
  if (!draft.enabled) return null;

  return (
    <div className="sticky top-0 z-[100] border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-fg">
      <span className="font-medium">Draft preview</span>
      {draft.branch ? (
        <>
          {" "}
          · branch <code className="rounded bg-black/10 px-1.5 py-0.5 text-xs">{draft.branch}</code>
        </>
      ) : null}
      {" · "}
      <form method="POST" action="/preview/end" className="inline">
        <button
          type="submit"
          className="cursor-pointer border-0 bg-transparent font-medium text-accent underline"
        >
          End preview
        </button>
      </form>
    </div>
  );
}

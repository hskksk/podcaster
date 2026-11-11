export type TreemapAiContext = { signal: AbortSignal }

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(id)
      reject(new Error('aborted'))
    })
  })
}

/** Mock AI backend matching the standalone HTML demo. */
export const mockTreemapAi = {
  async describeNodes(
    nodes: { id: string; title: string }[],
    { signal }: TreemapAiContext,
  ): Promise<Record<string, { subtitle: string }>> {
    await delay(700 + Math.random() * 600, signal)
    return Object.fromEntries(
      nodes.map((node) => [node.id, { subtitle: `✦ ${(node.title || '').slice(0, 22)}…` }]),
    )
  },

  async inferLinks(
    _input: unknown,
    { signal }: TreemapAiContext,
  ): Promise<Array<{ from: string; to: string; type: string; label?: string; reason?: string }>> {
    await delay(1800, signal)
    return []
  },

  async labelChapterFlow(
    chapters: { title: string }[],
    { signal }: TreemapAiContext,
  ): Promise<string[]> {
    await delay(1200, signal)
    return chapters.slice(1).map((ch) => `→ ${ch.title.slice(0, 10)}`)
  },

  async summarizeDoc(
    { title, outline }: { title?: string; outline: string },
    { signal }: TreemapAiContext,
  ): Promise<string> {
    await delay(900, signal)
    const lines = outline.split('\n').filter(Boolean).length
    return `✦ ${title ?? '文書'}（${lines} 見出し）— ダミー要約です。`
  },
}

export function layerNodes(
  nodes: { id: string }[],
  edges: { from: string; to: string }[],
): string[][] {
  const ids = nodes.map((n) => n.id)
  const adj = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  for (const id of ids) {
    adj.set(id, [])
    indeg.set(id, 0)
  }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to)
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  }
  const layers: string[][] = []
  let frontier = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0).sort()
  const visited = new Set<string>()
  while (frontier.length) {
    layers.push(frontier)
    const next: string[] = []
    for (const u of frontier) {
      visited.add(u)
      for (const v of adj.get(u) ?? []) {
        indeg.set(v, (indeg.get(v) ?? 0) - 1)
        if ((indeg.get(v) ?? 0) === 0 && !visited.has(v)) next.push(v)
      }
    }
    frontier = [...new Set(next)].sort()
  }
  const missing = ids.filter((id) => !visited.has(id))
  if (missing.length) layers.push(missing.sort())
  return layers
}

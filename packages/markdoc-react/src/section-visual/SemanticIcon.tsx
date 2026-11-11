const ICON_LABEL: Record<string, string> = {
  person: '人',
  document: '文書',
  database: 'データ',
  shield: '保護',
  timer: '時間',
  workspace: '作業',
  service: 'サービス',
  network: 'ネットワーク',
  chart: '数値',
}

export function SemanticIcon({ id }: { id?: string }) {
  if (!id) return null
  return (
    <span className="article-visual__icon" aria-hidden data-icon={id}>
      {ICON_LABEL[id] ?? '●'}
    </span>
  )
}

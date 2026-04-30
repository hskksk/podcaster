export interface PaletteCommand {
  /** Exact string passed to the command runner (lowercased there). */
  id: string;
  description: string;
  /** Extra substrings used only for palette filtering (not shown). */
  keywords?: string[];
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  {
    id: 'reload',
    description: 'Reload all TUI data from the server',
    keywords: ['refresh', 'fetch']
  },
  {
    id: 'target local',
    description: 'Mock: show toast as if TARGET=local',
    keywords: ['local', 'target']
  },
  {
    id: 'target remote',
    description: 'Mock: show toast as if TARGET=remote',
    keywords: ['remote', 'target']
  },
  {
    id: 'demo confirm',
    description: 'Open dummy confirm modal (Phase 1)',
    keywords: ['confirm', 'modal', 'test']
  }
];

/** Commands whose id, description, or keywords contain the query (case-insensitive). Empty query → all. */
export function filterPaletteCommands(query: string): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...PALETTE_COMMANDS];
  return PALETTE_COMMANDS.filter(c => {
    const hay = [c.id, c.description, ...(c.keywords ?? [])].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

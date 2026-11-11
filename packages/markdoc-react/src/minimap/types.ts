export type MinimapBlockKind = 'callout' | 'code' | 'diagram' | 'chart' | 'graph' | 'tabs' | 'details' | 'math'

export interface MinimapSection {
  /** Matches the rendered heading `id` when the section starts with a heading. */
  id: string
  title: string
  level: number
  /** Relative size used to scale minimap segments (character count in the section). */
  weight: number
  blockKinds: MinimapBlockKind[]
}

export interface MinimapOutline {
  sections: MinimapSection[]
  totalWeight: number
}

export interface MinimapLabelInput {
  id: string
  title: string
  level: number
  weight: number
  blockKinds: MinimapBlockKind[]
}

export type MinimapLabeler = (section: MinimapLabelInput) => Promise<string>

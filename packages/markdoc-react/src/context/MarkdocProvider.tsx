import { createContext, useContext, type ReactNode } from 'react'
import type {
  ChartRenderer,
  DiagramRenderer,
  DiagramTheme,
  GraphRenderer,
  Highlighter,
  MathRenderer,
} from '../adapters/types'

export interface MarkdocRuntime {
  highlighter?: Highlighter
  diagramRenderer?: DiagramRenderer
  chartRenderer?: ChartRenderer
  graphRenderer?: GraphRenderer
  mathRenderer?: MathRenderer
  theme?: DiagramTheme
}

const MarkdocContext = createContext<MarkdocRuntime>({})

export function MarkdocProvider({ value, children }: { value: MarkdocRuntime; children: ReactNode }) {
  return <MarkdocContext.Provider value={value}>{children}</MarkdocContext.Provider>
}

export function useMarkdocRuntime(): MarkdocRuntime {
  return useContext(MarkdocContext)
}

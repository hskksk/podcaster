import type { ReactNode } from 'react'
import { MountedViz } from './MountedViz'

export function Graph({
  engine,
  source,
  height,
  children,
}: {
  engine: string
  source?: string
  height?: string
  children?: ReactNode
}) {
  return <MountedViz kind="graph" engine={engine} source={source} height={height} children={children} />
}

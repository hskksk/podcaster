import type { ReactNode } from 'react'
import { MountedViz } from './MountedViz'

export function Chart({
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
  return <MountedViz kind="chart" engine={engine} source={source} height={height} children={children} />
}

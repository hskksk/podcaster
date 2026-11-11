import type { ChartHandler, DiagramTheme, VizHandle } from './types'

export interface EChartsInstanceLike {
  setOption: (option: unknown, opts?: unknown) => void
  dispose: () => void
  resize: () => void
}

export interface EChartsLike {
  init: (dom: HTMLElement, theme?: string | object | null, opts?: { renderer?: string }) => EChartsInstanceLike
  getInstanceByDom?: (dom: HTMLElement) => EChartsInstanceLike | undefined
}

function echartsThemeName(theme: DiagramTheme | undefined): string | undefined {
  return theme === 'dark' ? 'dark' : theme === 'light' ? undefined : undefined
}

export function createEChartsChartHandler(echarts: EChartsLike): ChartHandler {
  return (container, spec, { theme }) => {
    echarts.getInstanceByDom?.(container)?.dispose()
    const instance = echarts.init(container, echartsThemeName(theme), { renderer: 'canvas' })
    instance.setOption(spec)
    const handle: VizHandle = {
      dispose: () => instance.dispose(),
      resize: () => instance.resize(),
    }
    return handle
  }
}

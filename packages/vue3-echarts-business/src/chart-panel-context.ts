import type { InjectionKey } from 'vue'
import type { EChartsType } from './echarts'

export interface ChartController {
  getInstance: () => EChartsType | undefined
  resize: () => void
  toDataURL: (options?: Record<string, unknown>) => string | undefined
}

export interface ChartPanelContext {
  register: (controller?: ChartController) => void
}

export const chartPanelContextKey: InjectionKey<ChartPanelContext> = Symbol(
  'amusite-chart-panel-context'
)

import { BarChart, LineChart } from 'echarts/charts'
import {
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components'
import {
  init,
  use,
  type EChartsCoreOption,
  type EChartsType,
  type SetOptionOpts
} from 'echarts/core'
import { LabelLayout, UniversalTransition } from 'echarts/features'
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers'

const modules = [
  LineChart,
  BarChart,
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
  SVGRenderer
]

let registered = false

export function initECharts(...args: Parameters<typeof init>): ReturnType<typeof init> {
  if (!registered) {
    use(modules)
    registered = true
  }
  return init(...args)
}

export type { EChartsCoreOption, EChartsType, SetOptionOpts }

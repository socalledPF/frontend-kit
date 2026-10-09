import type { App } from 'vue'
import './style.css'
import Chart from './components/Chart.vue'
import ChartPanel from './components/ChartPanel.vue'
import TrendChart from './components/TrendChart.vue'
import MetricCard from './components/MetricCard.vue'
import RankChart from './components/RankChart.vue'
import { provideChartsContext, type ChartsLocaleOptions } from './context'

export * from '@amusite/charts-core'
export * from './context'
export * from './composables/useChartRequest'
export type { EChartsCoreOption, EChartsType, SetOptionOpts } from './echarts'
export { Chart, ChartPanel, TrendChart, MetricCard, RankChart }

export const XChart = Chart
export const XChartPanel = ChartPanel
export const XTrendChart = TrendChart
export const XMetricCard = MetricCard
export const XRankChart = RankChart

export interface Vue3EChartsBusinessPluginOptions extends ChartsLocaleOptions {
  prefix?: string
  registerCompatibleNames?: boolean
}

const components = { Chart, ChartPanel, TrendChart, MetricCard, RankChart }

export const Vue3EChartsBusiness = {
  install(app: App, options: Vue3EChartsBusinessPluginOptions = {}) {
    const prefix = options.prefix ?? 'X'
    provideChartsContext(app, options)
    Object.entries(components).forEach(([name, component]) =>
      app.component(`${prefix}${name}`, component)
    )
    if (options.registerCompatibleNames ?? true) {
      Object.entries(components).forEach(([name, component]) => app.component(name, component))
    }
  }
}

export default Vue3EChartsBusiness

import { inject, type App, type InjectionKey } from 'vue'

export type ChartsLocale = 'zh-CN' | 'en-US' | (string & {})
export type ChartsMessageKey =
  | 'loading'
  | 'empty'
  | 'error'
  | 'refresh'
  | 'fullscreen'
  | 'exitFullscreen'
  | 'download'
  | 'chartView'
  | 'tableView'
  | 'increase'
  | 'decrease'
  | 'unchanged'
  | 'completion'
  | 'others'

export type ChartsMessages = Record<ChartsMessageKey, string>
export type ChartsMessagesPatch = Partial<ChartsMessages>

export interface ChartsLocaleOptions {
  locale?: ChartsLocale
  messages?: Partial<Record<ChartsLocale, ChartsMessagesPatch>> | ChartsMessagesPatch
}

export interface ChartsContext {
  locale: ChartsLocale
  t: (key: ChartsMessageKey) => string
}

const zhCN: ChartsMessages = {
  loading: '图表加载中',
  empty: '暂无数据',
  error: '图表加载失败',
  refresh: '刷新图表',
  fullscreen: '全屏查看',
  exitFullscreen: '退出全屏',
  download: '下载图片',
  chartView: '图表视图',
  tableView: '表格视图',
  increase: '上升',
  decrease: '下降',
  unchanged: '持平',
  completion: '目标完成率',
  others: '其他'
}

const enUS: ChartsMessages = {
  loading: 'Loading chart',
  empty: 'No data',
  error: 'Unable to load chart',
  refresh: 'Refresh chart',
  fullscreen: 'View fullscreen',
  exitFullscreen: 'Exit fullscreen',
  download: 'Download image',
  chartView: 'Chart view',
  tableView: 'Table view',
  increase: 'Increase',
  decrease: 'Decrease',
  unchanged: 'No change',
  completion: 'Target completion',
  others: 'Other'
}

function resolveMessages(options: ChartsLocaleOptions = {}): ChartsMessages {
  const locale = options.locale ?? 'zh-CN'
  const builtIn = locale === 'en-US' ? enUS : zhCN
  const configured = options.messages
  const localePatch =
    configured && Object.values(configured).some((value) => typeof value === 'object')
      ? (configured as Partial<Record<ChartsLocale, ChartsMessagesPatch>>)[locale]
      : (configured as ChartsMessagesPatch | undefined)
  return { ...builtIn, ...localePatch }
}

export function createChartsContext(options: ChartsLocaleOptions = {}): ChartsContext {
  const locale = options.locale ?? 'zh-CN'
  const messages = resolveMessages(options)
  return { locale, t: (key) => messages[key] }
}

export const chartsContextKey: InjectionKey<ChartsContext> = Symbol('amusite-charts-context')
const fallbackContext = createChartsContext()

export function provideChartsContext(app: App, options: ChartsLocaleOptions = {}): ChartsContext {
  const context = createChartsContext(options)
  app.provide(chartsContextKey, context)
  return context
}

export function useChartsContext(): ChartsContext {
  return inject(chartsContextKey, fallbackContext)
}

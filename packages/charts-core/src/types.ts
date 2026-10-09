export type ChartRow = Record<string, unknown>
export type ChartSeriesType = 'line' | 'bar'
export type ChartOption = Record<string, unknown>

export interface ChartValueFormatterContext {
  series?: ChartSeriesField
  row?: ChartRow
  index?: number
}

export type ChartValueFormatter = (value: unknown, context: ChartValueFormatterContext) => string

export interface ChartSeriesField {
  key: string
  label: string
  type?: ChartSeriesType
  unit?: string
  prefix?: string
  color?: string
  stack?: string
  smooth?: boolean
  area?: boolean
  yAxisIndex?: number
  formatter?: ChartValueFormatter
}

export interface ChartFormatOptions {
  locale?: string
  precision?: number
  compact?: boolean
  prefix?: string
  unit?: string
  unitSeparator?: string
  emptyText?: string
}

export interface CompactNumberOptions extends Pick<
  ChartFormatOptions,
  'locale' | 'precision' | 'emptyText'
> {}

export interface TrendChartOptionConfig<Row extends ChartRow = ChartRow> {
  data: readonly Row[]
  dimension: string
  series: readonly ChartSeriesField[]
  colors?: readonly string[]
  locale?: string
  showLegend?: boolean
  showDataZoom?: boolean
  dataZoomThreshold?: number
  yAxisSplitNumber?: number
  emptyText?: string
}

export interface RankChartItem {
  name: string
  value: number
  color?: string
  raw?: unknown
}

export interface RankChartOptionConfig {
  data: readonly RankChartItem[]
  seriesName?: string
  topN?: number
  showOthers?: boolean
  othersLabel?: string
  color?: string
  colors?: readonly string[]
  unit?: string
  prefix?: string
  locale?: string
  precision?: number
  maxLabelLength?: number
  emptyText?: string
}

export interface SparklineOptionConfig {
  data: readonly number[]
  color?: string
  area?: boolean
  smooth?: boolean
}

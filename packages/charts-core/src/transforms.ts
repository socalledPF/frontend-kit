import type { ChartRow, ChartSeriesField, RankChartItem } from './types'

export function normalizeChartRows<Row extends ChartRow>(
  rows: readonly Row[],
  dimension: string,
  series: readonly ChartSeriesField[]
): ChartRow[] {
  const keys = [dimension, ...series.map((item) => item.key)]
  return rows.map((row) =>
    Object.fromEntries(keys.map((key) => [key, row[key] === undefined ? null : row[key]]))
  )
}

export function topNWithOthers(
  items: readonly RankChartItem[],
  limit = 10,
  othersLabel = '其他'
): RankChartItem[] {
  const sorted = [...items]
    .filter((item) => Number.isFinite(item.value))
    .sort((left, right) => right.value - left.value)
  const normalizedLimit = Math.max(0, Math.floor(limit))
  if (!normalizedLimit) return []
  if (sorted.length <= normalizedLimit) return sorted
  const visible = sorted.slice(0, normalizedLimit)
  const hidden = sorted.slice(normalizedLimit)
  return [
    ...visible,
    {
      name: othersLabel,
      value: hidden.reduce((sum, item) => sum + item.value, 0),
      raw: hidden
    }
  ]
}

import { formatChartValue, formatCompactNumber, truncateChartLabel } from './formatters'
import { normalizeChartRows, topNWithOthers } from './transforms'
import type {
  ChartOption,
  ChartRow,
  ChartSeriesField,
  RankChartOptionConfig,
  SparklineOptionConfig,
  TrendChartOptionConfig
} from './types'

export const defaultChartColors = [
  '#2563eb',
  '#0f766e',
  '#d97706',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#4d7c0f',
  '#be185d'
] as const

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function valueFromTooltipParam(param: unknown, field: ChartSeriesField): unknown {
  if (!param || typeof param !== 'object') return undefined
  const source = param as { data?: unknown; value?: unknown }
  if (source.data && typeof source.data === 'object' && !Array.isArray(source.data))
    return (source.data as ChartRow)[field.key]
  return source.value
}

export function createTrendOption<Row extends ChartRow = ChartRow>(
  config: TrendChartOptionConfig<Row>
): ChartOption {
  const {
    dimension,
    series,
    locale = 'zh-CN',
    showLegend = series.length > 1,
    showDataZoom = config.data.length > (config.dataZoomThreshold ?? 30),
    yAxisSplitNumber = 4,
    emptyText = '--'
  } = config
  const data = normalizeChartRows(config.data, dimension, series)
  const colors = config.colors?.length ? [...config.colors] : [...defaultChartColors]
  const maxAxisIndex = Math.max(0, ...series.map((item) => item.yAxisIndex ?? 0))
  const yAxes = Array.from({ length: maxAxisIndex + 1 }, (_, axisIndex) => {
    const field = series.find((item) => (item.yAxisIndex ?? 0) === axisIndex)
    return {
      type: 'value',
      splitNumber: yAxisSplitNumber,
      position: axisIndex === 0 ? 'left' : 'right',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      axisLabel: {
        color: '#64748b',
        formatter: (value: unknown) =>
          formatCompactNumber(value, { locale, precision: 1, emptyText })
      },
      name: field?.unit || undefined,
      nameTextStyle: { color: '#64748b', align: axisIndex === 0 ? 'left' : 'right' }
    }
  })
  const optionSeries = series.map((field, index) => ({
    id: field.key,
    name: field.label,
    type: field.type ?? 'line',
    encode: { x: dimension, y: field.key, tooltip: [field.key] },
    yAxisIndex: field.yAxisIndex ?? 0,
    stack: field.stack,
    smooth: field.smooth ?? false,
    showSymbol: config.data.length <= 12,
    symbolSize: 7,
    barMaxWidth: 34,
    connectNulls: false,
    itemStyle: { color: field.color ?? colors[index % colors.length] },
    lineStyle: { width: 2, color: field.color ?? colors[index % colors.length] },
    areaStyle: field.area
      ? { opacity: 0.12, color: field.color ?? colors[index % colors.length] }
      : undefined
  }))

  return {
    color: colors,
    animationDuration: 360,
    aria: { enabled: true, decal: { show: true } },
    dataset: { dimensions: [dimension, ...series.map((item) => item.key)], source: data },
    legend: {
      show: showLegend,
      type: 'scroll',
      top: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 7,
      textStyle: { color: '#475569' }
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [params]
        const first = items[0] as { axisValueLabel?: unknown; name?: unknown } | undefined
        const title = escapeHtml(first?.axisValueLabel ?? first?.name ?? '')
        const lines = series.map((field, index) => {
          const param = (items.find(
            (item) => (item as { seriesName?: unknown }).seriesName === field.label
          ) ?? items[index]) as { marker?: string; data?: unknown } | undefined
          const value = valueFromTooltipParam(param, field)
          const formatted = field.formatter
            ? field.formatter(value, {
                series: field,
                row:
                  param?.data && typeof param.data === 'object'
                    ? (param.data as ChartRow)
                    : undefined,
                index
              })
            : formatChartValue(value, {
                locale,
                precision: 2,
                prefix: field.prefix,
                unit: field.unit,
                emptyText
              })
          return `${param?.marker ?? ''}${escapeHtml(field.label)}: ${escapeHtml(formatted)}`
        })
        return [title, ...lines].filter(Boolean).join('<br>')
      }
    },
    grid: {
      top: showLegend ? 42 : 16,
      right: yAxes.length > 1 ? 42 : 18,
      bottom: showDataZoom ? 54 : 22,
      left: 18,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: optionSeries.some((item) => item.type === 'bar'),
      axisLine: { lineStyle: { color: '#cbd5e1' } },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', hideOverlap: true }
    },
    yAxis: yAxes.length === 1 ? yAxes[0] : yAxes,
    dataZoom: showDataZoom
      ? [
          { type: 'inside', filterMode: 'none' },
          { type: 'slider', height: 18, bottom: 8, borderColor: 'transparent' }
        ]
      : undefined,
    series: optionSeries
  }
}

export function createRankOption(config: RankChartOptionConfig): ChartOption {
  const locale = config.locale ?? 'zh-CN'
  const color = config.color ?? defaultChartColors[0]
  const visible = config.showOthers
    ? topNWithOthers(config.data, config.topN ?? 10, config.othersLabel ?? '其他')
    : [...config.data]
        .filter((item) => Number.isFinite(item.value))
        .sort((left, right) => right.value - left.value)
        .slice(0, Math.max(0, Math.floor(config.topN ?? 10)))
  const data = [...visible].reverse()
  return {
    color: config.colors?.length ? [...config.colors] : [color],
    animationDuration: 360,
    aria: { enabled: true, decal: { show: true } },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (param: unknown) => {
        const item = param as { name?: unknown; value?: unknown; marker?: string }
        return `${item.marker ?? ''}${escapeHtml(item.name)}: ${escapeHtml(
          formatChartValue(item.value, {
            locale,
            precision: config.precision ?? 1,
            prefix: config.prefix,
            unit: config.unit,
            emptyText: config.emptyText
          })
        )}`
      }
    },
    grid: { top: 8, right: 34, bottom: 12, left: 12, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#e5e7eb', type: 'dashed' } },
      axisLabel: {
        color: '#64748b',
        formatter: (value: unknown) =>
          formatCompactNumber(value, {
            locale,
            precision: config.precision ?? 1,
            emptyText: config.emptyText
          })
      }
    },
    yAxis: {
      type: 'category',
      data: data.map((item) => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#475569',
        formatter: (value: unknown) => truncateChartLabel(value, config.maxLabelLength ?? 12)
      }
    },
    series: [
      {
        name: config.seriesName,
        type: 'bar',
        barMaxWidth: 24,
        data: data.map((item, index) => ({
          name: item.name,
          value: item.value,
          raw: item.raw,
          itemStyle: {
            color:
              item.color ??
              (config.colors?.length ? config.colors[index % config.colors.length] : color)
          }
        })),
        label: {
          show: true,
          position: 'right',
          color: '#475569',
          formatter: (param: unknown) =>
            formatCompactNumber((param as { value?: unknown }).value, {
              locale,
              precision: config.precision ?? 1,
              emptyText: config.emptyText
            })
        }
      }
    ]
  }
}

export function createSparklineOption(config: SparklineOptionConfig): ChartOption {
  const color = config.color ?? defaultChartColors[0]
  return {
    animation: false,
    aria: { enabled: true },
    grid: { top: 3, right: 2, bottom: 3, left: 2 },
    xAxis: { type: 'category', show: false, boundaryGap: false },
    yAxis: { type: 'value', show: false, scale: true },
    series: [
      {
        type: 'line',
        data: [...config.data],
        smooth: config.smooth ?? true,
        showSymbol: false,
        silent: true,
        lineStyle: { color, width: 2 },
        areaStyle: config.area === false ? undefined : { color, opacity: 0.1 }
      }
    ]
  }
}

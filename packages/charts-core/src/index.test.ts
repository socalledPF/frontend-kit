import { describe, expect, it } from 'vitest'
import {
  calculateCompletionRate,
  calculateGrowthRate,
  createRankOption,
  createSparklineOption,
  createTrendOption,
  formatChartValue,
  formatCompactNumber,
  formatPercent,
  normalizeChartRows,
  topNWithOthers,
  truncateChartLabel
} from './index'

describe('@amusite/charts-core', () => {
  it('formats compact chart values for Chinese and English locales', () => {
    expect(formatCompactNumber(12_500, { locale: 'zh-CN' })).toBe('1.3万')
    expect(formatCompactNumber(1_250_000, { locale: 'en-US' })).toBe('1.3M')
    expect(formatCompactNumber('invalid')).toBe('--')
    expect(formatChartValue(1280, { prefix: '¥', unit: '元', precision: 0 })).toBe('¥1,280元')
    expect(formatPercent(12.345)).toBe('12.3%')
  })

  it('calculates growth and completion rates safely', () => {
    expect(calculateGrowthRate(120, 100)).toBe(20)
    expect(calculateGrowthRate(0, 0)).toBe(0)
    expect(calculateGrowthRate(10, 0)).toBeNull()
    expect(calculateCompletionRate(75, 100)).toBe(75)
    expect(calculateCompletionRate(1, 0)).toBeNull()
  })

  it('normalizes chart rows without mutating source data', () => {
    const source = [{ month: 'Jan', sales: 12, ignored: true }]
    const result = normalizeChartRows(source, 'month', [
      { key: 'sales', label: 'Sales' },
      { key: 'profit', label: 'Profit' }
    ])
    expect(result).toEqual([{ month: 'Jan', sales: 12, profit: null }])
    expect(source).toEqual([{ month: 'Jan', sales: 12, ignored: true }])
  })

  it('sorts rankings and groups hidden values', () => {
    expect(
      topNWithOthers(
        [
          { name: 'B', value: 2 },
          { name: 'A', value: 5 },
          { name: 'C', value: 1 }
        ],
        1,
        'Other'
      )
    ).toEqual([
      { name: 'A', value: 5 },
      { name: 'Other', value: 3, raw: expect.any(Array) }
    ])
    expect(topNWithOthers([{ name: 'A', value: 1 }], 0)).toEqual([])
  })

  it('builds dataset-based trend options with zoom and formatted tooltips', () => {
    const option = createTrendOption({
      data: [
        { month: '<Jan>', sales: 10, profit: 3 },
        { month: 'Feb', sales: 20, profit: 7 }
      ],
      dimension: 'month',
      series: [
        { key: 'sales', label: 'Sales', type: 'bar', unit: '元' },
        { key: 'profit', label: 'Profit', type: 'line', yAxisIndex: 1 }
      ],
      showDataZoom: true
    })
    expect(option.dataset).toMatchObject({ dimensions: ['month', 'sales', 'profit'] })
    expect(option.series).toHaveLength(2)
    expect(option.dataZoom).toHaveLength(2)
    expect(option.yAxis).toHaveLength(2)
    const tooltip = option.tooltip as { formatter: (params: unknown) => string }
    expect(
      tooltip.formatter([
        { axisValueLabel: '<Jan>', marker: '', data: { month: '<Jan>', sales: 10 } },
        { marker: '', data: { month: '<Jan>', profit: 3 } }
      ])
    ).toContain('&lt;Jan&gt;')
  })

  it('builds rank and sparkline presets', () => {
    const rank = createRankOption({
      data: [
        { name: 'Long department name', value: 20 },
        { name: 'Operations', value: 10 }
      ],
      topN: 1,
      showOthers: true,
      othersLabel: 'Other'
    })
    expect((rank.series as unknown[])[0]).toMatchObject({ type: 'bar' })
    expect((rank.yAxis as { data: string[] }).data).toEqual(['Other', 'Long department name'])
    expect(createSparklineOption({ data: [1, 2, 3] }).series).toHaveLength(1)
    expect(truncateChartLabel('abcdefghijkl', 5)).toBe('abcde...')
  })

  it('covers formatter and option fallbacks used by sparse business data', () => {
    expect(formatCompactNumber(-950, { locale: 'en-US', precision: -1 })).toBe('-950')
    expect(formatChartValue(1200, { compact: true, unit: 'items', unitSeparator: ' ' })).toBe(
      '1,200 items'
    )
    expect(formatPercent(null, { emptyText: 'N/A' })).toBe('N/A')
    expect(calculateGrowthRate(undefined, 10)).toBeNull()
    expect(calculateCompletionRate('invalid', 10)).toBeNull()
    expect(truncateChartLabel(null, 0)).toBe('')

    const trend = createTrendOption({
      data: [{ date: 'Mon', value: 8 }],
      dimension: 'date',
      series: [
        {
          key: 'value',
          label: '<Value>',
          area: true,
          formatter: (value, context) => `${context.row?.date}:${value}`
        }
      ],
      colors: ['#123456'],
      showLegend: false,
      showDataZoom: false
    })
    expect(trend.dataZoom).toBeUndefined()
    expect(trend.yAxis).toMatchObject({ type: 'value' })
    expect(trend.grid as { top: number; bottom: number }).toMatchObject({ top: 16, bottom: 22 })
    const trendSeries = (trend.series as Array<{ areaStyle?: unknown }>)[0]
    expect(trendSeries.areaStyle).toBeDefined()
    const trendTooltip = trend.tooltip as { formatter: (params: unknown) => string }
    expect(
      trendTooltip.formatter({
        name: 'Mon',
        seriesName: '<Value>',
        marker: '*',
        data: { date: 'Mon', value: 8 }
      })
    ).toContain('&lt;Value&gt;: Mon:8')

    const rank = createRankOption({
      data: [
        { name: '<East>', value: 3, color: '#abcdef' },
        { name: 'Invalid', value: Number.NaN }
      ],
      colors: ['#111111', '#222222'],
      showOthers: false,
      maxLabelLength: 4
    })
    const rankTooltip = rank.tooltip as { formatter: (params: unknown) => string }
    expect(rankTooltip.formatter({ name: '<East>', value: 3 })).toContain('&lt;East&gt;')
    const axisFormatter = (rank.yAxis as { axisLabel: { formatter: (value: unknown) => string } })
      .axisLabel.formatter
    expect(axisFormatter('abcdef')).toBe('abcd...')
    expect(createSparklineOption({ data: [], area: false, smooth: false })).toMatchObject({
      series: [{ smooth: false, areaStyle: undefined }]
    })
  })
})

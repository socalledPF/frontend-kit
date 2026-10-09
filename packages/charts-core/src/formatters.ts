import type { ChartFormatOptions, CompactNumberOptions } from './types'

function toFiniteNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function formatNumber(value: number, locale: string, precision: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, precision)
  }).format(value)
}

export function formatCompactNumber(value: unknown, options: CompactNumberOptions = {}): string {
  const number = toFiniteNumber(value)
  if (number === undefined) return options.emptyText ?? '--'
  const locale = options.locale ?? 'zh-CN'
  const precision = options.precision ?? 1
  const absolute = Math.abs(number)
  const chinese = locale.toLowerCase().startsWith('zh')
  const scales = chinese
    ? [
        { value: 100_000_000, suffix: '亿' },
        { value: 10_000, suffix: '万' }
      ]
    : [
        { value: 1_000_000_000, suffix: 'B' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'K' }
      ]
  const scale = scales.find((item) => absolute >= item.value)
  if (!scale) return formatNumber(number, locale, precision)
  return `${formatNumber(number / scale.value, locale, precision)}${scale.suffix}`
}

export function formatChartValue(value: unknown, options: ChartFormatOptions = {}): string {
  const number = toFiniteNumber(value)
  if (number === undefined) return options.emptyText ?? '--'
  const locale = options.locale ?? 'zh-CN'
  const precision = options.precision ?? 1
  const formatted = options.compact
    ? formatCompactNumber(number, { locale, precision, emptyText: options.emptyText })
    : formatNumber(number, locale, precision)
  const prefix = options.prefix ?? ''
  const unit = options.unit ?? ''
  const separator = unit ? (options.unitSeparator ?? '') : ''
  return `${prefix}${formatted}${separator}${unit}`
}

export function formatPercent(
  value: unknown,
  options: Pick<ChartFormatOptions, 'locale' | 'precision' | 'emptyText'> = {}
): string {
  const number = toFiniteNumber(value)
  if (number === undefined) return options.emptyText ?? '--'
  return `${formatNumber(number, options.locale ?? 'zh-CN', options.precision ?? 1)}%`
}

export function calculateGrowthRate(current: unknown, previous: unknown): number | null {
  const currentValue = toFiniteNumber(current)
  const previousValue = toFiniteNumber(previous)
  if (currentValue === undefined || previousValue === undefined) return null
  if (previousValue === 0) return currentValue === 0 ? 0 : null
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100
}

export function calculateCompletionRate(value: unknown, target: unknown): number | null {
  const currentValue = toFiniteNumber(value)
  const targetValue = toFiniteNumber(target)
  if (currentValue === undefined || targetValue === undefined || targetValue === 0) return null
  return (currentValue / targetValue) * 100
}

export function truncateChartLabel(value: unknown, maxLength = 12): string {
  const label = String(value ?? '')
  const length = Math.max(1, Math.floor(maxLength))
  return label.length > length ? `${label.slice(0, length)}...` : label
}

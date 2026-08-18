export type DateInput = string | number | Date | null | undefined

export interface MoneyFormatOptions {
  precision?: number
  prefix?: string
  suffix?: string
  thousands?: boolean
  nullText?: string
}

export interface PercentFormatOptions {
  precision?: number
  nullText?: string
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDate(input: DateInput): Date | null {
  if (input == null || input === '') {
    return null
  }

  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(input: DateInput, pattern = 'YYYY-MM-DD HH:mm:ss'): string {
  const date = toDate(input)

  if (!date) {
    return ''
  }

  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds())
  }

  return pattern.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => tokens[token] ?? token)
}

export function formatMoney(
  value: string | number | null | undefined,
  options: MoneyFormatOptions = {}
): string {
  const { precision = 2, prefix = '', suffix = '', thousands = true, nullText = '' } = options

  if (value == null || value === '') {
    return nullText
  }

  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return nullText
  }

  const sign = amount < 0 ? '-' : ''
  const fixed = Math.abs(amount).toFixed(precision)
  const [integer = '0', decimal = ''] = fixed.split('.')
  const integerText = thousands ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : integer
  const decimalText = precision > 0 ? `.${decimal}` : ''

  return `${sign}${prefix}${integerText}${decimalText}${suffix}`
}

export function formatPercent(
  value: string | number | null | undefined,
  options: PercentFormatOptions = {}
): string {
  const { precision = 2, nullText = '' } = options

  if (value == null || value === '') {
    return nullText
  }

  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return nullText
  }

  return `${(amount * 100).toFixed(precision)}%`
}

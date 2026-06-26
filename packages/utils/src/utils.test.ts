import { describe, expect, it, vi } from 'vitest'
import {
  debounce,
  findTreeNode,
  formatDate,
  formatMoney,
  getFileExt,
  getFileNameFromHeader,
  isEmpty,
  listToTree,
  safeJsonParse,
  throttle,
  treeToList
} from './index'

describe('@amusite/utils', () => {
  it('checks empty values', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty('  ')).toBe(true)
    expect(isEmpty([])).toBe(true)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty(0)).toBe(false)
  })

  it('parses json safely', () => {
    expect(safeJsonParse<{ ok: boolean }>('{"ok":true}')?.ok).toBe(true)
    expect(safeJsonParse('bad json', { ok: false })).toEqual({ ok: false })
  })

  it('formats date and money', () => {
    expect(formatDate(new Date(2026, 5, 26, 9, 8, 7))).toBe('2026-06-26 09:08:07')
    expect(formatMoney(-1234.5, { prefix: '¥' })).toBe('-¥1,234.50')
  })

  it('converts list and tree structures', () => {
    const tree = listToTree([
      { id: 1, parentId: 0, name: 'root' },
      { id: 2, parentId: 1, name: 'child' }
    ])

    expect(tree).toHaveLength(1)
    expect(treeToList(tree).map((item) => item.id)).toEqual([1, 2])
    expect(findTreeNode(tree, (item) => item.id === 2)?.name).toBe('child')
  })

  it('parses file extension and content-disposition filename', () => {
    expect(getFileExt('/download/report.xlsx?token=1')).toBe('xlsx')
    expect(getFileNameFromHeader("attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.xlsx")).toBe(
      '测试.xlsx'
    )
    expect(getFileNameFromHeader('attachment; filename="report.csv"')).toBe('report.csv')
  })

  it('debounces calls', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('first')
    debounced('second')
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('second')
    vi.useRealTimers()
  })

  it('throttles calls with trailing execution', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled('first')
    throttled('second')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('first')

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('second')
    vi.useRealTimers()
  })
})

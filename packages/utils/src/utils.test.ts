// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  copyText,
  debounce,
  downloadBlob,
  findTreeNode,
  formatDate,
  formatMoney,
  formatPercent,
  getFileExt,
  getFileNameFromHeader,
  isEmpty,
  isPlainObject,
  listToTree,
  once,
  safeJsonParse,
  sleep,
  throttle,
  treeToList,
  uuid
} from './index'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('@amusite/utils', () => {
  it('checks empty values', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty('  ')).toBe(true)
    expect(isEmpty([])).toBe(true)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty(new Map())).toBe(true)
    expect(isEmpty(new Set([1]))).toBe(false)
    expect(isEmpty(0)).toBe(false)
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject(new Date())).toBe(false)
  })

  it('parses json safely', () => {
    expect(safeJsonParse<{ ok: boolean }>('{"ok":true}')?.ok).toBe(true)
    expect(safeJsonParse('bad json', { ok: false })).toEqual({ ok: false })
    expect(safeJsonParse(undefined, 'fallback')).toBe('fallback')
  })

  it('formats date and money', () => {
    expect(formatDate(new Date(2026, 5, 26, 9, 8, 7))).toBe('2026-06-26 09:08:07')
    expect(formatMoney(-1234.5, { prefix: '¥' })).toBe('-¥1,234.50')
    expect(formatDate('invalid')).toBe('')
    expect(formatDate(new Date(2026, 0, 2), 'DD/MM/YYYY')).toBe('02/01/2026')
    expect(formatMoney(null, { nullText: '--' })).toBe('--')
    expect(formatMoney('invalid', { nullText: 'N/A' })).toBe('N/A')
    expect(formatMoney(1200, { precision: 0, thousands: false, suffix: '元' })).toBe('1200元')
    expect(formatPercent(0.126, { precision: 1 })).toBe('12.6%')
    expect(formatPercent('', { nullText: '--' })).toBe('--')
    expect(formatPercent('invalid', { nullText: 'N/A' })).toBe('N/A')
  })

  it('converts list and tree structures', () => {
    const tree = listToTree([
      { id: 1, parentId: 0, name: 'root' },
      { id: 2, parentId: 1, name: 'child' }
    ])

    expect(tree).toHaveLength(1)
    expect(treeToList(tree).map((item) => item.id)).toEqual([1, 2])
    expect(findTreeNode(tree, (item) => item.id === 2)?.name).toBe('child')
    expect(findTreeNode(tree, (item) => item.id === 3)).toBeUndefined()

    const custom = listToTree(
      [
        { key: 'root', parent: null, nodes: 'discarded' },
        { key: 'leaf', parent: 'root' }
      ],
      { idKey: 'key', parentKey: 'parent', childrenKey: 'nodes', rootParentValues: [null] }
    )
    expect(treeToList(custom, { childrenKey: 'nodes' }).map((item) => item.key)).toEqual([
      'root',
      'leaf'
    ])
  })

  it('parses file extension and content-disposition filename', () => {
    expect(getFileExt('/download/report.xlsx?token=1')).toBe('xlsx')
    expect(getFileNameFromHeader("attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.xlsx")).toBe(
      '测试.xlsx'
    )
    expect(getFileNameFromHeader('attachment; filename="report.csv"')).toBe('report.csv')
    expect(getFileExt('.env')).toBe('')
    expect(getFileExt('file.')).toBe('')
    expect(getFileNameFromHeader(null)).toBe('')
    expect(getFileNameFromHeader('inline')).toBe('')
    expect(getFileNameFromHeader("attachment; filename*=UTF-8''bad%ZZ.txt")).toBe('bad%ZZ.txt')
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
  })

  it('flushes and cancels debounced calls', () => {
    vi.useFakeTimers()
    const fn = vi.fn((value: number) => value * 2)
    const debounced = debounce(fn, 100)
    debounced(3)
    expect(debounced.flush()).toBe(6)
    expect(debounced.flush()).toBe(6)
    debounced(4)
    debounced.cancel()
    vi.runAllTimers()
    expect(fn).toHaveBeenCalledTimes(1)
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
  })

  it('supports trailing-only, no-trailing and canceled throttles', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const trailingFn = vi.fn()
    const trailing = throttle(trailingFn, 100, { leading: false })
    trailing('first')
    expect(trailingFn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(trailingFn).toHaveBeenCalledWith('first')

    const leadingFn = vi.fn()
    const leading = throttle(leadingFn, 100, { trailing: false })
    leading('one')
    leading('two')
    vi.advanceTimersByTime(100)
    expect(leadingFn).toHaveBeenCalledTimes(1)
    leading.cancel()
    leading('three')
    expect(leadingFn).toHaveBeenLastCalledWith('three')
  })

  it('downloads blobs and revokes their object URLs', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:file-1')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    downloadBlob('content', 'report.txt', { type: 'text/plain', revokeDelay: 50 })
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:file-1')
  })

  it('runs once, sleeps, creates UUIDs and copies text', async () => {
    const fn = vi.fn((value: number) => value * 2)
    const onlyOnce = once(fn)
    expect(onlyOnce(2)).toBe(4)
    expect(onlyOnce(5)).toBe(4)
    expect(fn).toHaveBeenCalledTimes(1)

    vi.useFakeTimers()
    const task = sleep(20)
    vi.advanceTimersByTime(20)
    await task
    expect(uuid()).toMatch(/^[0-9a-f-]{36}$/i)

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await copyText('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
  })
})

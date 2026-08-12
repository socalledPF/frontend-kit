import { describe, expect, it } from 'vitest'
import {
  clampPercentage,
  cloneValue,
  evaluatePermission,
  getByPath,
  getErrorMessage,
  isEqualValue,
  matchesFileAccept,
  normalizeUploadItem
} from './index'

describe('business-core helpers', () => {
  it('clones and compares nested business models', () => {
    const source = { date: new Date(10), nested: { values: [1, 2] } }
    const clone = cloneValue(source)
    expect(clone).not.toBe(source)
    expect(clone.nested).not.toBe(source.nested)
    expect(isEqualValue(clone, source)).toBe(true)
  })

  it('reads nested values and normalizes percentages', () => {
    expect(getByPath({ rows: [{ name: 'admin' }] }, 'rows[0].name')).toBe('admin')
    expect(clampPercentage(101.4)).toBe(100)
    expect(clampPercentage('42.5')).toBe(43)
    expect(clampPercentage('invalid')).toBe(0)
  })

  it('matches MIME wildcards and extensions', () => {
    expect(matchesFileAccept({ name: 'avatar.PNG', type: 'image/png' }, '.pdf,image/*')).toBe(true)
    expect(matchesFileAccept({ name: 'report.pdf', type: '' }, '.pdf,image/*')).toBe(true)
    expect(matchesFileAccept({ name: 'notes.txt', type: 'text/plain' }, '.pdf,image/*')).toBe(false)
  })

  it('evaluates permission and role requirements', () => {
    const provider = { getPermissions: () => ['system:user:list'], getRoles: () => ['operator'] }
    expect(evaluatePermission({ permission: 'system:user:list', roles: 'operator' }, provider)).toBe(true)
    expect(evaluatePermission({ permission: ['missing', 'system:user:list'] }, provider)).toBe(true)
    expect(evaluatePermission({ permission: ['missing', 'system:user:list'], match: 'all' }, provider)).toBe(false)
  })

  it('normalizes upload results and error messages', () => {
    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' })
    expect(normalizeUploadItem({ id: 1, name: '' }, file, 'uid-1')).toMatchObject({
      id: 1,
      uid: 'uid-1',
      name: 'report.pdf',
      size: 1,
      type: 'application/pdf'
    })
    expect(getErrorMessage(new Error('network'))).toBe('network')
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
})

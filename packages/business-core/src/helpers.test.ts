import { describe, expect, it } from 'vitest'
import {
  clampPercentage,
  cloneUploadItem,
  cloneValue,
  createBusinessContext,
  createSchemaModel,
  enUS,
  evaluatePermission,
  formatFileSize,
  getByPath,
  getErrorMessage,
  getFileExtension,
  interpolateMessage,
  isPlainObject,
  isEqualValue,
  matchesFileAccept,
  normalizeUploadItem,
  resolveMessages,
  schemaToDescriptions,
  schemaToFormFields,
  schemaToQueryFields,
  schemaToTableColumns,
  toPermissionValues,
  zhCN,
  type BusinessFieldSchema
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
    expect(
      evaluatePermission({ permission: 'system:user:list', roles: 'operator' }, provider)
    ).toBe(true)
    expect(evaluatePermission({ permission: ['missing', 'system:user:list'] }, provider)).toBe(true)
    expect(
      evaluatePermission({ permission: ['missing', 'system:user:list'], match: 'all' }, provider)
    ).toBe(false)
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

  it('handles object, equality and path edge cases', () => {
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject(new Map())).toBe(false)
    expect(cloneValue('value')).toBe('value')
    expect(isEqualValue(new Date(1), new Date(2))).toBe(false)
    expect(isEqualValue([1], [1, 2])).toBe(false)
    expect(isEqualValue({ a: 1 }, { a: 2 })).toBe(false)
    expect(getByPath({ value: null }, 'value.child')).toBeUndefined()
    expect(getByPath({ value: 1 }, '')).toEqual({ value: 1 })
  })

  it('formats file details and validates accept variants', () => {
    expect(getFileExtension('README')).toBe('')
    expect(formatFileSize()).toBe('')
    expect(formatFileSize(12)).toBe('12 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
    expect(matchesFileAccept({ name: 'photo.jpg', type: '' }, 'image/*')).toBe(true)
    expect(matchesFileAccept({ name: 'data.bin', type: 'application/octet-stream' }, '*/*')).toBe(
      true
    )
    expect(
      matchesFileAccept({ name: 'data.json', type: 'application/json' }, 'application/json')
    ).toBe(true)
    expect(matchesFileAccept({ name: 'data.json', type: 'application/json' }, '')).toBe(true)
  })

  it('clones upload metadata and rejects invalid upload responses', () => {
    const source = { name: 'a.txt', meta: { category: 'docs' } }
    const clone = cloneUploadItem(source)
    expect(clone).toEqual(source)
    expect(clone.meta).not.toBe(source.meta)
    expect(() => normalizeUploadItem([], new File(['a'], 'a.txt'), '1')).toThrow()
    expect(getErrorMessage('plain error')).toBe('plain error')
  })

  it('supports custom permission checks and super identities', () => {
    expect(toPermissionValues([' edit ', ''])).toEqual(['edit'])
    expect(
      evaluatePermission({ permission: 'anything' }, { getPermissions: () => ['*:*:*'] })
    ).toBe(true)
    expect(evaluatePermission({ roles: 'operator' }, { getRoles: () => ['admin'] })).toBe(true)
    expect(
      evaluatePermission({ permission: 'edit', checker: ({ permission }) => permission === 'edit' })
    ).toBe(true)
    expect(evaluatePermission({ permission: 'edit' }, {})).toBe(false)
  })

  it('resolves locales, interpolation and host adapters', async () => {
    expect(resolveMessages({ locale: 'en-US' })['common.save']).toBe(enUS['common.save'])
    expect(resolveMessages({ locale: 'fr-FR', fallbackLocale: 'en-US' })['common.save']).toBe(
      'Save'
    )
    expect(resolveMessages({ messages: { 'common.save': '存档' } })['common.save']).toBe('存档')
    expect(
      resolveMessages({
        locale: 'fr-FR',
        messages: { 'fr-FR': { 'common.save': 'Enregistrer' } }
      })['common.save']
    ).toBe('Enregistrer')
    expect(interpolateMessage('Hello {name} {missing}', { name: 'Amusite' })).toBe(
      'Hello Amusite {missing}'
    )

    const confirm = async () => true
    const context = createBusinessContext({ confirm, locale: { locale: 'en-US' } })
    expect(context.confirm).toBe(confirm)
    expect(context.permission).toEqual({})
    expect(context.t('upload.uploading', { percent: 50 })).toBe('Uploading 50%')
    expect(zhCN['common.save']).toBe('保存')
  })

  it('projects a shared schema into business component definitions', () => {
    const schema: BusinessFieldSchema[] = [
      { prop: 'id', label: 'ID', table: true, detail: { span: 2 }, defaultValue: 0 },
      { prop: 'name', label: 'Name', query: { component: 'input' }, form: true, defaultValue: '' },
      { prop: 'hidden', label: 'Hidden' }
    ]
    expect(schemaToQueryFields(schema)).toEqual([
      { prop: 'name', label: 'Name', component: 'input' }
    ])
    expect(schemaToTableColumns(schema)).toEqual([{ prop: 'id', label: 'ID' }])
    expect(schemaToFormFields(schema)).toEqual([{ prop: 'name', label: 'Name' }])
    expect(schemaToDescriptions(schema)).toEqual([{ prop: 'id', label: 'ID', span: 2 }])
    expect(createSchemaModel(schema, { name: 'Ada' })).toEqual({
      id: 0,
      name: 'Ada',
      hidden: undefined
    })
  })
})

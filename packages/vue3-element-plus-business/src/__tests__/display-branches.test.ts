import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Descriptions from '../components/Descriptions.vue'
import DictSelect from '../components/DictSelect.vue'
import DictTag from '../components/DictTag.vue'
import ExportButton from '../components/ExportButton.vue'
import Permission from '../components/Permission.vue'
import QueryForm from '../components/QueryForm.vue'
import { permissionProviderKey } from '../permission'

const wrappers: Array<ReturnType<typeof mount>> = []
const track = <T extends ReturnType<typeof mount>>(wrapper: T): T => {
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('Vue3 display and slot branches', () => {
  it('renders dictionary empty, strict, fallback, legacy style and slot states', async () => {
    const empty = track(mount(DictTag, { props: { value: null as never, emptyText: 'None' } }))
    expect(empty.text()).toBe('None')

    const fallback = vi.fn((value) => `Unknown:${value}`)
    const wrapper = track(
      mount(DictTag, {
        props: {
          value: [0, '0', 'missing'],
          strict: true,
          separator: ' / ',
          fallback,
          options: [{ label: 'Zero', value: 0, elTagType: 'success', listClass: 'legacy' }]
        },
        slots: {
          default: ({ label, value }: { label: string; value: unknown }) =>
            h('button', { class: `tag-${value}` }, label)
        }
      })
    )
    expect(wrapper.text()).toContain('Zero')
    expect(wrapper.text()).toContain('Unknown:0')
    expect(wrapper.text()).toContain('Unknown:missing')
    expect(wrapper.text()).toContain('/')
    expect(fallback).toHaveBeenCalled()

    await wrapper.setProps({ fallback: 'Unknown', strict: false })
    expect(wrapper.text()).toContain('Zero')
  })

  it('forwards select models, change events and all custom slots', async () => {
    const wrapper = track(
      mount(DictSelect, {
        props: {
          modelValue: [],
          multiple: true,
          filterable: true,
          collapseTags: true,
          options: [{ label: 'Enabled', value: '1', disabled: true }]
        },
        slots: {
          prefix: () => h('span', { class: 'prefix' }, 'P'),
          option: ({ option }: { option: { label: string } }) =>
            h('b', { class: 'option' }, option.label),
          empty: () => h('span', { class: 'empty' }, 'Empty')
        }
      })
    )
    const select = wrapper.findComponent({ name: 'ElSelect' })
    select.vm.$emit('update:modelValue', ['1'])
    select.vm.$emit('change', ['1'])
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['1']])
    expect(wrapper.emitted('change')?.at(-1)).toEqual([['1']])
  })

  it('renders description title, labels, values, dictionaries and width variants', async () => {
    const wrapper = track(
      mount(Descriptions, {
        props: {
          data: { name: 'Ada', status: '1', blank: '' },
          column: 0,
          labelWidth: 120,
          items: [
            { prop: 'name', label: 'Name', labelSlotName: 'nameLabel', slotName: 'nameValue' },
            { prop: 'status', label: 'Status', dictOptions: [{ label: 'Enabled', value: '1' }] },
            { prop: 'blank', label: 'Blank', emptyText: 'None' },
            { prop: 'hidden', label: 'Hidden', visible: false }
          ]
        },
        slots: {
          title: () => h('span', { class: 'title' }, 'Profile'),
          extra: () => h('button', { class: 'extra' }, 'Edit'),
          nameLabel: () => h('strong', 'Custom name'),
          nameValue: ({ value }: { value: unknown }) => h('em', String(value))
        }
      })
    )
    expect(wrapper.text()).toContain('Profile')
    expect(wrapper.text()).toContain('Ada')
    expect(wrapper.text()).toContain('Enabled')
    expect(wrapper.text()).toContain('None')
    expect(wrapper.text()).not.toContain('Hidden')
    await wrapper.setProps({ labelWidth: '8rem' })
    expect(wrapper.exists()).toBe(true)
  })

  it('handles query custom controls, split ranges, keyboard search and resize breakpoints', async () => {
    let customScope: { update: (value: unknown) => void; value: unknown } | undefined
    const wrapper = track(
      mount(QueryForm, {
        props: {
          model: { keyword: '', period: [1, 2] },
          fields: [
            {
              prop: 'keyword',
              label: 'Keyword',
              component: 'el-select',
              componentProps: { clearable: false }
            },
            {
              prop: 'period',
              label: 'Period',
              valueMode: 'split-range',
              startProp: 'from',
              endProp: 'to'
            },
            {
              prop: 'custom',
              label: 'Custom',
              slotName: 'custom',
              layout: 'radio-group',
              colSpan: 2
            }
          ],
          maxRows: 1,
          breakpointCols: { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 }
        },
        slots: {
          custom: (scope: { update: (value: unknown) => void; value: unknown }) => {
            customScope = scope
            return h('button', { class: 'custom' }, String(scope.value ?? 'empty'))
          }
        }
      })
    )
    wrapper.vm.toggleExpand()
    await nextTick()
    customScope?.update('selected')
    await nextTick()
    expect(wrapper.emitted('update:model')?.at(-1)?.[0]).toMatchObject({
      custom: 'selected',
      from: 1,
      to: 2
    })

    const controls = wrapper.findAll('.query-form__control')
    await controls[0].trigger('keyup', { key: 'Enter' })
    expect(wrapper.emitted('query')).toHaveLength(1)
    for (const width of [600, 800, 1000, 1300, 2000]) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
      window.dispatchEvent(new Event('resize'))
      await nextTick()
    }
    await wrapper.setProps({ fields: [{ prop: 'keyword', label: 'Keyword' }] })
    expect(wrapper.vm.expanded).toBe(false)
  })

  it('normalizes exports without downloading and renders permission outcomes', async () => {
    const exporter = track(
      mount(ExportButton, {
        props: {
          request: async () => new ArrayBuffer(2),
          autoDownload: false,
          fileName: () => 'buffer.bin'
        }
      })
    )
    await expect(exporter.vm.execute()).resolves.toMatchObject({ fileName: 'buffer.bin' })
    expect(exporter.emitted('download')).toBeUndefined()

    const provider = { getPermissions: () => ['read'] }
    const allowed = track(
      mount(Permission, {
        props: { permission: 'read' },
        slots: { default: '<button class="allowed">Allowed</button>' },
        global: { provide: { [permissionProviderKey as symbol]: provider } }
      })
    )
    const denied = track(
      mount(Permission, {
        props: { permission: 'write' },
        global: { provide: { [permissionProviderKey as symbol]: provider } }
      })
    )
    expect(allowed.find('.allowed').exists()).toBe(true)
    expect(denied.text()).toBe('')
  })
})

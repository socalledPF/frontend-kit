import Vue, { type CreateElement, type VNode } from 'vue'
import type { ProTableColumn, TableDensity, TableToolbarPreferences } from '../types'

const DENSITY_OPTIONS: Array<{ label: string; value: TableDensity }> = [
  { label: '宽松', value: 'medium' },
  { label: '默认', value: 'small' },
  { label: '紧凑', value: 'mini' }
]

function getColumnKey(column: ProTableColumn, index: number): string {
  return String(column.key ?? column.prop ?? column.label ?? `column-${index}`)
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export default Vue.extend({
  name: 'TableToolbar',
  inheritAttrs: false,
  props: {
    showSearch: {
      type: Boolean,
      default: true
    },
    showSearchToggle: {
      type: Boolean,
      default: true
    },
    showRefresh: {
      type: Boolean,
      default: true
    },
    refreshing: {
      type: Boolean,
      default: false
    },
    density: {
      type: String,
      default: 'medium',
      validator: (value: string) => DENSITY_OPTIONS.some((item) => item.value === value)
    },
    showDensity: {
      type: Boolean,
      default: true
    },
    columns: {
      type: Array,
      default: () => []
    },
    showColumnSetting: {
      type: Boolean,
      default: true
    },
    showFullscreen: {
      type: Boolean,
      default: true
    },
    fullscreenTarget: {
      type: [String, Object, Function],
      default: undefined
    },
    storageKey: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      fullscreen: false,
      initialVisibility: {} as Record<string, boolean>
    }
  },
  computed: {
    configurableColumns(this: any): Array<{ column: ProTableColumn; key: string; index: number }> {
      return this.columns
        .map((column: ProTableColumn, index: number) => ({
          column,
          key: getColumnKey(column, index),
          index
        }))
        .filter(({ column }: { column: ProTableColumn }) => column.columnSetting !== false)
    },
    visibleColumnCount(this: any): number {
      return this.configurableColumns.filter(
        ({ column }: { column: ProTableColumn }) => column.visible !== false
      ).length
    },
    allColumnsVisible(this: any): boolean {
      return (
        this.configurableColumns.length > 0 &&
        this.visibleColumnCount === this.configurableColumns.length
      )
    },
    columnsIndeterminate(this: any): boolean {
      return this.visibleColumnCount > 0 && !this.allColumnsVisible
    }
  },
  watch: {
    columns: {
      immediate: true,
      deep: true,
      handler(this: any, columns: ProTableColumn[]) {
        columns.forEach((column, index) => {
          const key = getColumnKey(column, index)

          if (!(key in this.initialVisibility)) {
            this.$set(this.initialVisibility, key, column.visible !== false)
          }
        })
      }
    }
  },
  mounted(this: any) {
    this.restorePreferences()

    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', this.handleFullscreenChange)
      this.handleFullscreenChange()
    }
  },
  beforeDestroy(this: any) {
    if (typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
    }
  },
  methods: {
    getPreferenceStorageKey(this: any): string {
      return this.storageKey ? `amusite:table-toolbar:${this.storageKey}` : ''
    },
    readPreferences(this: any): TableToolbarPreferences | undefined {
      const key = this.getPreferenceStorageKey()

      if (!key || !canUseStorage()) {
        return undefined
      }

      try {
        const value = window.localStorage.getItem(key)
        return value ? (JSON.parse(value) as TableToolbarPreferences) : undefined
      } catch {
        return undefined
      }
    },
    writePreferences(
      this: any,
      columns: ProTableColumn[] = this.columns,
      density: TableDensity = this.density,
      preserveStoredColumns = false
    ) {
      const key = this.getPreferenceStorageKey()

      if (!key || !canUseStorage()) {
        return
      }

      const storedColumns = preserveStoredColumns ? this.readPreferences()?.columns : undefined
      const columnPreferences =
        storedColumns ??
        columns.reduce((result: Record<string, boolean>, column: ProTableColumn, index: number) => {
          result[getColumnKey(column, index)] = column.visible !== false
          return result
        }, {})

      try {
        window.localStorage.setItem(
          key,
          JSON.stringify({ density, columns: columnPreferences } as TableToolbarPreferences)
        )
      } catch {
        // Storage can be unavailable in private browsing or restricted iframes.
      }
    },
    restorePreferences(this: any) {
      const preferences = this.readPreferences()

      if (!preferences) {
        return
      }

      if (
        preferences.density &&
        DENSITY_OPTIONS.some((item) => item.value === preferences.density) &&
        preferences.density !== this.density
      ) {
        this.$emit('update:density', preferences.density)
        this.$emit('density-change', preferences.density)
      }

      if (preferences.columns) {
        const nextColumns = this.columns.map((column: ProTableColumn, index: number) => {
          const key = getColumnKey(column, index)

          if (!(key in (preferences.columns as Record<string, boolean>))) {
            return { ...column }
          }

          return {
            ...column,
            visible: preferences.columns?.[key]
          }
        })
        this.$emit('update:columns', nextColumns)
        this.$emit('column-change', { type: 'restore', columns: nextColumns })
      }
    },
    toggleSearch(this: any) {
      const visible = !this.showSearch
      this.$emit('update:showSearch', visible)
      this.$emit('search-toggle', visible)
    },
    refresh(this: any) {
      if (!this.refreshing) {
        this.$emit('refresh')
      }
    },
    changeDensity(this: any, density: TableDensity) {
      if (!DENSITY_OPTIONS.some((item) => item.value === density)) {
        return
      }

      this.$emit('update:density', density)
      this.$emit('density-change', density)
      this.writePreferences(this.columns, density, true)
    },
    updateColumnVisibility(this: any, key: string, visible: boolean) {
      const nextColumns = this.columns.map((column: ProTableColumn, index: number) =>
        getColumnKey(column, index) === key ? { ...column, visible } : { ...column }
      )
      this.$emit('update:columns', nextColumns)
      this.$emit('column-change', { type: 'visibility', key, visible, columns: nextColumns })
      this.writePreferences(nextColumns)
    },
    updateAllColumns(this: any, visible: boolean) {
      const configurableKeys = new Set(
        this.configurableColumns.map(({ key }: { key: string }) => key)
      )
      const nextColumns = this.columns.map((column: ProTableColumn, index: number) => {
        const key = getColumnKey(column, index)
        return configurableKeys.has(key) ? { ...column, visible } : { ...column }
      })
      this.$emit('update:columns', nextColumns)
      this.$emit('column-change', { type: 'all', visible, columns: nextColumns })
      this.writePreferences(nextColumns)
    },
    resetColumns(this: any) {
      const nextColumns = this.columns.map((column: ProTableColumn, index: number) => {
        const key = getColumnKey(column, index)
        return {
          ...column,
          visible: this.initialVisibility[key] ?? true
        }
      })
      this.$emit('update:columns', nextColumns)
      this.$emit('column-change', { type: 'reset', columns: nextColumns })
      this.writePreferences(nextColumns)
    },
    resolveFullscreenTarget(this: any): HTMLElement | undefined {
      if (typeof document === 'undefined') {
        return undefined
      }

      if (typeof this.fullscreenTarget === 'string') {
        return document.querySelector(this.fullscreenTarget) as HTMLElement | undefined
      }

      if (typeof this.fullscreenTarget === 'function') {
        return this.fullscreenTarget() as HTMLElement | undefined
      }

      if (this.fullscreenTarget && typeof this.fullscreenTarget === 'object') {
        return this.fullscreenTarget as HTMLElement
      }

      return this.$el?.parentElement || undefined
    },
    async toggleFullscreen(this: any) {
      if (typeof document === 'undefined') {
        return
      }

      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen()
          return
        }

        const target = this.resolveFullscreenTarget()

        if (!target || typeof target.requestFullscreen !== 'function') {
          throw new Error('当前浏览器或目标容器不支持全屏')
        }

        await target.requestFullscreen()
      } catch (error) {
        this.$emit('fullscreen-error', error)
      }
    },
    handleFullscreenChange(this: any) {
      const fullscreen = typeof document !== 'undefined' && Boolean(document.fullscreenElement)

      if (fullscreen !== this.fullscreen) {
        this.fullscreen = fullscreen
        this.$emit('fullscreen-change', fullscreen)
      }
    },
    renderIconButton(
      this: any,
      h: CreateElement,
      icon: string,
      label: string,
      handler: () => void,
      options: { active?: boolean; disabled?: boolean; loading?: boolean } = {}
    ): VNode {
      const button = h(
        'el-button',
        {
          class: ['x-table-toolbar__button', { 'is-active': options.active }],
          attrs: {
            title: label,
            'aria-label': label
          },
          props: {
            size: 'mini',
            circle: true,
            type: options.active ? 'primary' : 'default',
            disabled: options.disabled
          },
          on: {
            click: handler
          }
        },
        [
          h('i', {
            class: [icon, { 'x-table-toolbar__icon--loading': options.loading }],
            attrs: { 'aria-hidden': 'true' }
          })
        ]
      )

      return h(
        'el-tooltip',
        {
          props: {
            content: label,
            placement: 'top',
            openDelay: 300
          }
        },
        [button]
      )
    },
    renderDensity(this: any, h: CreateElement): VNode {
      const button = h(
        'el-button',
        {
          class: 'x-table-toolbar__button',
          attrs: { title: '表格密度', 'aria-label': '表格密度' },
          props: { size: 'mini', circle: true }
        },
        [h('i', { class: 'el-icon-s-operation', attrs: { 'aria-hidden': 'true' } })]
      )
      const menu = h(
        'el-dropdown-menu',
        { slot: 'dropdown', class: 'x-table-toolbar__density-menu' },
        DENSITY_OPTIONS.map((item) =>
          h(
            'el-dropdown-item',
            {
              key: item.value,
              class: { 'is-active': item.value === this.density },
              attrs: { command: item.value }
            },
            [item.label]
          )
        )
      )

      return h(
        'el-dropdown',
        {
          class: 'x-table-toolbar__dropdown',
          props: { trigger: 'click' },
          on: { command: this.changeDensity }
        },
        [button, menu]
      )
    },
    renderColumnSetting(this: any, h: CreateElement): VNode {
      const header = h('div', { class: 'x-table-toolbar__column-header' }, [
        h(
          'el-checkbox',
          {
            props: {
              value: this.allColumnsVisible,
              indeterminate: this.columnsIndeterminate
            },
            on: { input: this.updateAllColumns }
          },
          ['列显示']
        ),
        h(
          'el-button',
          {
            props: { type: 'text', size: 'mini' },
            on: { click: this.resetColumns }
          },
          ['重置']
        )
      ])
      const list = h(
        'div',
        { class: 'x-table-toolbar__column-list' },
        this.configurableColumns.map(({ column, key }: { column: ProTableColumn; key: string }) =>
          h(
            'el-checkbox',
            {
              key,
              class: 'x-table-toolbar__column-item',
              props: { value: column.visible !== false },
              on: {
                input: (visible: boolean) => this.updateColumnVisibility(key, visible)
              }
            },
            [column.label || column.prop || key]
          )
        )
      )
      const reference = h(
        'el-button',
        {
          slot: 'reference',
          class: 'x-table-toolbar__button',
          attrs: { title: '列设置', 'aria-label': '列设置' },
          props: { size: 'mini', circle: true }
        },
        [h('i', { class: 'el-icon-menu', attrs: { 'aria-hidden': 'true' } })]
      )

      return h(
        'el-popover',
        {
          class: 'x-table-toolbar__popover',
          props: { placement: 'bottom-end', width: 220, trigger: 'click' }
        },
        [header, list, reference]
      )
    }
  },
  render(this: any, h: CreateElement): VNode {
    const controls: VNode[] = []

    if (this.showSearchToggle) {
      controls.push(
        this.renderIconButton(
          h,
          'el-icon-search',
          this.showSearch ? '收起搜索' : '展开搜索',
          this.toggleSearch,
          { active: this.showSearch }
        )
      )
    }

    if (this.showRefresh) {
      controls.push(
        this.renderIconButton(h, 'el-icon-refresh', '刷新', this.refresh, {
          disabled: this.refreshing,
          loading: this.refreshing
        })
      )
    }

    if (this.showDensity) {
      controls.push(this.renderDensity(h))
    }

    if (this.showColumnSetting && this.configurableColumns.length > 0) {
      controls.push(this.renderColumnSetting(h))
    }

    if (this.showFullscreen) {
      controls.push(
        this.renderIconButton(
          h,
          this.fullscreen ? 'el-icon-copy-document' : 'el-icon-full-screen',
          this.fullscreen ? '退出全屏' : '全屏',
          this.toggleFullscreen,
          { active: this.fullscreen }
        )
      )
    }

    const slotScope = {
      showSearch: this.showSearch,
      refreshing: this.refreshing,
      density: this.density,
      columns: this.columns
    }
    const leftSlot =
      this.$scopedSlots.left?.(slotScope) ||
      this.$slots.left ||
      this.$scopedSlots.default?.(slotScope) ||
      this.$slots.default ||
      []
    const rightSlot = this.$scopedSlots.right?.(slotScope) || this.$slots.right || []

    return h(
      'div',
      {
        class: 'x-table-toolbar',
        attrs: { ...this.$attrs, role: 'toolbar' }
      },
      [
        h('div', { class: 'x-table-toolbar__left' }, leftSlot),
        h('div', { class: 'x-table-toolbar__right' }, [...rightSlot, ...controls])
      ]
    )
  }
})

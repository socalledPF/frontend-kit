import Vue, { type CreateElement, type VNode } from 'vue'
import { defineComponent, ref } from 'vue-demi'
import { useDict, useTable } from '@amusite/vue-core'
import type {
  PaginationPayload,
  ProTableColumn,
  QueryFormField,
  TableDensity,
  UploadItem,
  UploadRequestContext
} from '@amusite/vue2-element-business'

interface UserRow {
  userId: number
  userName: string
  status: '0' | '1'
}

interface UserQuery {
  userName: string
  status: string
}

const mockUsers: UserRow[] = [
  { userId: 1, userName: 'admin', status: '0' },
  { userId: 2, userName: 'editor', status: '0' },
  { userId: 3, userName: 'disabled-user', status: '1' }
]

function wait(duration: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, duration)

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('请求已取消', 'AbortError'))
      },
      { once: true }
    )
  })
}

function readImage(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(undefined)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
    reader.onerror = () => reject(reader.error || new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function mockUpload({ file, signal, onProgress }: UploadRequestContext): Promise<UploadItem> {
  return new Promise((resolve, reject) => {
    let percentage = 0
    let settled = false

    const finish = async () => {
      if (settled) {
        return
      }

      settled = true
      clearInterval(timer)
      signal?.removeEventListener('abort', handleAbort)

      try {
        resolve({
          id: `demo-${Date.now()}-${file.name}`,
          name: file.name,
          url: await readImage(file),
          size: file.size,
          type: file.type
        })
      } catch (error) {
        reject(error)
      }
    }

    const handleAbort = () => {
      if (settled) {
        return
      }

      settled = true
      clearInterval(timer)
      reject(new DOMException('上传已取消', 'AbortError'))
    }

    const timer = window.setInterval(() => {
      percentage = Math.min(100, percentage + 20)
      onProgress(percentage)

      if (percentage === 100) {
        void finish()
      }
    }, 140)

    if (signal?.aborted) {
      handleAbort()
      return
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

export default defineComponent({
  name: 'App',
  setup() {
    const uploadedFiles = ref<UploadItem[]>([])
    const uploadedImages = ref<UploadItem[]>([])
    const showSearch = ref(true)
    const tableDensity = ref<TableDensity>('medium')
    const columns = ref<ProTableColumn[]>([
      { prop: 'userId', label: 'ID', width: 80 },
      { prop: 'userName', label: '用户名称' },
      { prop: 'status', label: '状态', slotName: 'status' }
    ])
    const statusDict = useDict({
      loader: async () => [
        { label: '正常', value: '0', type: 'success' },
        { label: '停用', value: '1', type: 'danger' }
      ],
      immediateTypes: ['sys_normal_disable']
    })

    const table = useTable<UserRow, UserQuery>({
      initialQuery: {
        userName: '',
        status: ''
      },
      request: async (params, { signal }) => {
        await wait(450, signal)
        const pageNum = Number(params.pageNum ?? 1)
        const pageSize = Number(params.pageSize ?? 10)
        const filtered = mockUsers.filter((item) => {
          const matchedName = params.userName ? item.userName.includes(params.userName) : true
          const matchedStatus = params.status ? item.status === params.status : true
          return matchedName && matchedStatus
        })
        const start = (pageNum - 1) * pageSize

        return {
          code: 200,
          rows: filtered.slice(start, start + pageSize),
          total: filtered.length
        }
      }
    })

    return {
      query: table.query,
      list: table.list,
      total: table.total,
      loading: table.loading,
      loadingProps: {
        text: '正在加载用户数据',
        delay: 120,
        minDuration: 300
      },
      uploadedFiles,
      uploadedImages,
      showSearch,
      tableDensity,
      columns,
      uploadRequest: mockUpload,
      handleFileUploadChange: (value: UploadItem[]) => {
        uploadedFiles.value = value
      },
      handleImageUploadChange: (value: UploadItem[]) => {
        uploadedImages.value = value
      },
      pageNum: table.pageNum,
      pageSize: table.pageSize,
      search: table.search,
      queryFields: [
        { prop: 'userName', label: '用户名称', component: 'el-input' },
        { prop: 'status', label: '状态', slotName: 'status' }
      ] as QueryFormField[],
      statusOptions: statusDict.optionsMap,
      mockAsyncAction: async () => {
        await wait(800)
        return { savedAt: Date.now() }
      },
      handleShowSearchChange: (value: boolean) => {
        showSearch.value = value
      },
      handleDensityChange: (value: TableDensity) => {
        tableDensity.value = value
      },
      handleColumnsChange: (value: ProTableColumn[]) => {
        columns.value = value
      },
      handleQueryModelChange: (model: UserQuery) => {
        Object.keys(table.query).forEach((key) => {
          delete table.query[key as keyof UserQuery]
        })
        Object.assign(table.query, model)
      },
      handleQuery: () => table.search(),
      handleReset: () => table.reset(),
      handlePagination: ({ page, limit }: PaginationPayload) => {
        if (limit !== table.pageSize.value) {
          return table.setPageSize(limit)
        }

        return table.setPage(page)
      }
    }
  },
  render(this: any, h: CreateElement): VNode {
    const statusOptions = this.statusOptions.sys_normal_disable || []
    const statusSelectSlot = ({
      value,
      update
    }: {
      value: string
      update: (value: string) => void
    }) =>
      h('x-dict-select', {
        props: {
          value,
          options: statusOptions,
          placeholder: '请选择状态'
        },
        on: {
          input: update
        }
      })

    return h('main', { class: 'x-admin-page' }, [
      h('section', { class: 'x-admin-section' }, [
        this.showSearch
          ? h('query-form', {
              props: {
                model: this.query,
                fields: this.queryFields,
                labelWidth: '90px'
              },
              on: {
                'update:model': this.handleQueryModelChange,
                query: this.handleQuery,
                reset: this.handleReset
              },
              scopedSlots: {
                status: statusSelectSlot
              }
            })
          : null,
        h('x-table-toolbar', {
          props: {
            showSearch: this.showSearch,
            refreshing: this.loading,
            density: this.tableDensity,
            columns: this.columns,
            storageKey: 'playground-users'
          },
          on: {
            'update:showSearch': this.handleShowSearchChange,
            'update:density': this.handleDensityChange,
            'update:columns': this.handleColumnsChange,
            refresh: this.search
          },
          scopedSlots: {
            left: () =>
              h(
                'x-async-button',
                {
                  props: {
                    action: this.mockAsyncAction,
                    confirm: '确认执行模拟异步操作吗？',
                    type: 'primary',
                    icon: 'el-icon-plus'
                  }
                },
                ['异步操作']
              )
          }
        }),
        h('pro-table', {
          class: 'x-admin-table',
          props: {
            data: this.list,
            columns: this.columns,
            loading: this.loading,
            loadingProps: this.loadingProps,
            size: this.tableDensity,
            total: this.total,
            page: this.pageNum,
            limit: this.pageSize
          },
          on: {
            pagination: this.handlePagination
          },
          scopedSlots: {
            status: ({ row }: { row: UserRow }) =>
              h('x-dict-tag', {
                props: {
                  value: row.status,
                  options: statusOptions
                }
              })
          }
        })
      ]),
      h('section', { class: 'x-admin-section' }, [
        h('h2', { class: 'playground-section-title' }, ['上传组件']),
        h('div', { class: 'playground-upload-grid' }, [
          h('div', { class: 'playground-upload-panel' }, [
            h('h3', { class: 'playground-upload-title' }, ['文件上传']),
            h(
              'x-upload',
              {
                props: {
                  value: this.uploadedFiles,
                  request: this.uploadRequest,
                  multiple: true,
                  drag: true,
                  limit: 3,
                  maxSizeMb: 10,
                  concurrency: 2
                },
                on: {
                  input: this.handleFileUploadChange
                }
              },
              [h('span', { slot: 'tip' }, ['最多 3 个文件，单个文件不超过 10 MB'])]
            )
          ]),
          h('div', { class: 'playground-upload-panel' }, [
            h('h3', { class: 'playground-upload-title' }, ['图片上传']),
            h(
              'x-upload',
              {
                props: {
                  value: this.uploadedImages,
                  request: this.uploadRequest,
                  mode: 'image',
                  multiple: true,
                  limit: 4,
                  maxSizeMb: 5
                },
                on: {
                  input: this.handleImageUploadChange
                }
              },
              [h('span', { slot: 'tip' }, ['支持常见图片格式，最多 4 张'])]
            )
          ])
        ])
      ])
    ])
  }
})

Vue.config.productionTip = false

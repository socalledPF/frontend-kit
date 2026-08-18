import Vue, { type CreateElement, type VNode } from 'vue'
import { defineComponent, ref } from 'vue-demi'
import { useDict, useTable } from '@amusite/vue-core'
import type {
  DescriptionItem,
  ExportFile,
  ImportRequestContext,
  ImportResult,
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
  dept?: {
    deptName: string
  }
}

interface UserQuery {
  userName: string
  status: string
}

interface UserForm {
  userName: string
  status: '0' | '1'
}

const mockUsers: UserRow[] = [
  { userId: 1, userName: 'admin', status: '0', dept: { deptName: '研发中心' } },
  { userId: 2, userName: 'editor', status: '0', dept: { deptName: '内容运营' } },
  { userId: 3, userName: 'disabled-user', status: '1', dept: { deptName: '客户服务' } }
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

async function mockImport({
  file,
  updateExisting,
  signal,
  onProgress
}: ImportRequestContext): Promise<ImportResult> {
  for (const percentage of [20, 45, 70, 100]) {
    await wait(140, signal)
    onProgress(percentage)
  }

  return {
    successCount: updateExisting ? 3 : 2,
    failureCount: 1,
    message: `${file.name} 导入完成`,
    errors: [{ row: 4, field: 'userName', message: '用户名称已存在' }]
  }
}

async function mockExport(): Promise<ExportFile> {
  await wait(650)
  const rows = [
    '用户ID,用户名称,状态',
    ...mockUsers.map(
      (row) => `${row.userId},${row.userName},${row.status === '0' ? '正常' : '停用'}`
    )
  ]

  return {
    data: `\uFEFF${rows.join('\n')}`,
    fileName: '用户数据.csv',
    type: 'text/csv;charset=utf-8'
  }
}

export default defineComponent({
  name: 'App',
  setup() {
    const uploadedFiles = ref<UploadItem[]>([])
    const uploadedImages = ref<UploadItem[]>([])
    const showSearch = ref(true)
    const formDialogVisible = ref(false)
    const importDialogVisible = ref(false)
    const formMode = ref<'create' | 'edit'>('create')
    const userForm = ref<UserForm>({ userName: '', status: '0' })
    const selectedUser = ref<UserRow>(mockUsers[0])
    const tableDensity = ref<TableDensity>('medium')
    const columns = ref<ProTableColumn[]>([
      { prop: 'userId', label: 'ID', width: 80 },
      { prop: 'userName', label: '用户名称' },
      { prop: 'status', label: '状态', slotName: 'status' },
      {
        prop: 'actions',
        label: '操作',
        width: 150,
        slotName: 'actions',
        columnSetting: false
      }
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
      formDialogVisible,
      importDialogVisible,
      formMode,
      userForm,
      selectedUser,
      tableDensity,
      columns,
      uploadRequest: mockUpload,
      importRequest: mockImport,
      exportRequest: mockExport,
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
      detailItems: [
        { prop: 'userId', label: '用户 ID' },
        { prop: 'userName', label: '用户名称' },
        { prop: 'dept.deptName', label: '所属部门' },
        { prop: 'status', label: '状态', slotName: 'detailStatus' }
      ] as DescriptionItem[],
      userRules: {
        userName: [{ required: true, message: '请输入用户名称', trigger: 'blur' }],
        status: [{ required: true, message: '请选择状态', trigger: 'change' }]
      },
      mockAsyncAction: async () => {
        await wait(800)
        return { savedAt: Date.now() }
      },
      saveUser: async (model: UserForm) => {
        await wait(700)
        return {
          ...model,
          userId: formMode.value === 'edit' ? selectedUser.value.userId : Date.now()
        }
      },
      openCreateDialog: () => {
        formMode.value = 'create'
        userForm.value = { userName: '', status: '0' }
        formDialogVisible.value = true
      },
      openEditDialog: (row: UserRow) => {
        selectedUser.value = row
        formMode.value = 'edit'
        userForm.value = { userName: row.userName, status: row.status }
        formDialogVisible.value = true
      },
      handleFormVisible: (value: boolean) => {
        formDialogVisible.value = value
      },
      handleFormModel: (model: UserForm) => {
        userForm.value = model
      },
      openImportDialog: () => {
        importDialogVisible.value = true
      },
      handleImportVisible: (value: boolean) => {
        importDialogVisible.value = value
      },
      selectUser: (row: UserRow) => {
        selectedUser.value = row
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
        attrs: { 'aria-label': '状态' },
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
            left: () => [
              h('x-permission', { props: { permission: 'system:user:add' } }, [
                h(
                  'el-button',
                  {
                    props: { type: 'primary', size: 'small', icon: 'el-icon-plus' },
                    on: { click: this.openCreateDialog }
                  },
                  ['新增']
                )
              ]),
              h(
                'el-button',
                {
                  directives: [{ name: 'permission', value: 'system:user:import' }],
                  props: { size: 'small', icon: 'el-icon-upload2' },
                  on: { click: this.openImportDialog }
                },
                ['导入']
              ),
              h(
                'x-export-button',
                {
                  props: {
                    request: this.exportRequest,
                    confirm: '确认导出当前用户数据吗？',
                    type: 'default'
                  }
                },
                ['导出']
              ),
              h(
                'x-async-button',
                {
                  props: {
                    action: this.mockAsyncAction,
                    confirm: '确认执行模拟异步操作吗？',
                    icon: 'el-icon-check'
                  }
                },
                ['异步操作']
              )
            ]
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
              }),
            actions: ({ row }: { row: UserRow }) => [
              h(
                'el-button',
                {
                  props: { type: 'text', size: 'small' },
                  on: { click: () => this.selectUser(row) }
                },
                ['详情']
              ),
              h('x-permission', { props: { permission: 'system:user:edit' } }, [
                h(
                  'el-button',
                  {
                    props: { type: 'text', size: 'small' },
                    on: { click: () => this.openEditDialog(row) }
                  },
                  ['编辑']
                )
              ])
            ]
          }
        })
      ]),
      h('section', { class: 'x-admin-section' }, [
        h('h2', { class: 'playground-section-title' }, ['用户详情']),
        h('x-descriptions', {
          props: {
            data: this.selectedUser,
            items: this.detailItems,
            column: 2
          },
          scopedSlots: {
            detailStatus: ({ value }: { value: string }) =>
              h('x-dict-tag', { props: { value, options: statusOptions } })
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
      ]),
      h('x-form-dialog', {
        props: {
          value: this.formDialogVisible,
          model: this.userForm,
          mode: this.formMode,
          title: this.formMode === 'edit' ? '编辑用户' : '新增用户',
          rules: this.userRules,
          submit: this.saveUser,
          confirmClose: true,
          appendToBody: true
        },
        on: {
          input: this.handleFormVisible,
          'update:model': this.handleFormModel,
          success: this.search
        },
        scopedSlots: {
          default: ({ model }: { model: UserForm }) => [
            h('el-form-item', { props: { label: '用户名称', prop: 'userName' } }, [
              h('el-input', {
                props: { value: model.userName, placeholder: '请输入用户名称' },
                on: { input: (value: string) => (model.userName = value) }
              })
            ]),
            h('el-form-item', { props: { label: '状态', prop: 'status' } }, [
              h('x-dict-select', {
                props: { value: model.status, options: statusOptions },
                on: { input: (value: '0' | '1') => (model.status = value) }
              })
            ])
          ]
        }
      }),
      h('x-import-dialog', {
        props: {
          value: this.importDialogVisible,
          request: this.importRequest,
          showUpdateExisting: true,
          appendToBody: true
        },
        on: {
          input: this.handleImportVisible,
          success: this.search
        }
      })
    ])
  }
})

Vue.config.productionTip = false

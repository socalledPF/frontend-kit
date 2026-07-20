import Vue, { type CreateElement, type VNode } from 'vue'
import { defineComponent } from 'vue-demi'
import { useDict, useTable } from '@amusite/vue-core'
import type { PaginationPayload, ProTableColumn, QueryFormField } from '@amusite/vue2-element-business'

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

export default defineComponent({
  name: 'App',
  setup() {
    const statusDict = useDict({
      loader: async () => [
        { label: '正常', value: '0' },
        { label: '停用', value: '1' }
      ],
      immediateTypes: ['sys_normal_disable']
    })

    const table = useTable<UserRow, UserQuery>({
      initialQuery: {
        userName: '',
        status: ''
      },
      request: async (params) => {
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
      pageNum: table.pageNum,
      pageSize: table.pageSize,
      search: table.search,
      queryFields: [
        { prop: 'userName', label: '用户名称', component: 'el-input' },
        { prop: 'status', label: '状态', slotName: 'status' }
      ] as QueryFormField[],
      columns: [
        { prop: 'userId', label: 'ID', width: 80 },
        { prop: 'userName', label: '用户名称' },
        { prop: 'status', label: '状态', slotName: 'status' }
      ] as ProTableColumn[],
      statusOptions: statusDict.optionsMap,
      getStatusLabel: (value: UserRow['status']) =>
        statusDict.getLabel('sys_normal_disable', value, value),
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
      h(
        'el-select',
        {
          props: {
            value,
            clearable: true,
            placeholder: '请选择状态'
          },
          on: {
            input: update
          }
        },
        statusOptions.map((item: { label: string; value: string | number }) =>
          h('el-option', {
            key: item.value,
            props: {
              label: item.label,
              value: item.value
            }
          })
        )
      )

    return h('main', { class: 'x-admin-page' }, [
      h('section', { class: 'x-admin-section' }, [
        h('query-form', {
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
        }),
        h('pro-table', {
          class: 'x-admin-table',
          props: {
            data: this.list,
            columns: this.columns,
            loading: this.loading,
            total: this.total,
            page: this.pageNum,
            limit: this.pageSize
          },
          on: {
            pagination: this.handlePagination
          },
          scopedSlots: {
            status: ({ row }: { row: UserRow }) =>
              h(
                'el-tag',
                {
                  props: {
                    type: row.status === '0' ? 'success' : 'danger'
                  }
                },
                [this.getStatusLabel(row.status)]
              )
          }
        })
      ])
    ])
  }
})

Vue.config.productionTip = false

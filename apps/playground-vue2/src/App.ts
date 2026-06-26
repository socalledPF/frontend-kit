import Vue, { type CreateElement, type VNode } from 'vue'
import { defineComponent } from 'vue-demi'
import { useDict, useTable } from '@amusite/vue-core'

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
      reset: table.reset,
      setPage: table.setPage,
      setPageSize: table.setPageSize,
      statusOptions: statusDict.optionsMap,
      getStatusLabel: (value: UserRow['status']) =>
        statusDict.getLabel('sys_normal_disable', value, value)
    }
  },
  render(this: any, h: CreateElement): VNode {
    const statusOptions = this.statusOptions.sys_normal_disable || []

    return h('main', { class: 'x-admin-page' }, [
      h('section', { class: 'x-admin-section' }, [
        h('div', { class: 'x-admin-toolbar' }, [
          h(
            'el-form',
            {
              class: 'x-admin-toolbar__filters',
              props: {
                inline: true,
                model: this.query,
                size: 'small'
              }
            },
            [
              h('el-form-item', { props: { label: '用户名称' } }, [
                h('el-input', {
                  props: {
                    value: this.query.userName,
                    clearable: true,
                    placeholder: '请输入用户名称'
                  },
                  on: {
                    input: (value: string) => {
                      this.query.userName = value
                    }
                  }
                })
              ]),
              h('el-form-item', { props: { label: '状态' } }, [
                h(
                  'el-select',
                  {
                    props: {
                      value: this.query.status,
                      clearable: true,
                      placeholder: '请选择状态'
                    },
                    on: {
                      input: (value: string) => {
                        this.query.status = value
                      }
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
              ])
            ]
          ),
          h('div', { class: 'x-admin-toolbar__actions' }, [
            h(
              'el-button',
              {
                props: {
                  size: 'small',
                  type: 'primary'
                },
                on: {
                  click: () => this.search()
                }
              },
              ['查询']
            ),
            h(
              'el-button',
              {
                props: {
                  size: 'small'
                },
                on: {
                  click: () => this.reset()
                }
              },
              ['重置']
            )
          ])
        ]),
        h(
          'el-table',
          {
            class: 'x-admin-table',
            props: {
              data: this.list,
              border: true
            },
            directives: [
              {
                name: 'loading',
                value: this.loading
              }
            ]
          },
          [
            h('el-table-column', {
              props: {
                prop: 'userId',
                label: 'ID',
                width: 80
              }
            }),
            h('el-table-column', {
              props: {
                prop: 'userName',
                label: '用户名称'
              }
            }),
            h('el-table-column', {
              props: {
                prop: 'status',
                label: '状态'
              },
              scopedSlots: {
                default: ({ row }: { row: UserRow }) =>
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
          ]
        ),
        h('div', { class: 'x-admin-pagination' }, [
          h('el-pagination', {
            props: {
              currentPage: this.pageNum,
              pageSize: this.pageSize,
              total: this.total,
              layout: 'total, sizes, prev, pager, next'
            },
            on: {
              'current-change': this.setPage,
              'size-change': this.setPageSize
            }
          })
        ])
      ])
    ])
  }
})

Vue.config.productionTip = false

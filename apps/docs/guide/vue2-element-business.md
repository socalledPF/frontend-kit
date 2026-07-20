# Vue2 Element Business

`@amusite/vue2-element-business` 面向 Vue2 + Element-UI 后台项目。首批组件从现有 RuoYi 项目的 `QueryForm` 和 `ProTable` 适配而来，并去除了 `@/components`、`@/utils` 这类宿主项目路径依赖。

## 安装与注册

```ts
import Vue from 'vue'
import ElementUI from 'element-ui'
import Vue2ElementBusiness from '@amusite/vue2-element-business'
import '@amusite/vue2-element-business/style.css'

Vue.use(ElementUI)
Vue.use(Vue2ElementBusiness)
```

默认注册兼容名和组件库别名：

- `QueryForm` / `XSearchForm`
- `ProTable` / `XDataTable`
- `Pagination` / `XPagination`

## QueryForm

```vue
<query-form
  :model.sync="queryParams"
  :fields="queryFields"
  label-width="90px"
  @query="getList"
  @reset="getList"
/>
```

```ts
export const queryFields = [
  { prop: 'userName', label: '用户名称', component: 'el-input' },
  {
    prop: 'status',
    label: '状态',
    component: 'el-select',
    slotName: 'status'
  },
  {
    prop: 'dateRange',
    label: '创建时间',
    component: 'el-date-picker',
    valueMode: 'split-range',
    startProp: 'beginTime',
    endProp: 'endTime',
    componentProps: {
      type: 'daterange',
      valueFormat: 'yyyy-MM-dd'
    }
  }
]
```

字段 slot 会收到 `{ model, field, value, update }`。

## ProTable

```vue
<pro-table
  :data="list"
  :columns="columns"
  :loading="loading"
  :total="total"
  :page.sync="queryParams.pageNum"
  :limit.sync="queryParams.pageSize"
  @pagination="getList"
>
  <template #status="{ row }">
    <el-tag :type="row.status === '0' ? 'success' : 'danger'">
      {{ row.status === '0' ? '正常' : '停用' }}
    </el-tag>
  </template>
</pro-table>
```

```ts
export const columns = [
  { prop: 'userId', label: '用户ID', width: 100 },
  { prop: 'userName', label: '用户名称' },
  { prop: 'status', label: '状态', slotName: 'status' }
]
```

`ProTable` 内部使用包内 `Pagination`，不再依赖 RuoYi 的 `@/components/Pagination`。

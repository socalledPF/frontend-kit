# Schema 与 useCrudPage

`BusinessFieldSchema` 让查询、表格、编辑和详情复用同一份字段语义，同时允许每个视图独立关闭或覆盖配置。

```ts
import type { BusinessFieldSchema } from '@amusite/business-core'

const userFields: BusinessFieldSchema[] = [
  {
    prop: 'userName',
    label: '用户名称',
    query: { component: 'el-input' },
    table: { minWidth: 140 },
    form: { required: true },
    description: true
  },
  {
    prop: 'status',
    label: '状态',
    query: { slotName: 'status' },
    table: { slotName: 'status', width: 90 },
    form: { component: 'XDictSelect' },
    description: true
  }
]
```

使用 `schemaToQueryFields()`、`schemaToTableColumns()`、`schemaToFormFields()` 和 `schemaToDescriptions()` 可分别生成查询字段、表格列、表单字段和描述项。schema 只描述公共部分，复杂单元格、联动表单和权限仍通过插槽或手写组件完成。

## useCrudPage

```ts
import { useCrudPage } from '@amusite/vue-core'

const crud = useCrudPage({
  schema: userFields,
  table: {
    initialQuery: { userName: '', status: '' },
    request: (params, context) => getUserList(params, context.signal)
  },
  remove: (rows) => Promise.all(rows.map((row) => deleteUser(row.userId))),
  save: (model, mode) => (mode === 'create' ? addUser(model) : updateUser(model))
})
```

它组合列表、选择、弹窗模型、保存和删除动作，但不会强制页面 DOM。`XQueryForm`、`XProTable`、`XFormDialog` 仍可自由组合。

`XCrudPage` 暂不作为稳定 API。至少两个真实项目验证 schema 扩展性后，才会提供可选封装，并保留局部插槽和自定义请求流程。

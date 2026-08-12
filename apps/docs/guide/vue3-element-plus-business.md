# Vue3 Element Plus Business

`@amusite/vue3-element-plus-business` 为 Vue3 + Element Plus 后台项目提供与 Vue2 包一致的业务能力。组件使用 Composition API、Element Plus 图标和 Vue3 原生多 `v-model` 协议。

## 安装与注册

```bash
pnpm add vue element-plus @amusite/vue3-element-plus-business
```

```ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import Vue3ElementPlusBusiness from '@amusite/vue3-element-plus-business'
import '@amusite/vue3-element-plus-business/style.css'

createApp(App).use(ElementPlus).use(Vue3ElementPlusBusiness).mount('#app')
```

默认注册 `QueryForm / XSearchForm`、`ProTable / XDataTable`、`Pagination / XPagination`，以及 Loading、Upload、AsyncButton、DictTag、DictSelect、TableToolbar、FormDialog、Permission、Descriptions、ImportDialog 和 ExportButton 的普通名称与 `X` 别名。

## 查询表格

```vue
<x-search-form
  v-model:model="query"
  :fields="fields"
  @query="table.search"
  @reset="table.reset"
/>

<x-table-toolbar
  v-model:show-search="showSearch"
  v-model:density="density"
  v-model:columns="columns"
  @refresh="table.refresh()"
/>

<x-data-table
  v-model:page="table.page"
  v-model:limit="table.limit"
  :columns="columns"
  :data="table.list"
  :total="table.total"
  :loading="table.loading"
/>
```

业务密度仍使用 `medium | small | mini`。组件内部将 `medium` 映射为 Element Plus 的 `default`，`mini` 在 `small` 基础上增加紧凑样式。

## FormDialog

默认模型控制弹窗显隐，具名 `model` 模型控制表单数据：

```vue
<x-form-dialog
  v-model="visible"
  v-model:model="form"
  mode="edit"
  title="编辑用户"
  :submit="saveUser"
  confirm-close
>
  <template #default="{ model }">
    <el-form-item label="用户名称" prop="userName">
      <el-input v-model="model.userName" />
    </el-form-item>
  </template>
</x-form-dialog>
```

公开方法包括 `validate()`、`submitForm()`、`resetFields()` 和 `requestClose()`。重复提交会复用当前 Promise；脏数据关闭保护可使用布尔值、文案或异步函数。

## Upload

`XUpload` 的模型只包含成功项，失败文件留在内部列表供重试：

```vue
<x-upload
  v-model="attachments"
  :request="uploadRequest"
  multiple
  drag
  :limit="5"
  :concurrency="2"
/>
```

```ts
import type { UploadRequest } from '@amusite/vue3-element-plus-business'

const uploadRequest: UploadRequest = async ({ file, fieldName, data, signal, onProgress }) => {
  const body = new FormData()
  Object.entries(data).forEach(([key, value]) => body.append(key, String(value)))
  body.append(fieldName, file)

  const result = await request.post('/common/upload', body, {
    signal,
    onUploadProgress: ({ loaded, total }) => onProgress(total ? loaded / total * 100 : 0)
  })

  return {
    id: result.fileName,
    name: result.originalFilename || file.name,
    url: result.url,
    size: file.size,
    type: file.type
  }
}
```

文件与图片模式均支持自动/手动提交、并发限制、取消、重试、异步校验、单文件安全替换和本地预览。公开方法为 `submit()`、`retry(uid)`、`abort(uid?)`、`remove(uid)` 和 `clear()`。

## Permission

```ts
app.use(Vue3ElementPlusBusiness, {
  permission: {
    getPermissions: () => store.getters.permissions,
    getRoles: () => store.getters.roles
  }
})
```

```vue
<x-permission permission="system:user:add">
  <el-button type="primary">新增</el-button>
</x-permission>

<el-button v-permission.all="['system:user:edit', 'system:user:remove']">编辑并删除</el-button>
```

权限提供者通过应用级 `provide/inject` 隔离，因此同一页面的多个 Vue 应用和 SSR 请求不会共享可变权限状态。

## ImportDialog / ExportButton

```vue
<x-import-dialog
  v-model="importVisible"
  v-model:update-existing="updateExisting"
  :request="importUsers"
  show-update-existing
/>

<x-export-button :request="exportUsers" confirm="确认导出吗？">
  导出
</x-export-button>
```

导入请求接收 `AbortSignal` 和进度回调，取消后会忽略迟到结果。导出请求返回 Blob、ArrayBuffer、字符串或 `{ data, fileName?, type? }`，也可以使用 `download(file)` 接管桌面端保存行为。

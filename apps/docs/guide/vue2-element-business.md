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
- `Loading` / `XLoading`
- `Upload` / `XUpload`

## Loading

局部加载会保留默认插槽内容，并在上方显示遮罩：

```vue
<x-loading :loading="loading" text="正在加载用户数据" :delay="120" :min-duration="300">
  <user-list />
</x-loading>
```

全屏加载支持锁定页面滚动；没有默认插槽时，组件会显示为独立加载状态：

```vue
<x-loading :loading="submitting" fullscreen lock text="正在提交，请稍候" />
```

可通过 `spinner` 和 `tip` 插槽自定义指示器及提示内容。`delay` 用于避免快速请求闪烁，`min-duration` 用于避免遮罩一闪而过。

| 属性            | 默认值                      | 说明                         |
| --------------- | --------------------------- | ---------------------------- |
| `loading`       | `false`                     | 是否处于加载状态             |
| `text`          | `加载中...`                 | 加载提示，传空字符串可隐藏   |
| `fullscreen`    | `false`                     | 是否覆盖整个视口             |
| `lock`          | `true`                      | 全屏时是否锁定页面滚动       |
| `delay`         | `0`                         | 延迟显示时间，单位为毫秒     |
| `min-duration`  | `0`                         | 遮罩最短展示时间，单位为毫秒 |
| `background`    | `rgba(255, 255, 255, 0.82)` | 遮罩背景色                   |
| `spinner-class` | `''`                        | 自定义 spinner 图标类名      |
| `mask-class`    | `''`                        | 自定义遮罩类名               |
| `size`          | `medium`                    | `small`、`medium` 或 `large` |
| `z-index`       | `2000`                      | 遮罩层级                     |

组件提供 `default`、`spinner`、`tip` 插槽，并在实际遮罩显示状态变化时触发 `change(visible)` 事件。

## Upload

`XUpload` 使用 `UploadItem[]` 作为 `v-model`，上传中和失败文件只保留在组件内部，成功后才进入表单值。

```vue
<x-upload
  v-model="attachments"
  :request="uploadRequest"
  multiple
  drag
  :limit="5"
  :max-size-mb="20"
  :concurrency="2"
>
  <template #tip>最多 5 个文件，单个文件不超过 20 MB</template>
</x-upload>
```

请求由宿主注入，并直接返回标准 `UploadItem`：

```ts
import type { UploadRequest } from '@amusite/vue2-element-business'
import { request } from '@/utils/request'

interface RuoYiUploadResult {
  fileName: string
  originalFilename?: string
  url: string
}

export const uploadRequest: UploadRequest = async ({
  file,
  fieldName,
  data,
  signal,
  onProgress
}) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => formData.append(key, String(value)))
  formData.append(fieldName, file)

  const result = await request.post<RuoYiUploadResult>('/common/upload', formData, {
    signal,
    onUploadProgress: ({ loaded, total }) => {
      onProgress(total ? (loaded / total) * 100 : 0)
    }
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

图片墙使用相同请求接口：

```vue
<x-upload
  v-model="images"
  :request="uploadRequest"
  mode="image"
  multiple
  accept="image/*"
  :limit="4"
/>
```

| 属性              | 默认值  | 说明                                         |
| ----------------- | ------- | -------------------------------------------- |
| `mode`            | `file`  | `file` 文件列表或 `image` 图片墙             |
| `multiple`        | `false` | 是否允许多选                                 |
| `limit`           | `0`     | 最大文件数，`0` 表示不限制                   |
| `accept`          | `''`    | MIME、通配 MIME 或扩展名；图片默认 `image/*` |
| `max-size-mb`     | `0`     | 单文件大小限制，`0` 表示不限制               |
| `auto-upload`     | `true`  | 选择后是否立即上传                           |
| `drag`            | `false` | 是否显示拖拽选择区                           |
| `concurrency`     | `3`     | 最大并发请求数                               |
| `field-name`      | `file`  | FormData 文件字段名                          |
| `data`            | `{}`    | 附加数据对象或 `(file) => data`              |
| `allow-duplicate` | `false` | 是否允许重复文件                             |

公开方法为 `submit()`、`retry(uid)`、`abort(uid?)` 和 `clear()`。组件会触发 `input`、`change`、`progress`、`success`、`error`、`validation-error`、`remove`、`preview`、`cancel` 事件，并提供 `trigger`、`tip`、`file`、`error`、`preview` 插槽。删除成功文件只更新本地值，不会自动调用服务端删除接口。

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
  :loading-props="{ text: '正在加载', delay: 120 }"
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

`ProTable` 内部使用包内 `Loading` 和 `Pagination`，不再依赖 RuoYi 的 `v-loading` 或 `@/components/Pagination`。可通过 `loading-props` 透传 Loading 配置。

# RuoYi Adapter

`@amusite/ruoyi-adapter` 集中处理 RuoYi 常见的响应、分页、字典、上传、导入和导出结构。它不读取 token、不跳转路由，也不显示消息。

```bash
pnpm add @amusite/ruoyi-adapter
```

```ts
import { createRequest } from '@amusite/request'
import {
  createRuoyiDictLoader,
  createRuoyiRequestAdapter,
  createRuoyiUploadRequest
} from '@amusite/ruoyi-adapter'

export const request = createRequest({
  baseURL: '/api',
  adapter: createRuoyiRequestAdapter({
    getToken: () => authStore.token,
    onUnauthorized: () => authStore.logout()
  })
})

export const loadDict = createRuoyiDictLoader(request)
export const uploadRequest = createRuoyiUploadRequest(request, {
  url: '/common/upload'
})
```

主要导出：

| API                         | 用途                               |
| --------------------------- | ---------------------------------- |
| `createRuoyiRequestAdapter` | 生成 `@amusite/request` adapter    |
| `toRuoyiPageResult`         | 将 `rows/total` 转换为标准分页结果 |
| `toDictOptions`             | 将字典数据转换为 `DictOption[]`    |
| `createRuoyiDictLoader`     | 创建 `useDict` loader              |
| `createRuoyiUploadRequest`  | 创建 `XUpload` 请求函数            |
| `toImportResult`            | 统一导入成功数、失败数和错误明细   |
| `toExportFile`              | 统一 Blob、文件名和 MIME 类型      |
| `hasRuoyiPermission`        | 适配 RuoYi 权限标识                |

服务端字段有差异时，应在适配器参数中覆盖映射，不要在组件内散落响应判断。

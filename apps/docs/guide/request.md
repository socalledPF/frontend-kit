# Request

`@amusite/request` 提供 `createRequest()`。它默认识别 RuoYi 的 `code/msg/data/rows/total`，并通过 adapter 接入项目差异。

```ts
import { createRequest } from '@amusite/request'

export const request = createRequest({
  baseURL: '/dev-api',
  adapter: {
    getToken: () => tokenStore.token,
    tokenHeader: 'Authorization',
    formatToken: (token) => `Bearer ${token}`,
    onError: (message) => console.error(message),
    onUnauthorized: () => redirectToLogin(),
    refreshToken: () => authStore.refreshToken()
  },
  hooks: {
    onRequest: ({ requestId, config }) => telemetry.start(requestId, config.url),
    onResponse: ({ requestId, duration }) => telemetry.end(requestId, duration),
    onError: ({ requestId, error }) => telemetry.fail(requestId, error)
  }
})
```

支持 `get/post/put/delete/patch/head`。每个请求会生成请求 ID、记录耗时并触发生命周期 hooks；并发遇到未登录时，`refreshToken` 只执行一次，成功后自动重放等待中的请求。组件仍不直接访问 storage、router 或 UI 框架。

## 下载

```ts
const result = await request.download('/system/user/export')
const postResult = await request.downloadPost('/system/user/export', query)

console.log(result.fileName)
console.log(result.data)
```

`fileName` 会从 `Content-Disposition` 中解析。

若 Blob 实际包含后端 JSON 错误，下载方法会先解析并按普通业务错误处理。`isRequestCanceled(error)` 可区分 AbortSignal 和 Axios 取消，不会误触发全局错误提示。

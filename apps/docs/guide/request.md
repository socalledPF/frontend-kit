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
    onUnauthorized: () => redirectToLogin()
  }
})
```

## 下载

```ts
const result = await request.download('/system/user/export')

console.log(result.fileName)
console.log(result.data)
```

`fileName` 会从 `Content-Disposition` 中解析。

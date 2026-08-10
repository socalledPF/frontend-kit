# Vue Core

`@amusite/vue-core` 基于 `vue-demi`，Vue2 项目通过 `@vue/composition-api` 使用，后续 Vue3 可以复用同一套 hooks。

## useTable

```ts
import { useTable } from '@amusite/vue-core'

const table = useTable({
  initialQuery: {
    userName: '',
    status: ''
  },
  request: (params) => getUserList(params)
})
```

请求回调的第二个参数提供请求序号和取消信号，可以直接传给 Axios：

```ts
const table = useTable({
  request: (params, { signal }) =>
    request.get('/system/user/list', {
      params,
      signal
    }),
  transformParams: (params) => ({
    ...params,
    keyword: params.userName
  })
})
```

默认情况下，新请求会取消仍在执行的旧请求，过期响应不会覆盖最新列表；刷新失败时保留当前列表。可以通过 `cancelPrevious: false` 或 `keepDataOnError: false` 覆盖，也可以调用 `table.cancel()` 主动取消。

默认字段：

- 请求分页：`pageNum`、`pageSize`
- 响应列表：`rows`
- 响应总数：`total`

字段不一致时可以覆盖：

```ts
useTable({
  request: getList,
  fieldMap: {
    pageNumKey: 'page',
    pageSizeKey: 'limit',
    listKey: 'list',
    totalKey: 'count'
  }
})
```

## useDict

```ts
const dict = useDict({
  loader: (type) => getDicts(type),
  immediateTypes: ['sys_normal_disable']
})

dict.getLabel('sys_normal_disable', '0')
```

## useAsyncAction

`useAsyncAction` 统一管理保存、删除、启停等异步操作的 loading、结果和错误，默认锁定重复执行：

```ts
const saveAction = useAsyncAction({
  before: () => formRef.value?.validate(),
  action: () => saveUser(form),
  onSuccess: () => table.refresh(),
  onError: (error) => console.error(error)
})

await saveAction.execute()
```

返回 `loading`、`status`、`result`、`error`、`execute/run()` 和 `reset()`。`before` 返回 `false` 时状态变为 `cancelled`，不会执行 action；需要在 hook 内吞掉错误时设置 `throwOnError: false`。

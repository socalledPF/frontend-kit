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

# RuoYi 接入

首版默认兼容 RuoYi 常见接口结构：

```ts
{
  code: 200,
  msg: '操作成功',
  rows: [],
  total: 0
}
```

## Vue2 入口

```ts
import Vue from 'vue'
import VueCompositionApi from '@vue/composition-api'
import ElementUI from 'element-ui'
import '@amusite/styles/style.css'
import '@amusite/vue2-element-business/style.css'
import Vue2ElementBusiness from '@amusite/vue2-element-business'

Vue.use(VueCompositionApi)
Vue.use(ElementUI)
Vue.use(Vue2ElementBusiness)
```

## 请求适配

```ts
import { createRequest } from '@amusite/request'

export const request = createRequest({
  baseURL: import.meta.env.VITE_APP_BASE_API,
  adapter: {
    getToken: () => getToken(),
    onError: (message) => Message.error(message),
    onUnauthorized: () => store.dispatch('LogOut')
  }
})
```

库不会直接读取 token、调用 router 或展示 Element Message，这些项目差异都通过 adapter 注入。

## QueryForm / ProTable 迁移

`@amusite/vue2-element-business` 已内置从 RuoYi 项目适配来的 `QueryForm`、`ProTable` 和 `Pagination`。默认会注册兼容名，也会注册组件库别名：

- `QueryForm` / `XSearchForm`
- `ProTable` / `XDataTable`
- `Pagination` / `XPagination`
- `Loading` / `XLoading`
- `Upload` / `XUpload`

原有 `fields`、`columns`、`slotName`、`headerSlotName`、`update:page`、`update:limit` 和 `pagination` 事件可以继续使用。

上传组件不读取 token，也不固定解析 `/common/upload` 响应。宿主通过 `UploadRequest` 使用已有 `request.post()`，在回调内构造 FormData 并将响应映射为 `UploadItem`；完整示例见 [Vue2 Element Business](/guide/vue2-element-business#upload)。

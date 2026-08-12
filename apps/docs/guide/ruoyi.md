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

## Vue3 入口

```ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@amusite/styles/style.css'
import '@amusite/vue3-element-plus-business/style.css'
import Vue3ElementPlusBusiness from '@amusite/vue3-element-plus-business'

const app = createApp(App)

app.use(ElementPlus)
app.use(Vue3ElementPlusBusiness, {
  permission: {
    getPermissions: () => store.getters.permissions,
    getRoles: () => store.getters.roles
  }
})
app.mount('#app')
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

Vue2 和 Vue3 业务包均内置从 RuoYi 场景适配的 `QueryForm`、`ProTable` 和 `Pagination`。默认会注册兼容名，也会注册组件库别名：

- `QueryForm` / `XSearchForm`
- `ProTable` / `XDataTable`
- `Pagination` / `XPagination`
- `Loading` / `XLoading`
- `Upload` / `XUpload`
- `AsyncButton` / `XAsyncButton`
- `DictTag` / `XDictTag`
- `DictSelect` / `XDictSelect`
- `TableToolbar` / `XTableToolbar`
- `FormDialog` / `XFormDialog`
- `Permission` / `XPermission`，以及 `v-permission`
- `Descriptions` / `XDescriptions`
- `ImportDialog` / `XImportDialog`
- `ExportButton` / `XExportButton`

原有 `fields`、`columns`、`slotName`、`headerSlotName` 和 `pagination` 事件可以继续使用。Vue3 使用 `v-model:page`、`v-model:limit` 代替 `.sync`。

上传组件不读取 token，也不固定解析 `/common/upload` 响应。宿主通过 `UploadRequest` 使用已有 `request.post()`，在回调内构造 FormData 并将响应映射为 `UploadItem`；完整示例见 [Vue3 Element Plus Business](/guide/vue3-element-plus-business#upload)。

## 权限接入

可直接将 RuoYi store 中的权限和角色注入组件库：

```ts
app.use(Vue3ElementPlusBusiness, {
  permission: {
    getPermissions: () => store.getters.permissions,
    getRoles: () => store.getters.roles
  }
})
```

Vue2 项目将 `app.use` 换成 `Vue.use(Vue2ElementBusiness, options)`。之后可以用 `v-permission="'system:user:add'"` 或 `<x-permission permission="system:user:add">` 控制业务操作。组件和指令使用同一个判定入口，不直接导入宿主 store。

## 导入导出

`XImportDialog` 的 `request` 对接 `/system/user/importData`，在宿主内构造 FormData，并将后端返回值转换为 `ImportResult`。`XExportButton` 可以直接接收 `request.download()` 的 `{ data, fileName }` 结果。完整代码见 [Vue3 导入导出](/guide/vue3-element-plus-business#importdialog-exportbutton)。

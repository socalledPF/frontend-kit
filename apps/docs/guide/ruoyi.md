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

Vue.use(VueCompositionApi)
Vue.use(ElementUI)
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

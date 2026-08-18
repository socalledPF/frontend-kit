# 宿主适配与主题

业务组件不会直接依赖宿主的路由、Store、消息框或埋点。统一通过 `BusinessHostAdapters` 注入项目能力，组件显式 prop 始终优先于插件配置。

```ts
import type { BusinessHostAdapters } from '@amusite/business-core'

export const businessOptions: BusinessHostAdapters = {
  confirm: ({ message }) =>
    ElMessageBox.confirm(message)
      .then(() => true)
      .catch(() => false),
  download: ({ data, fileName }) => saveAs(data, fileName),
  notifyError: (error) => ElMessage.error(error.message),
  storage: window.localStorage,
  telemetry: (event) => analytics.track(event.name, event.detail),
  permission: {
    getPermissions: () => userStore.permissions,
    getRoles: () => userStore.roles
  },
  locale: { locale: 'zh-CN' }
}
```

Vue3 使用应用级 `provide/inject`，不同应用与 SSR 请求之间不会共享状态：

```ts
app.use(Vue3ElementPlusBusiness, businessOptions)
```

Vue2 新项目建议使用工厂创建独立插件实例；旧的 `Vue.use(Vue2ElementBusiness, options)` 保持兼容：

```ts
import { createVue2BusinessPlugin } from '@amusite/vue2-element-business'

Vue.use(createVue2BusinessPlugin(businessOptions))
```

## 国际化

内置 `zh-CN` 与 `en-US`，默认 `zh-CN`。可覆盖单条文案或提供自定义语言：

```ts
app.use(Vue3ElementPlusBusiness, {
  locale: {
    locale: 'en-US',
    fallbackLocale: 'zh-CN',
    messages: {
      'en-US': { common: { confirm: 'Apply' } }
    }
  }
})
```

## 主题

引入 `@amusite/styles/style.css` 后可通过 CSS Variables 覆盖颜色、间距、圆角、密度和层级。主题作用域可以放在 `html`，也可以只包裹某个后台子应用。

```html
<html data-x-theme="dark"></html>
```

```html
<html data-x-contrast="high"></html>
```

```css
.operations-app {
  --x-color-primary: #147d64;
  --x-radius-base: 4px;
  --x-space-page: 20px;
}
```

旧版变量保留兼容别名。业务包只输出 `.x-*` 自有样式，不覆盖宿主 Element 主题。

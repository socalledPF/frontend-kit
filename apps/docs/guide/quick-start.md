# 快速开始

## Vue3 项目

```bash
pnpm add @amusite/utils @amusite/request @amusite/vue-core @amusite/vue3-element-plus-business @amusite/styles
pnpm add axios vue@^3.3 element-plus@^2.7 vue-demi
```

```ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import Vue3ElementPlusBusiness from '@amusite/vue3-element-plus-business'
import '@amusite/vue3-element-plus-business/style.css'

createApp(App).use(ElementPlus).use(Vue3ElementPlusBusiness).mount('#app')
```

## Vue2 项目

```bash
pnpm add @amusite/utils @amusite/request @amusite/vue-core @amusite/vue2-element-business @amusite/styles
pnpm add axios vue-demi element-ui
```

Vue2 项目还需要安装并注册 Composition API：

```bash
pnpm add vue@2.6.14 @vue/composition-api
```

```ts
import Vue from 'vue'
import VueCompositionApi from '@vue/composition-api'

Vue.use(VueCompositionApi)
```

### 引入样式

```ts
import '@amusite/styles/style.css'
import '@amusite/vue2-element-business/style.css'
```

### 注册业务组件

```ts
import Vue2ElementBusiness from '@amusite/vue2-element-business'

Vue.use(Vue2ElementBusiness)
```

## 开发命令

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm dev:docs
```

## 发布准备

私有 npm registry 地址暂未固定，先复制 `.npmrc.example` 为 `.npmrc` 并替换为真实地址。

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

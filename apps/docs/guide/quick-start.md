# 快速开始

## 安装

```bash
pnpm add @amusite/utils @amusite/request @amusite/vue-core @amusite/styles
pnpm add axios vue-demi
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

## 引入样式

```ts
import '@amusite/styles/style.css'
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

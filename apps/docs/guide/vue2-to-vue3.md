# Vue2 迁移 Vue3

Vue3 包保留 Vue2 包的组件名称、业务类型、插槽名称和主要事件载荷。迁移重点是框架入口、Element Plus 图标及原生 `v-model` 写法。

## 包与入口

| Vue2                                   | Vue3                                  |
| -------------------------------------- | ------------------------------------- |
| `@amusite/vue2-element-business`       | `@amusite/vue3-element-plus-business` |
| `Vue.use(ElementUI)`                   | `app.use(ElementPlus)`                |
| `Vue.use(Vue2ElementBusiness)`         | `app.use(Vue3ElementPlusBusiness)`    |
| `element-ui/lib/theme-chalk/index.css` | `element-plus/dist/index.css`         |

## 模型迁移

| Vue2                                 | Vue3                               |
| ------------------------------------ | ---------------------------------- |
| `<x-upload v-model="files" />`       | 不变                               |
| `<x-dict-select v-model="status" />` | 不变                               |
| `:model.sync="query"`                | `v-model:model="query"`            |
| `:page.sync="page"`                  | `v-model:page="page"`              |
| `:limit.sync="limit"`                | `v-model:limit="limit"`            |
| `:columns.sync="columns"`            | `v-model:columns="columns"`        |
| `:density.sync="density"`            | `v-model:density="density"`        |
| `:show-search.sync="showSearch"`     | `v-model:show-search="showSearch"` |
| `:update-existing.sync="value"`      | `v-model:update-existing="value"`  |

Vue3 默认模型事件为 `update:modelValue`，具名模型使用 `update:model`、`update:page` 等原生协议。不再发出 Vue2 的 `input` 事件。

## Element Plus 差异

- 字符串 `el-icon-*` 改为 `@element-plus/icons-vue` 图标组件；业务组件内置按钮已经完成替换。
- Element Plus 尺寸为 `default | large | small`。业务表格仍接受 `medium | small | mini`，组件内部负责映射。
- Dialog 使用 `model-value`；FormDialog 和 ImportDialog 已封装关闭守卫及取消逻辑。
- 宿主必须先安装 Element Plus，再安装业务组件插件，并引入两者的 CSS。

## 兼容范围

- 公共配置类型由 `@amusite/business-core` 统一提供，两套业务包也会继续重导出这些类型。
- `request`、上传、导入和导出回调的输入输出契约不变。
- Vue3 包面向现代浏览器，不支持 IE11。
- Vue2 包不会因共享核心抽取而改变已有调用方式。

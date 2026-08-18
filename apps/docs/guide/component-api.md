# 组件 API 总览

所有组件同时导出普通名和 `X*` 名。`XQueryForm / XProTable` 是推荐名称；`XSearchForm / XDataTable` 保留兼容。Vue3 支持组件子路径导入，例如：

```ts
import Upload from '@amusite/vue3-element-plus-business/upload'
```

## 双框架组件

| 组件           | 核心 Props / 模型                                                         | 事件                                                                    | 插槽                                         | 实例方法                                                | 起始版本 |
| -------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------- | -------- |
| `QueryForm`    | `model`、`fields`、`maxRows`、`breakpointCols`、`labelWidth`              | `update:model`、`query`、`reset`                                        | 字段 `slotName`                              | `query`、`reset`、`toggleExpand`                        | 0.1      |
| `ProTable`     | `data`、`columns`、`loading`、`page`、`limit`、`total`                    | 分页模型、`pagination`、表格透传事件                                    | 列 `slotName`、`headerSlotName`、默认列      | 无                                                      | 0.1      |
| `Pagination`   | `page`、`limit`、`total`、`pageSizes`、`layout`                           | 分页模型、`pagination`                                                  | 无                                           | 无                                                      | 0.1      |
| `Loading`      | `loading`、`text`、`delay`、`minDuration`、`fullscreen`、`lock`           | `change`                                                                | `default`、`indicator`                       | 无                                                      | 0.1      |
| `Upload`       | 默认模型、`request`、`mode`、`multiple`、`limit`、`accept`、`concurrency` | `change`、`progress`、`success`、`error`、`cancel`、`remove`、`preview` | `trigger`、`tip`、`file`、`error`、`preview` | `submit`、`retry`、`abort`、`remove`、`clear`           | 0.1      |
| `AsyncButton`  | `action`、`beforeAction`、`confirm`、`disabled`、`loadingText`            | `click`、`loading-change`、`success`、`error`、`cancel`                 | `default`、`loading`                         | `execute`                                               | 0.2      |
| `DictTag`      | `value`、`options`、`strict`、`separator`、`fallback`                     | `click`                                                                 | `default`                                    | 无                                                      | 0.2      |
| `DictSelect`   | 默认模型、`options`、`multiple`、`clearable`、`filterable`                | 模型与 Element Select 透传事件                                          | `option`、`prefix`、`empty`                  | Select 透传                                             | 0.2      |
| `TableToolbar` | `showSearch`、`density`、`columns`、`storageKey`、`fullscreenTarget`      | 对应模型、`refresh`、`fullscreen-change/error`                          | `left`、`right`                              | `toggleFullscreen`、`resetColumns`                      | 0.2      |
| `FormDialog`   | 显隐模型、`model`、`mode`、`rules`、`submit`、`confirmClose`              | `submit`、`success`、`error`、`dirty-change`                            | `default`、`footer`                          | `validate`、`submitForm`、`resetFields`、`requestClose` | 0.2      |
| `Permission`   | `permission`、`roles`、`match`、`tag`                                     | 无                                                                      | `default`、`fallback`                        | 无                                                      | 0.2      |
| `Descriptions` | `data`、`items`、`column`、`emptyText`                                    | 无                                                                      | 字段 `slotName`                              | 无                                                      | 0.2      |
| `ImportDialog` | 显隐模型、`request`、`accept`、`maxSizeMb`、`updateExisting`              | `progress`、`success`、`error`、`cancel`                                | `tip`、`result`、`footer`                    | `submit`、`abort`、`clear`                              | 0.2      |
| `ExportButton` | `request`、`transformResult`、`fileName`、`download`、`confirm`           | `download`、`success`、`error`                                          | `default`、`loading`                         | `execute`                                               | 0.2      |

Vue2 模型使用 `value/input` 与 `.sync`；Vue3 使用 `modelValue/update:modelValue` 和具名 `v-model`。详细映射见 [Vue2 迁移 Vue3](/guide/vue2-to-vue3)。

## Vue3 新组件

| 组件            | 核心 Props / 模型                                     | 事件                                               | 插槽                                      | 实例方法                                                            | 起始版本 |
| --------------- | ----------------------------------------------------- | -------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- | -------- |
| `RemoteSelect`  | 默认模型、`request`、`debounce`、`cache`、`multiple`  | `load`、`error`、模型事件                          | `option`、`empty`                         | `load`、`refresh`、`clearCache`                                     | 0.1      |
| `DrawerForm`    | 显隐模型、`model`、`submit`、`confirmClose`、`size`   | `submit`、`success`、`error`、`dirty-change`       | `default`、`header`、`footer`             | `validate`、`resetFields`、`submitForm`、`requestClose`             | 0.1      |
| `EditableTable` | 默认模型、`columns`、`editMode`、`minRows`、`maxRows` | `change`、`add`、`remove`、`validation-error`      | `editor-*`、`cell-*`、`actions`、`append` | `addRow`、`removeRow`、`startEdit`、`stopEdit`、`validate`、`reset` | 0.1      |
| `StatusSwitch`  | 默认模型、`request`、`confirm`、`optimistic`          | `change`、`success`、`error`、`rollback`、`cancel` | `active`、`inactive`                      | `update`                                                            | 0.1      |
| `FilePreview`   | 默认模型、`file`、`kind`、`text`、`download`          | `open`、`close`、`download`、`error`               | `default`、`unsupported`、`footer`        | `reload`、`download`、`close`                                       | 0.1      |

完整 TypeScript 契约由各包 `etc/*.api.md` 快照维护，PR 会自动检查公共类型变化。

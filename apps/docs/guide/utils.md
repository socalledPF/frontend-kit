# Utils

`@amusite/utils` 是纯函数包，不依赖 Vue、Element 或具体项目。

```ts
import {
  formatDate,
  formatMoney,
  listToTree,
  treeToList,
  safeJsonParse,
  debounce
} from '@amusite/utils'
```

## 高频函数

- `formatDate`：日期格式化。
- `formatMoney`：金额格式化。
- `safeJsonParse`：安全 JSON 解析。
- `listToTree` / `treeToList` / `findTreeNode`：树结构处理。
- `getFileNameFromHeader` / `downloadBlob`：文件下载辅助。
- `debounce` / `throttle` / `sleep` / `uuid`：交互和异步辅助。

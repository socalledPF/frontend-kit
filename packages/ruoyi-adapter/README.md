# @amusite/ruoyi-adapter

Framework-neutral adapters for standard RuoYi pagination, dictionaries, uploads,
imports, exports, and permission data. Token storage, routing, UI messages, and
server-specific response differences remain host-configurable.

```ts
import { createRuoyiUploadRequest, createRuoyiRequestAdapter } from '@amusite/ruoyi-adapter'
import { createRequest } from '@amusite/request'

const request = createRequest({ adapter: createRuoyiRequestAdapter({ getToken }) })
const upload = createRuoyiUploadRequest(request)
```

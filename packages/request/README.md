# @amusite/request

An Axios-based request client with host-provided authentication and error adapters.
It does not import router, storage, or UI framework APIs.

```ts
import { createRequest } from '@amusite/request'

const request = createRequest({ baseURL: '/api' })
```

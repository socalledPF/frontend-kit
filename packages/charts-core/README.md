# @amusite/charts-core

Framework-neutral chart contracts, number formatters, metric calculations, data transforms, and
ECharts-compatible option presets used by Amusite chart components.

```ts
import { createTrendOption, formatCompactNumber } from '@amusite/charts-core'

const option = createTrendOption({
  data: [{ month: 'Jan', sales: 12000 }],
  dimension: 'month',
  series: [{ key: 'sales', label: 'Sales', type: 'bar' }]
})

formatCompactNumber(12000, { locale: 'en-US' }) // 12K
```

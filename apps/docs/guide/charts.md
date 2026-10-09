# ECharts 业务图表

`@amusite/vue3-echarts-business` 面向 Vue 3 + Element Plus 后台系统，封装实例生命周期、响应式尺寸、加载/空/异常状态、图片下载和常见经营图表。ECharts 作为 peer dependency，由宿主决定版本和主题。

## 安装

```bash
pnpm add @amusite/vue3-echarts-business echarts@^6
```

```ts
import { createApp } from 'vue'
import Vue3EChartsBusiness from '@amusite/vue3-echarts-business'
import '@amusite/vue3-echarts-business/style.css'

createApp(App).use(Vue3EChartsBusiness).mount('#app')
```

按需使用时可从子路径导入，样式仍只需引入一次：

```ts
import XTrendChart from '@amusite/vue3-echarts-business/trend-chart'
import { useChartRequest } from '@amusite/vue3-echarts-business/use-chart-request'
```

## 趋势与指标

```vue
<script setup lang="ts">
const trend = [
  { date: '10-07', amount: 18600, orders: 286 },
  { date: '10-08', amount: 22100, orders: 312 },
  { date: '10-09', amount: 26400, orders: 348 }
]
const series = [
  { key: 'amount', label: '成交额', type: 'bar', prefix: '¥' },
  { key: 'orders', label: '订单数', type: 'line', unit: ' 单', yAxisIndex: 1 }
]
</script>

<template>
  <XMetricCard
    title="本月成交额"
    :value="128460"
    :previous-value="119820"
    :target="150000"
    prefix="¥"
    :trend="[18, 23, 21, 28, 34]"
  />
  <XTrendChart :data="trend" dimension="date" :series="series" />
</template>
```

`XMetricCard` 支持同比增幅、目标完成度和迷你趋势图。`positive-is-good="false"` 可用于退款率、故障率等数值下降更好的指标。

## 图表面板

`XChartPanel` 将标题、筛选器、图表/表格切换、刷新、图片下载和全屏组合成统一容器。内部的第一个业务图表会自动注册实例，无需手动传递 ECharts 对象。

```vue
<XChartPanel
  v-model:view="view"
  title="经营趋势"
  show-table-toggle
  refreshable
  :refreshing="loading"
  @refresh="refresh"
>
  <XTrendChart :data="data" dimension="date" :series="series" :loading="loading" />
  <template #filters><el-date-picker v-model="dateRange" type="daterange" /></template>
  <template #table><el-table :data="data" /></template>
</XChartPanel>
```

面板暴露 `downloadImage()`、`toggleFullscreen()` 和当前图表控制器。图片下载只在浏览器端执行。

## 排名图

```vue
<XRankChart
  :data="regions"
  series-name="成交额"
  prefix="¥"
  :top-n="10"
  show-others
  @item-click="openRegion"
/>
```

排名图自动排序、截断长标签，并可将 Top N 之外的数据聚合为“其他”。原始业务对象可放在数据项的 `raw` 字段中。

## 通用图表

`XChart` 接收标准 ECharts `option`，适用于无法由趋势图和排名图表达的场景。它负责初始化、销毁、ResizeObserver、事件转发与状态覆盖层，并暴露：

- `getInstance()`、`resize()`、`clear()`
- `setOption(option, options)`、`dispatchAction(payload)`
- `toDataURL(options)`

组件会转发常用 ECharts 事件。监听名称保持小写，例如 `@click`、`@legendselectchanged`、`@datazoom`。

## 请求组合

`useChartRequest` 统一处理 loading、error、刷新、参数监听、轮询、取消以及迟到响应覆盖问题。

```ts
const { data, loading, error, refresh, cancel } = useChartRequest({
  params: () => ({ beginTime: range.value[0], endTime: range.value[1] }),
  request: (params, context) => getSalesTrend(params, { signal: context.signal }),
  transform: (response) => response.data,
  immediate: true,
  pollInterval: 60_000
})
```

组件卸载或新请求开始时，旧请求会通过 `AbortController` 取消；即使请求客户端不支持取消，迟到结果也不会覆盖新数据。

## RuoYi 数据映射

接口响应应在业务层转换成扁平数组，组件不绑定后端字段：

```ts
const { data, loading, error } = useChartRequest({
  request: () => request.get('/report/sales/trend'),
  transform: (response) =>
    response.data.map((item) => ({
      date: item.statDate,
      amount: item.saleAmount,
      orders: item.orderCount
    }))
})
```

## Core 工具

`@amusite/charts-core` 不依赖 Vue 和 ECharts，可在接口适配、SSR 或测试代码中使用：

- `formatChartValue`、`formatCompactNumber`、`formatPercent`
- `calculateGrowthRate`、`calculateCompletionRate`
- `normalizeChartRows`、`topNWithOthers`、`truncateChartLabel`
- `createTrendOption`、`createRankOption`、`createSparklineOption`

图表包默认启用 ECharts 的按需模块注册，业务代码不应再重复调用 `echarts.use()`。需要地图、饼图等 P1 能力时，应在对应业务组件内统一注册，避免各项目产生不同运行时组合。

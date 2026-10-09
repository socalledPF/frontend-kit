<script setup lang="ts">
import { computed, ref } from 'vue'
import { createTrendOption, type ChartRow, type ChartSeriesField } from '@amusite/charts-core'
import Chart from './Chart.vue'
import type { EChartsCoreOption, EChartsType, SetOptionOpts } from '../echarts'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    data?: ChartRow[]
    dimension: string
    series: ChartSeriesField[]
    colors?: string[]
    locale?: string
    showLegend?: boolean
    showDataZoom?: boolean
    dataZoomThreshold?: number
    optionOverrides?: EChartsCoreOption
    height?: string | number
    loading?: boolean
    error?: unknown
    emptyText?: string
    ariaLabel?: string
  }>(),
  {
    data: () => [],
    colors: undefined,
    locale: 'zh-CN',
    showLegend: undefined,
    showDataZoom: undefined,
    dataZoomThreshold: 30,
    optionOverrides: () => ({}),
    height: 320,
    loading: false,
    error: undefined,
    emptyText: '',
    ariaLabel: ''
  }
)
const emit = defineEmits<{
  ready: [chart: EChartsType]
  'point-click': [params: unknown, row: unknown]
  error: [error: unknown]
}>()
const chartRef = ref<InstanceType<typeof Chart>>()
const option = computed<EChartsCoreOption>(() => ({
  ...createTrendOption({
    data: props.data,
    dimension: props.dimension,
    series: props.series,
    colors: props.colors,
    locale: props.locale,
    showLegend: props.showLegend,
    showDataZoom: props.showDataZoom,
    dataZoomThreshold: props.dataZoomThreshold,
    emptyText: props.emptyText
  }),
  ...props.optionOverrides
}))
function handleClick(params: unknown) {
  emit('point-click', params, (params as { data?: unknown } | undefined)?.data)
}
defineExpose({
  getInstance: () => chartRef.value?.getInstance(),
  resize: () => chartRef.value?.resize(),
  setOption: (next: EChartsCoreOption, options?: SetOptionOpts) =>
    chartRef.value?.setOption(next, options),
  toDataURL: (options?: Record<string, unknown>) => chartRef.value?.toDataURL(options)
})
</script>

<template>
  <Chart
    ref="chartRef"
    v-bind="$attrs"
    :option="option"
    :height="height"
    :loading="loading"
    :error="error"
    :empty="data.length === 0"
    :empty-text="emptyText"
    :aria-label="ariaLabel"
    @ready="emit('ready', $event)"
    @click="handleClick"
    @error="emit('error', $event)"
  >
    <template #loading="scope"
      ><slot name="loading" v-bind="scope">{{ scope.text }}</slot></template
    >
    <template #empty="scope"
      ><slot name="empty" v-bind="scope">{{ scope.text }}</slot></template
    >
    <template #error="scope"
      ><slot name="error" v-bind="scope">{{ scope.text }}</slot></template
    >
  </Chart>
</template>

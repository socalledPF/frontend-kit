<script setup lang="ts">
import { computed, ref } from 'vue'
import { createRankOption, type RankChartItem } from '@amusite/charts-core'
import Chart from './Chart.vue'
import { useChartsContext } from '../context'
import type { EChartsCoreOption, EChartsType, SetOptionOpts } from '../echarts'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    data?: RankChartItem[]
    seriesName?: string
    topN?: number
    showOthers?: boolean
    othersLabel?: string
    color?: string
    colors?: string[]
    unit?: string
    prefix?: string
    locale?: string
    precision?: number
    maxLabelLength?: number
    optionOverrides?: EChartsCoreOption
    height?: string | number
    loading?: boolean
    error?: unknown
    emptyText?: string
    ariaLabel?: string
  }>(),
  {
    data: () => [],
    seriesName: '',
    topN: 10,
    showOthers: false,
    othersLabel: '',
    color: undefined,
    colors: undefined,
    unit: '',
    prefix: '',
    locale: 'zh-CN',
    precision: 1,
    maxLabelLength: 12,
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
  'item-click': [params: unknown, item: unknown]
  error: [error: unknown]
}>()
const charts = useChartsContext()
const chartRef = ref<InstanceType<typeof Chart>>()
const option = computed<EChartsCoreOption>(() => ({
  ...createRankOption({
    data: props.data,
    seriesName: props.seriesName,
    topN: props.topN,
    showOthers: props.showOthers,
    othersLabel: props.othersLabel || charts.t('others'),
    color: props.color,
    colors: props.colors,
    unit: props.unit,
    prefix: props.prefix,
    locale: props.locale,
    precision: props.precision,
    maxLabelLength: props.maxLabelLength,
    emptyText: props.emptyText
  }),
  ...props.optionOverrides
}))
function handleClick(params: unknown) {
  emit('item-click', params, (params as { data?: unknown } | undefined)?.data)
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

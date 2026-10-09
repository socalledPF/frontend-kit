<script setup lang="ts">
import {
  computed,
  inject,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useSlots,
  watch
} from 'vue'
import { chartPanelContextKey, type ChartController } from '../chart-panel-context'
import {
  initECharts,
  type EChartsCoreOption,
  type EChartsType,
  type SetOptionOpts
} from '../echarts'
import { useChartsContext } from '../context'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    option?: EChartsCoreOption
    theme?: string | Record<string, unknown>
    renderer?: 'canvas' | 'svg'
    height?: string | number
    width?: string | number
    autoResize?: boolean
    loading?: boolean
    loadingOptions?: Record<string, unknown>
    empty?: boolean
    emptyText?: string
    error?: unknown
    errorText?: string
    ariaLabel?: string
    notMerge?: boolean
    lazyUpdate?: boolean
    replaceMerge?: string | string[]
    initOptions?: Record<string, unknown>
    events?: Record<string, (params: unknown, chart: EChartsType) => void>
  }>(),
  {
    option: () => ({}),
    theme: undefined,
    renderer: 'canvas',
    height: 320,
    width: '100%',
    autoResize: true,
    loading: false,
    loadingOptions: () => ({}),
    empty: false,
    emptyText: '',
    error: undefined,
    errorText: '',
    ariaLabel: '',
    notMerge: false,
    lazyUpdate: false,
    replaceMerge: undefined,
    initOptions: () => ({}),
    events: () => ({})
  }
)
const emit = defineEmits<{
  ready: [chart: EChartsType]
  click: [params: unknown, chart: EChartsType]
  dblclick: [params: unknown, chart: EChartsType]
  legendselectchanged: [params: unknown, chart: EChartsType]
  datazoom: [params: unknown, chart: EChartsType]
  rendered: [params: unknown, chart: EChartsType]
  finished: [params: unknown, chart: EChartsType]
  error: [error: unknown]
}>()
const slots = useSlots()
const charts = useChartsContext()
const panel = inject(chartPanelContextKey, undefined)
const rootRef = ref<HTMLElement>()
const canvasRef = ref<HTMLElement>()
const instance = shallowRef<EChartsType>()
const boundEvents: Array<{ name: string; handler: (params: unknown) => void }> = []
let observer: ResizeObserver | undefined
let windowListening = false

const dimensionStyle = (value: string | number) =>
  typeof value === 'number' ? `${Math.max(0, value)}px` : value
const rootStyle = computed(() => ({
  width: dimensionStyle(props.width),
  height: dimensionStyle(props.height)
}))
const resolvedEmptyText = computed(() => props.emptyText || charts.t('empty'))
const resolvedErrorText = computed(() => {
  if (props.errorText) return props.errorText
  if (typeof props.error === 'string') return props.error
  if (props.error instanceof Error && props.error.message) return props.error.message
  return charts.t('error')
})
const setOptionOptions = computed<SetOptionOpts>(() => ({
  notMerge: props.notMerge,
  lazyUpdate: props.lazyUpdate,
  replaceMerge: props.replaceMerge
}))

function reportError(error: unknown) {
  emit('error', error)
}

function unbindEvents() {
  const chart = instance.value
  if (chart) boundEvents.forEach(({ name, handler }) => chart.off(name, handler))
  boundEvents.splice(0)
}

function addEvent(name: string, handler: (params: unknown) => void) {
  instance.value?.on(name, handler)
  boundEvents.push({ name, handler })
}

function bindEvents() {
  const chart = instance.value
  if (!chart) return
  unbindEvents()
  addEvent('click', (params) => emit('click', params, chart))
  addEvent('dblclick', (params) => emit('dblclick', params, chart))
  addEvent('legendselectchanged', (params) => emit('legendselectchanged', params, chart))
  addEvent('datazoom', (params) => emit('datazoom', params, chart))
  addEvent('rendered', (params) => emit('rendered', params, chart))
  addEvent('finished', (params) => emit('finished', params, chart))
  Object.entries(props.events).forEach(([name, handler]) =>
    addEvent(name, (params) => handler(params, chart))
  )
}

function syncLoading() {
  const chart = instance.value
  if (!chart) return
  if (props.loading && !slots.loading) chart.showLoading('default', props.loadingOptions as any)
  else chart.hideLoading()
}

function setOption(option: EChartsCoreOption, options: SetOptionOpts = setOptionOptions.value) {
  if (!instance.value) return
  try {
    instance.value.setOption(option, options)
  } catch (error) {
    reportError(error)
  }
}

function applyOption() {
  if (!instance.value) return
  if (props.empty || props.error) {
    instance.value.clear()
    return
  }
  setOption(props.option)
}

function resize() {
  try {
    instance.value?.resize()
  } catch (error) {
    reportError(error)
  }
}

function getInstance() {
  return instance.value
}

function dispatchAction(payload: Record<string, unknown>) {
  instance.value?.dispatchAction(payload as any)
}

function clear() {
  instance.value?.clear()
}

function toDataURL(options: Record<string, unknown> = {}) {
  return instance.value?.getDataURL(options as any)
}

const controller: ChartController = { getInstance, resize, toDataURL }

function disposeChart() {
  unbindEvents()
  panel?.register(undefined)
  instance.value?.dispose()
  instance.value = undefined
}

function createChart() {
  if (!canvasRef.value || typeof window === 'undefined') return
  try {
    const chart = initECharts(canvasRef.value, props.theme, {
      ...props.initOptions,
      renderer: props.renderer
    } as any)
    instance.value = markRaw(chart)
    bindEvents()
    applyOption()
    syncLoading()
    panel?.register(controller)
    emit('ready', chart)
  } catch (error) {
    reportError(error)
  }
}

async function reinitialize() {
  if (!instance.value) return
  disposeChart()
  await nextTick()
  createChart()
}

function connectResize() {
  if (!props.autoResize || !rootRef.value || typeof window === 'undefined') return
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => resize())
    observer.observe(rootRef.value)
  } else {
    window.addEventListener('resize', resize)
    windowListening = true
  }
}

function disconnectResize() {
  observer?.disconnect()
  observer = undefined
  if (windowListening && typeof window !== 'undefined') window.removeEventListener('resize', resize)
  windowListening = false
}

watch(() => props.option, applyOption, { deep: true })
watch(() => [props.empty, props.error], applyOption)
watch(() => [props.loading, props.loadingOptions], syncLoading, { deep: true })
watch(() => props.events, bindEvents, { deep: true })
watch(
  () => [props.theme, props.renderer, props.initOptions],
  () => void reinitialize(),
  { deep: true }
)
watch(
  () => props.autoResize,
  (value) => {
    disconnectResize()
    if (value) connectResize()
  }
)

onMounted(() => {
  createChart()
  connectResize()
})
onBeforeUnmount(() => {
  disconnectResize()
  disposeChart()
})

defineExpose({ getInstance, resize, setOption, dispatchAction, clear, toDataURL })
</script>

<template>
  <div
    ref="rootRef"
    v-bind="$attrs"
    class="x-chart"
    :style="rootStyle"
    role="img"
    :aria-label="ariaLabel || undefined"
    :aria-busy="loading"
  >
    <div ref="canvasRef" class="x-chart__canvas" />
    <div v-if="error" class="x-chart__state x-chart__state--error" role="alert">
      <slot name="error" :error="error" :text="resolvedErrorText">{{ resolvedErrorText }}</slot>
    </div>
    <div v-else-if="empty" class="x-chart__state x-chart__state--empty">
      <slot name="empty" :text="resolvedEmptyText">{{ resolvedEmptyText }}</slot>
    </div>
    <div v-if="loading && $slots.loading" class="x-chart__state x-chart__state--loading">
      <slot name="loading" :text="charts.t('loading')">{{ charts.t('loading') }}</slot>
    </div>
  </div>
</template>

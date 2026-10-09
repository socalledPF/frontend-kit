<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useSlots } from 'vue'
import { DataAnalysis, Download, FullScreen, Refresh, Tickets } from '@element-plus/icons-vue'
import { chartPanelContextKey, type ChartController } from '../chart-panel-context'
import { useChartsContext } from '../context'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    view?: 'chart' | 'table'
    showTableToggle?: boolean
    refreshable?: boolean
    refreshing?: boolean
    fullscreenable?: boolean
    downloadable?: boolean
    downloadFileName?: string
    downloadOptions?: Record<string, unknown>
  }>(),
  {
    title: '',
    subtitle: '',
    view: 'chart',
    showTableToggle: false,
    refreshable: false,
    refreshing: false,
    fullscreenable: true,
    downloadable: true,
    downloadFileName: 'chart.png',
    downloadOptions: () => ({ pixelRatio: 2, backgroundColor: '#ffffff' })
  }
)
const emit = defineEmits<{
  'update:view': [view: 'chart' | 'table']
  refresh: []
  download: [dataUrl: string, fileName: string]
  'download-error': [error: unknown]
  'fullscreen-change': [fullscreen: boolean]
  'fullscreen-error': [error: unknown]
}>()
const slots = useSlots()
const charts = useChartsContext()
const rootRef = ref<HTMLElement>()
const controller = ref<ChartController>()
const fullscreen = ref(false)
const hasHeader = computed(
  () =>
    Boolean(props.title || props.subtitle) ||
    Boolean(slots.title || slots.subtitle || slots.filters || slots.actions) ||
    props.showTableToggle ||
    props.refreshable ||
    props.fullscreenable ||
    props.downloadable
)

provide(chartPanelContextKey, {
  register(value) {
    controller.value = value
  }
})

function setView(view: 'chart' | 'table') {
  if (view !== props.view) emit('update:view', view)
  if (view === 'chart') void nextTick(() => controller.value?.resize())
}

function downloadImage() {
  try {
    const dataUrl = controller.value?.toDataURL(props.downloadOptions)
    if (!dataUrl) throw new Error('Chart instance is not ready')
    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a')
      anchor.href = dataUrl
      anchor.download = props.downloadFileName
      anchor.click()
    }
    emit('download', dataUrl, props.downloadFileName)
    return dataUrl
  } catch (error) {
    emit('download-error', error)
    return undefined
  }
}

async function toggleFullscreen() {
  if (!rootRef.value || typeof document === 'undefined') return false
  try {
    if (document.fullscreenElement === rootRef.value) await document.exitFullscreen()
    else {
      if (!rootRef.value.requestFullscreen) throw new Error('Fullscreen is not supported')
      await rootRef.value.requestFullscreen()
    }
    return true
  } catch (error) {
    emit('fullscreen-error', error)
    return false
  }
}

function syncFullscreen() {
  fullscreen.value = typeof document !== 'undefined' && document.fullscreenElement === rootRef.value
  controller.value?.resize()
  emit('fullscreen-change', fullscreen.value)
}

onMounted(() => document.addEventListener('fullscreenchange', syncFullscreen))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncFullscreen))
defineExpose({ downloadImage, toggleFullscreen, controller, fullscreen })
</script>

<template>
  <section ref="rootRef" class="x-chart-panel" :class="{ 'is-fullscreen': fullscreen }">
    <header v-if="hasHeader" class="x-chart-panel__header">
      <div class="x-chart-panel__heading">
        <slot name="title"
          ><h3 v-if="title">{{ title }}</h3></slot
        >
        <slot name="subtitle"
          ><p v-if="subtitle">{{ subtitle }}</p></slot
        >
      </div>
      <div class="x-chart-panel__tools">
        <slot name="filters" />
        <el-button-group v-if="showTableToggle" class="x-chart-panel__view-toggle">
          <el-tooltip :content="charts.t('chartView')">
            <el-button
              :type="view === 'chart' ? 'primary' : 'default'"
              :icon="DataAnalysis"
              :aria-label="charts.t('chartView')"
              @click="setView('chart')"
            />
          </el-tooltip>
          <el-tooltip :content="charts.t('tableView')">
            <el-button
              :type="view === 'table' ? 'primary' : 'default'"
              :icon="Tickets"
              :aria-label="charts.t('tableView')"
              @click="setView('table')"
            />
          </el-tooltip>
        </el-button-group>
        <slot name="actions" />
        <el-tooltip v-if="refreshable" :content="charts.t('refresh')">
          <el-button
            :icon="Refresh"
            :loading="refreshing"
            :aria-label="charts.t('refresh')"
            @click="emit('refresh')"
          />
        </el-tooltip>
        <el-tooltip v-if="downloadable" :content="charts.t('download')">
          <el-button
            :icon="Download"
            :disabled="!controller"
            :aria-label="charts.t('download')"
            @click="downloadImage"
          />
        </el-tooltip>
        <el-tooltip
          v-if="fullscreenable"
          :content="fullscreen ? charts.t('exitFullscreen') : charts.t('fullscreen')"
        >
          <el-button
            :icon="FullScreen"
            :aria-label="fullscreen ? charts.t('exitFullscreen') : charts.t('fullscreen')"
            @click="toggleFullscreen"
          />
        </el-tooltip>
      </div>
    </header>
    <div class="x-chart-panel__body">
      <div v-show="view === 'chart'" class="x-chart-panel__chart"><slot /></div>
      <div v-show="view === 'table'" class="x-chart-panel__table"><slot name="table" /></div>
    </div>
  </section>
</template>

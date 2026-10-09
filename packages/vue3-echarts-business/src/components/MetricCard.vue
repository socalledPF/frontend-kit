<script setup lang="ts">
import { computed } from 'vue'
import { Bottom, Minus, Top } from '@element-plus/icons-vue'
import {
  calculateCompletionRate,
  calculateGrowthRate,
  createSparklineOption,
  formatChartValue,
  formatPercent
} from '@amusite/charts-core'
import Chart from './Chart.vue'
import { useChartsContext } from '../context'

const props = withDefaults(
  defineProps<{
    title: string
    value?: unknown
    previousValue?: unknown
    growthRate?: number | null
    target?: unknown
    prefix?: string
    unit?: string
    locale?: string
    precision?: number
    compact?: boolean
    positiveIsGood?: boolean
    trend?: number[]
    color?: string
    loading?: boolean
    error?: unknown
  }>(),
  {
    value: undefined,
    previousValue: undefined,
    growthRate: undefined,
    target: undefined,
    prefix: '',
    unit: '',
    locale: 'zh-CN',
    precision: 1,
    compact: true,
    positiveIsGood: true,
    trend: () => [],
    color: '#2563eb',
    loading: false,
    error: undefined
  }
)
const charts = useChartsContext()
const displayValue = computed(() =>
  formatChartValue(props.value, {
    locale: props.locale,
    precision: props.precision,
    compact: props.compact,
    prefix: props.prefix,
    unit: props.unit
  })
)
const resolvedGrowth = computed(() =>
  props.growthRate !== undefined
    ? props.growthRate
    : calculateGrowthRate(props.value, props.previousValue)
)
const direction = computed<'up' | 'down' | 'flat'>(() =>
  resolvedGrowth.value == null || resolvedGrowth.value === 0
    ? 'flat'
    : resolvedGrowth.value > 0
      ? 'up'
      : 'down'
)
const trendIcon = computed(() =>
  direction.value === 'up' ? Top : direction.value === 'down' ? Bottom : Minus
)
const growthClass = computed(() => {
  if (direction.value === 'flat') return 'is-neutral'
  const positive = direction.value === 'up'
  return positive === props.positiveIsGood ? 'is-positive' : 'is-negative'
})
const growthLabel = computed(() =>
  direction.value === 'up'
    ? charts.t('increase')
    : direction.value === 'down'
      ? charts.t('decrease')
      : charts.t('unchanged')
)
const completion = computed(() => calculateCompletionRate(props.value, props.target))
const progressWidth = computed(() => `${Math.max(0, Math.min(100, completion.value ?? 0))}%`)
const sparklineOption = computed(() =>
  createSparklineOption({ data: props.trend, color: props.color })
)
const errorText = computed(() =>
  typeof props.error === 'string'
    ? props.error
    : props.error instanceof Error
      ? props.error.message
      : charts.t('error')
)
const ariaLabel = computed(() => `${props.title}: ${displayValue.value}`)
</script>

<template>
  <article class="x-metric-card" :aria-label="ariaLabel" :aria-busy="loading">
    <template v-if="loading">
      <div class="x-metric-card__skeleton x-metric-card__skeleton--label" />
      <div class="x-metric-card__skeleton x-metric-card__skeleton--value" />
      <div class="x-metric-card__skeleton x-metric-card__skeleton--meta" />
    </template>
    <div v-else-if="error" class="x-metric-card__error" role="alert">
      <slot name="error" :error="error">{{ errorText }}</slot>
    </div>
    <template v-else>
      <div class="x-metric-card__content">
        <div class="x-metric-card__main">
          <slot name="title"
            ><div class="x-metric-card__title">{{ title }}</div></slot
          >
          <slot name="value" :value="value" :formatted="displayValue">
            <div class="x-metric-card__value">{{ displayValue }}</div>
          </slot>
          <slot
            name="growth"
            :rate="resolvedGrowth"
            :direction="direction"
            :class-name="growthClass"
          >
            <div v-if="resolvedGrowth !== null" class="x-metric-card__growth" :class="growthClass">
              <el-icon><component :is="trendIcon" /></el-icon>
              <span>{{ formatPercent(Math.abs(resolvedGrowth ?? 0), { locale, precision }) }}</span>
              <span class="x-metric-card__growth-label">{{ growthLabel }}</span>
            </div>
          </slot>
        </div>
        <Chart
          v-if="trend.length"
          class="x-metric-card__sparkline"
          :option="sparklineOption"
          :height="64"
          width="112px"
          renderer="svg"
          :aria-label="title"
        />
      </div>
      <div v-if="completion !== null" class="x-metric-card__target">
        <div class="x-metric-card__target-meta">
          <span>{{ charts.t('completion') }}</span
          ><strong>{{ formatPercent(completion) }}</strong>
        </div>
        <div
          class="x-metric-card__progress"
          role="progressbar"
          :aria-label="`${title} ${charts.t('completion')}`"
          :aria-valuenow="completion ?? 0"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span :style="{ width: progressWidth, backgroundColor: color }" />
        </div>
      </div>
      <slot name="footer" />
    </template>
  </article>
</template>

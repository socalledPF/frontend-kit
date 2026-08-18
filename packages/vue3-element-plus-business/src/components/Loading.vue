<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import type { LoadingSize } from '@amusite/business-core'
import { useBusinessContext } from '../context'

let bodyLockCount = 0
let originalBodyOverflow = ''
function lockBody() {
  if (typeof document === 'undefined') return
  if (bodyLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  bodyLockCount += 1
}
function unlockBody() {
  if (typeof document === 'undefined' || bodyLockCount === 0) return
  bodyLockCount -= 1
  if (bodyLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow
    originalBodyOverflow = ''
  }
}
const duration = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

const props = withDefaults(
  defineProps<{
    loading?: boolean
    text?: string
    fullscreen?: boolean
    lock?: boolean
    delay?: number
    minDuration?: number
    background?: string
    spinnerClass?: string
    maskClass?: string
    size?: LoadingSize
    zIndex?: number
  }>(),
  {
    loading: false,
    text: undefined,
    fullscreen: false,
    lock: true,
    delay: 0,
    minDuration: 0,
    background: 'rgba(255, 255, 255, 0.82)',
    spinnerClass: '',
    maskClass: '',
    size: 'medium',
    zIndex: 2000
  }
)
const emit = defineEmits<{ change: [value: boolean] }>()
const business = useBusinessContext()
const resolvedText = computed(() =>
  props.text === undefined ? business.t('loading.text') : props.text
)
const attrs = useAttrs()
const slots = defineSlots<{
  default?: () => unknown
  spinner?: (props: { loading: boolean }) => unknown
  tip?: (props: { loading: boolean }) => unknown
}>()
const displayedLoading = ref(false)
const shownAt = ref(0)
let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let bodyLocked = false
const standalone = computed(() => !slots.default && !props.fullscreen)

function syncBodyLock() {
  const shouldLock = displayedLoading.value && props.fullscreen && props.lock
  if (shouldLock && !bodyLocked) {
    lockBody()
    bodyLocked = true
  } else if (!shouldLock && bodyLocked) {
    unlockBody()
    bodyLocked = false
  }
}
function setDisplayed(value: boolean) {
  if (displayedLoading.value === value) return syncBodyLock()
  displayedLoading.value = value
  if (value) shownAt.value = Date.now()
  syncBodyLock()
  emit('change', value)
}
function show() {
  if (showTimer) clearTimeout(showTimer)
  showTimer = undefined
  setDisplayed(true)
}
function hide() {
  if (hideTimer) clearTimeout(hideTimer)
  if (!displayedLoading.value) return
  const remaining = duration(props.minDuration) - (Date.now() - shownAt.value)
  if (remaining > 0) {
    hideTimer = setTimeout(() => {
      hideTimer = undefined
      setDisplayed(false)
    }, remaining)
  } else setDisplayed(false)
}
watch(
  () => props.loading,
  (value) => {
    if (showTimer) clearTimeout(showTimer)
    showTimer = undefined
    if (value) {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = undefined
      if (displayedLoading.value) return
      const wait = duration(props.delay)
      if (wait) showTimer = setTimeout(() => props.loading && show(), wait)
      else show()
    } else hide()
  },
  { immediate: true }
)
watch(() => [props.fullscreen, props.lock], syncBodyLock)
onBeforeUnmount(() => {
  if (showTimer) clearTimeout(showTimer)
  if (hideTimer) clearTimeout(hideTimer)
  if (bodyLocked) unlockBody()
})
defineExpose({ show, hide, displayedLoading })
</script>

<template>
  <div
    v-bind="attrs"
    class="x-loading"
    :class="{
      'x-loading--active': displayedLoading,
      'x-loading--fullscreen': fullscreen,
      'x-loading--standalone': standalone && displayedLoading
    }"
    :aria-busy="displayedLoading"
  >
    <slot />
    <transition name="x-loading-fade" appear>
      <div
        v-if="displayedLoading"
        class="x-loading__mask"
        :class="[
          `x-loading__mask--${size}`,
          { 'x-loading__mask--fullscreen': fullscreen, 'x-loading__mask--standalone': standalone },
          maskClass
        ]"
        :style="{ backgroundColor: background, zIndex }"
        role="status"
        aria-live="polite"
        :aria-label="resolvedText || business.t('loading.text')"
      >
        <div class="x-loading__indicator">
          <slot name="spinner" :loading="displayedLoading">
            <i
              v-if="spinnerClass"
              class="x-loading__spinner-icon"
              :class="spinnerClass"
              aria-hidden="true"
            />
            <span v-else class="x-loading__spinner" aria-hidden="true" />
          </slot>
          <slot name="tip" :loading="displayedLoading"
            ><span v-if="resolvedText" class="x-loading__text">{{ resolvedText }}</span></slot
          >
        </div>
      </div>
    </transition>
  </div>
</template>

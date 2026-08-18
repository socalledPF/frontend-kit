<script setup lang="ts">
import { computed, nextTick, onMounted, onUpdated, ref } from 'vue'
import type { PaginationPayload } from '@amusite/business-core'
import { useBusinessContext } from '../context'

const props = withDefaults(
  defineProps<{
    total: number
    page?: number
    limit?: number
    pageSizes?: number[]
    pagerCount?: number
    layout?: string
    background?: boolean
    autoScroll?: boolean
    hidden?: boolean
  }>(),
  {
    page: 1,
    limit: 20,
    pageSizes: () => [10, 20, 30, 50],
    pagerCount: () => (typeof document !== 'undefined' && document.body.clientWidth < 992 ? 5 : 7),
    layout: 'total, sizes, prev, pager, next, jumper',
    background: true,
    autoScroll: true,
    hidden: false
  }
)

const emit = defineEmits<{
  'update:page': [value: number]
  'update:limit': [value: number]
  pagination: [payload: PaginationPayload]
}>()

const business = useBusinessContext()
const rootRef = ref<HTMLElement>()
const currentPage = computed({ get: () => props.page, set: (value) => emit('update:page', value) })
const pageSize = computed({ get: () => props.limit, set: (value) => emit('update:limit', value) })

function patchAccessibility() {
  void nextTick(() => {
    rootRef.value
      ?.querySelector('.btn-prev')
      ?.setAttribute('aria-label', business.t('table.previousPage'))
    rootRef.value
      ?.querySelector('.btn-next')
      ?.setAttribute('aria-label', business.t('table.nextPage'))
    rootRef.value
      ?.querySelector('.el-pagination__sizes input')
      ?.setAttribute('aria-label', business.t('table.pageSize'))
    rootRef.value
      ?.querySelector('.el-pagination__jump input')
      ?.setAttribute('aria-label', business.t('table.jumpToPage'))
  })
}

onMounted(patchAccessibility)
onUpdated(patchAccessibility)

function scrollTop() {
  if (props.autoScroll && typeof window !== 'undefined')
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleSizeChange(value: number) {
  const page = currentPage.value * value > props.total ? 1 : currentPage.value
  if (page !== currentPage.value) currentPage.value = page
  emit('pagination', { page, limit: value })
  scrollTop()
}

function handleCurrentChange(value: number) {
  emit('pagination', { page: value, limit: pageSize.value })
  scrollTop()
}
</script>

<template>
  <div ref="rootRef" class="x-pagination pagination-container" :class="{ hidden }">
    <el-pagination
      v-bind="$attrs"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :background="background"
      :layout="layout"
      :page-sizes="pageSizes"
      :pager-count="pagerCount"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

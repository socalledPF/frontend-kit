<script setup lang="ts">
import { computed, inject } from 'vue'
import { evaluatePermission } from '@amusite/business-core'
import type { PermissionChecker, PermissionMatchMode, PermissionRequirement } from '@amusite/business-core'
import { permissionProviderKey } from '../permission'

const props = withDefaults(defineProps<{
  permission?: PermissionRequirement
  roles?: PermissionRequirement
  match?: PermissionMatchMode
  checker?: PermissionChecker
  tag?: string
}>(), { match: 'any', tag: 'span' })
defineSlots<{
  default?: (scope: { allowed: boolean; permission?: PermissionRequirement; roles?: PermissionRequirement }) => unknown
  fallback?: (scope: { allowed: boolean; permission?: PermissionRequirement; roles?: PermissionRequirement }) => unknown
}>()
const provider = inject(permissionProviderKey, {})
const allowed = computed(() => evaluatePermission({ permission: props.permission, roles: props.roles, match: props.match, checker: props.checker }, provider))
defineExpose({ allowed })
</script>

<template>
  <slot v-if="allowed" :allowed="allowed" :permission="permission" :roles="roles" />
  <component v-else-if="$slots.fallback" :is="tag" class="x-permission x-permission--hidden">
    <slot name="fallback" :allowed="allowed" :permission="permission" :roles="roles" />
  </component>
</template>

import Vue, {
  type CreateElement,
  type DirectiveOptions,
  type VNode,
  type VNodeDirective
} from 'vue'
import { evaluatePermission } from '@amusite/business-core'
import type {
  PermissionChecker,
  PermissionDirectiveValue,
  PermissionMatchMode,
  PermissionProvider,
  PermissionRequirement
} from '../types'

const DEFAULT_PROVIDER: PermissionProvider = {}
const originalDisplay = new WeakMap<HTMLElement, string>()
let permissionProvider: PermissionProvider = DEFAULT_PROVIDER

export function configurePermission(provider: PermissionProvider = DEFAULT_PROVIDER): void {
  permissionProvider = provider
}

export function checkPermission(
  options: PermissionDirectiveValue = {},
  provider: PermissionProvider = permissionProvider
): boolean {
  return evaluatePermission(options, provider)
}

function normalizeDirectiveValue(binding: VNodeDirective): PermissionDirectiveValue {
  const value = binding.value as PermissionDirectiveValue | PermissionRequirement | undefined

  if (typeof value === 'string' || Array.isArray(value)) {
    return {
      permission: value,
      match: binding.modifiers?.all ? 'all' : 'any'
    }
  }

  return {
    ...(value || {}),
    match: binding.modifiers?.all ? 'all' : value?.match
  }
}

function updateDirectiveVisibility(element: HTMLElement, binding: VNodeDirective): void {
  if (!originalDisplay.has(element)) {
    originalDisplay.set(element, element.style.display)
  }

  element.style.display = checkPermission(normalizeDirectiveValue(binding))
    ? originalDisplay.get(element) || ''
    : 'none'
}

export const PermissionDirective: DirectiveOptions = {
  inserted(element, binding) {
    updateDirectiveVisibility(element as HTMLElement, binding)
  },
  componentUpdated(element, binding) {
    updateDirectiveVisibility(element as HTMLElement, binding)
  },
  unbind(element) {
    originalDisplay.delete(element as HTMLElement)
  }
}

export default Vue.extend({
  name: 'Permission',
  props: {
    permission: {
      type: [String, Array],
      default: undefined
    },
    roles: {
      type: [String, Array],
      default: undefined
    },
    match: {
      type: String,
      default: 'any',
      validator: (value: string) => ['any', 'all'].includes(value)
    },
    checker: {
      type: Function,
      default: undefined
    },
    tag: {
      type: String,
      default: 'span'
    }
  },
  computed: {
    allowed(this: any): boolean {
      return checkPermission({
        permission: this.permission,
        roles: this.roles,
        match: this.match as PermissionMatchMode,
        checker: this.checker as PermissionChecker | undefined
      })
    }
  },
  render(this: any, h: CreateElement): VNode {
    const scope = {
      allowed: this.allowed,
      permission: this.permission,
      roles: this.roles
    }

    if (!this.allowed) {
      const fallback = this.$scopedSlots.fallback?.(scope) || this.$slots.fallback
      return fallback?.length === 1
        ? fallback[0]
        : h(this.tag, { class: 'x-permission x-permission--hidden' }, fallback)
    }

    const content = this.$scopedSlots.default?.(scope) || this.$slots.default || []
    return content.length === 1 ? content[0] : h(this.tag, { class: 'x-permission' }, content)
  }
})

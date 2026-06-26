import { computed, ref, type ComputedRef, type Ref } from 'vue-demi'

export type SelectionKey = string | number

export interface UseSelectionReturn<T, Key extends SelectionKey = SelectionKey> {
  selected: Ref<T[]>
  selectedKeys: ComputedRef<Key[]>
  hasSelection: ComputedRef<boolean>
  setSelection: (rows: T[]) => void
  toggle: (row: T, checked?: boolean) => void
  clear: () => void
  isSelected: (row: T) => boolean
}

export function useSelection<T, Key extends SelectionKey = SelectionKey>(
  getRowKey?: (row: T) => Key
): UseSelectionReturn<T, Key> {
  const selected = ref<T[]>([]) as Ref<T[]>

  const selectedKeys = computed(() => {
    if (!getRowKey) {
      return [] as Key[]
    }

    return selected.value.map((row) => getRowKey(row))
  })

  const findIndex = (row: T) => {
    if (!getRowKey) {
      return selected.value.indexOf(row)
    }

    const key = getRowKey(row)
    return selected.value.findIndex((item) => getRowKey(item) === key)
  }

  const isSelected = (row: T) => findIndex(row) >= 0

  const toggle = (row: T, checked = !isSelected(row)) => {
    const index = findIndex(row)

    if (checked && index < 0) {
      selected.value = [...selected.value, row]
      return
    }

    if (!checked && index >= 0) {
      selected.value = selected.value.filter((_, itemIndex) => itemIndex !== index)
    }
  }

  return {
    selected,
    selectedKeys,
    hasSelection: computed(() => selected.value.length > 0),
    setSelection: (rows: T[]) => {
      selected.value = [...rows]
    },
    toggle,
    clear: () => {
      selected.value = []
    },
    isSelected
  }
}

import { reactive } from 'vue-demi'
import type { DictOption, MaybePromise } from '@amusite/shared'

export interface UseDictOptions<Value extends string | number = string | number> {
  loader: (type: string) => MaybePromise<Array<DictOption<Value>>>
  cache?: Map<string, Array<DictOption<Value>>>
  immediateTypes?: string[]
}

export interface UseDictReturn<Value extends string | number = string | number> {
  optionsMap: Record<string, Array<DictOption<Value>>>
  loadingMap: Record<string, boolean>
  load: (type: string, force?: boolean) => Promise<Array<DictOption<Value>>>
  refresh: (type: string) => Promise<Array<DictOption<Value>>>
  getOptions: (type: string) => Array<DictOption<Value>>
  getLabel: (type: string, value: Value, fallback?: string) => string
  clearCache: (type?: string) => void
}

export function useDict<Value extends string | number = string | number>(
  options: UseDictOptions<Value>
): UseDictReturn<Value> {
  const cache = options.cache ?? new Map<string, Array<DictOption<Value>>>()
  const optionsMap = reactive({}) as Record<string, Array<DictOption<Value>>>
  const loadingMap = reactive({}) as Record<string, boolean>

  const getOptions = (type: string) => optionsMap[type] ?? cache.get(type) ?? []

  const load = async (type: string, force = false) => {
    if (!force && cache.has(type)) {
      optionsMap[type] = cache.get(type) ?? []
      return optionsMap[type]
    }

    loadingMap[type] = true

    try {
      const dictOptions = await options.loader(type)
      cache.set(type, dictOptions)
      optionsMap[type] = dictOptions
      return dictOptions
    } finally {
      loadingMap[type] = false
    }
  }

  const clearCache = (type?: string) => {
    if (type) {
      cache.delete(type)
      delete optionsMap[type]
      return
    }

    cache.clear()
    Object.keys(optionsMap).forEach((key) => {
      delete optionsMap[key]
    })
  }

  options.immediateTypes?.forEach((type) => {
    void load(type)
  })

  return {
    optionsMap,
    loadingMap,
    load,
    refresh: (type: string) => load(type, true),
    getOptions,
    getLabel: (type: string, value: Value, fallback = '') => {
      return getOptions(type).find((item) => item.value === value)?.label ?? fallback
    },
    clearCache
  }
}

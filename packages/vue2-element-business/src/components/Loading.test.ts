import Vue from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Loading from './Loading'

interface LoadingInstance extends Vue {
  displayedLoading: boolean
  handleLoadingChange: (value: boolean) => void
}

const instances: LoadingInstance[] = []

function createLoading(propsData: Record<string, unknown>): LoadingInstance {
  const LoadingConstructor = Loading as unknown as new (options: {
    propsData: Record<string, unknown>
  }) => LoadingInstance
  const instance = new LoadingConstructor({ propsData })
  instances.push(instance)
  return instance
}

afterEach(() => {
  instances.splice(0).forEach((instance) => instance.$destroy())
  vi.useRealTimers()
})

describe('Loading', () => {
  it('reflects an immediately active loading state', () => {
    const instance = createLoading({ loading: true })

    expect(instance.displayedLoading).toBe(true)
  })

  it('supports delaying the visible loading state', () => {
    vi.useFakeTimers()
    const instance = createLoading({ loading: true, delay: 120 })

    expect(instance.displayedLoading).toBe(false)
    vi.advanceTimersByTime(119)
    expect(instance.displayedLoading).toBe(false)
    vi.advanceTimersByTime(1)
    expect(instance.displayedLoading).toBe(true)
  })

  it('cancels a delayed mask when loading finishes early', () => {
    vi.useFakeTimers()
    const instance = createLoading({ loading: true, delay: 120 })

    instance.handleLoadingChange(false)
    vi.advanceTimersByTime(120)
    expect(instance.displayedLoading).toBe(false)
  })

  it('keeps the mask visible for the configured minimum duration', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const instance = createLoading({ loading: true, minDuration: 300 })

    instance.handleLoadingChange(false)
    vi.advanceTimersByTime(299)
    expect(instance.displayedLoading).toBe(true)
    vi.advanceTimersByTime(1)
    expect(instance.displayedLoading).toBe(false)
  })
})

import { mount } from '@vue/test-utils'
import { h, nextTick, type Component } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const engine = vi.hoisted(() => {
  const instances: Array<Record<string, any>> = []
  const init = vi.fn(() => {
    const handlers = new Map<string, (params: unknown) => void>()
    const instance = {
      handlers,
      on: vi.fn((name: string, handler: (params: unknown) => void) => handlers.set(name, handler)),
      off: vi.fn((name: string) => handlers.delete(name)),
      setOption: vi.fn(),
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      clear: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      dispatchAction: vi.fn(),
      getDataURL: vi.fn(() => 'data:image/png;base64,chart')
    }
    instances.push(instance)
    return instance
  })
  return { init, instances }
})

vi.mock('../echarts', () => ({ initECharts: engine.init }) as any)

import Chart from '../components/Chart.vue'
import ChartPanel from '../components/ChartPanel.vue'
import MetricCard from '../components/MetricCard.vue'
import RankChart from '../components/RankChart.vue'
import TrendChart from '../components/TrendChart.vue'
import { createChartsContext, Vue3EChartsBusiness } from '../index'

const TestChart = Chart as Component
const TestChartPanel = ChartPanel as Component
const TestMetricCard = MetricCard as Component
const TestRankChart = RankChart as Component
const TestTrendChart = TrendChart as Component

const wrappers: Array<ReturnType<typeof mount>> = []
const track = <T extends ReturnType<typeof mount>>(wrapper: T): T => {
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  engine.instances.splice(0)
  engine.init.mockClear()
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('Vue3 ECharts business components', () => {
  it('owns chart lifecycle, updates options, loading, events, and exposed methods', async () => {
    const customEvent = vi.fn()
    const wrapper = track(
      mount(TestChart, {
        props: {
          option: { series: [{ type: 'line', data: [1, 2] }] },
          loading: true,
          events: { mouseover: customEvent },
          ariaLabel: 'Sales chart'
        }
      })
    )
    const instance = engine.instances[0]
    expect(engine.init).toHaveBeenCalledTimes(1)
    expect(instance.setOption).toHaveBeenCalled()
    expect(instance.showLoading).toHaveBeenCalled()
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe('Sales chart')

    instance.handlers.get('click')?.({ name: 'Jan' })
    instance.handlers.get('dblclick')?.({ name: 'Jan' })
    instance.handlers.get('legendselectchanged')?.({ selected: {} })
    instance.handlers.get('datazoom')?.({ start: 10 })
    instance.handlers.get('rendered')?.({ elapsedTime: 1 })
    instance.handlers.get('finished')?.({})
    instance.handlers.get('mouseover')?.({ name: 'Jan' })
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual({ name: 'Jan' })
    expect(wrapper.emitted('dblclick')).toHaveLength(1)
    expect(wrapper.emitted('legendselectchanged')).toHaveLength(1)
    expect(wrapper.emitted('datazoom')).toHaveLength(1)
    expect(wrapper.emitted('rendered')).toHaveLength(1)
    expect(wrapper.emitted('finished')).toHaveLength(1)
    expect(customEvent).toHaveBeenCalled()

    await wrapper.setProps({ loading: false, option: { series: [{ data: [3] }] } })
    expect(instance.hideLoading).toHaveBeenCalled()
    expect(instance.setOption).toHaveBeenLastCalledWith(
      { series: [{ data: [3] }] },
      expect.objectContaining({ notMerge: false })
    )
    ;(wrapper.vm as any).resize()
    ;(wrapper.vm as any).setOption({ series: [] })
    ;(wrapper.vm as any).dispatchAction({ type: 'highlight' })
    ;(wrapper.vm as any).clear()
    expect((wrapper.vm as any).getInstance()).toBe(instance)
    expect(instance.resize).toHaveBeenCalled()
    expect(instance.clear).toHaveBeenCalled()
    expect(instance.dispatchAction).toHaveBeenCalledWith({ type: 'highlight' })
    expect((wrapper.vm as any).toDataURL()).toContain('data:image/png')

    wrapper.unmount()
    expect(instance.dispose).toHaveBeenCalled()
  })

  it('renders empty, error, and custom loading states and reinitializes renderer changes', async () => {
    const wrapper = track(
      mount(TestChart, {
        props: { empty: true, emptyText: 'Nothing here' },
        slots: { loading: '<span class="custom-loading">Wait</span>' }
      })
    )
    expect(wrapper.text()).toContain('Nothing here')
    expect(engine.instances[0].clear).toHaveBeenCalled()
    await wrapper.setProps({ empty: false, error: new Error('offline'), loading: true })
    expect(wrapper.text()).toContain('offline')
    expect(wrapper.find('.custom-loading').exists()).toBe(true)
    expect(engine.instances[0].showLoading).not.toHaveBeenCalled()

    await wrapper.setProps({ renderer: 'svg', error: undefined, loading: false })
    await nextTick()
    expect(engine.init).toHaveBeenCalledTimes(2)
    expect(engine.instances[0].dispose).toHaveBeenCalled()
  })

  it('registers charts in panels and supports view, refresh, download, and fullscreen actions', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const wrapper = track(
      mount(TestChartPanel, {
        props: {
          title: 'Sales',
          subtitle: 'Last 7 days',
          showTableToggle: true,
          refreshable: true,
          downloadFileName: 'sales.png'
        },
        slots: {
          default: () => h(TestChart, { option: { series: [] } }),
          table: '<table><tbody><tr><td>Sales table</td></tr></tbody></table>'
        }
      })
    )
    Object.defineProperty(wrapper.element, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen
    })
    expect(wrapper.text()).toContain('Sales')
    expect((wrapper.vm as any).downloadImage()).toContain('data:image/png')
    expect(click).toHaveBeenCalled()
    expect(wrapper.emitted('download')?.[0]?.[1]).toBe('sales.png')

    const buttons = wrapper.findAll('button')
    await buttons.find((button) => button.attributes('aria-label') === '表格视图')?.trigger('click')
    expect(wrapper.emitted('update:view')?.at(-1)).toEqual(['table'])
    await buttons.find((button) => button.attributes('aria-label') === '刷新图表')?.trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    await (wrapper.vm as any).toggleFullscreen()
    expect(requestFullscreen).toHaveBeenCalled()
  })

  it('builds trend and rank charts and forwards business click payloads', () => {
    const trend = track(
      mount(TestTrendChart, {
        props: {
          dimension: 'month',
          data: [{ month: 'Jan', sales: 12 }],
          series: [{ key: 'sales', label: 'Sales' }]
        }
      })
    )
    const trendOption = (trend.findComponent(TestChart).props() as Record<string, unknown>)
      .option as Record<string, unknown>
    expect(trendOption.dataset).toBeTruthy()
    engine.instances[0].handlers.get('click')?.({ data: { month: 'Jan', sales: 12 } })
    expect(trend.emitted('point-click')?.at(-1)?.[1]).toEqual({ month: 'Jan', sales: 12 })
    expect((trend.vm as any).getInstance()).toBe(engine.instances[0])
    ;(trend.vm as any).resize()
    ;(trend.vm as any).setOption({ series: [] })
    expect((trend.vm as any).toDataURL()).toContain('data:image/png')

    const rank = track(
      mount(TestRankChart, {
        props: { data: [{ name: 'Platform', value: 20 }], showOthers: true }
      })
    )
    const rankOption = (rank.findComponent(TestChart).props() as Record<string, unknown>)
      .option as Record<string, unknown>
    expect(rankOption.series).toBeTruthy()
    engine.instances[1].handlers.get('click')?.({ data: { name: 'Platform', value: 20 } })
    expect(rank.emitted('item-click')?.at(-1)?.[1]).toEqual({ name: 'Platform', value: 20 })
    expect((rank.vm as any).getInstance()).toBe(engine.instances[1])
    ;(rank.vm as any).resize()
    ;(rank.vm as any).setOption({ series: [] })
    expect((rank.vm as any).toDataURL()).toContain('data:image/png')
  })

  it('renders wrapper loading, empty, and error slots', async () => {
    const wrapper = track(
      mount(TestTrendChart, {
        props: {
          dimension: 'month',
          data: [{ month: 'Jan', sales: 12 }],
          series: [{ key: 'sales', label: 'Sales' }],
          loading: true
        },
        slots: {
          loading: '<span>Fetching trend</span>',
          empty: '<span>No trend</span>',
          error: '<span>Trend unavailable</span>'
        }
      })
    )
    expect(wrapper.text()).toContain('Fetching trend')
    await wrapper.setProps({ loading: false, data: [] })
    expect(wrapper.text()).toContain('No trend')
    await wrapper.setProps({ data: [{ month: 'Jan', sales: 12 }], error: new Error('offline') })
    expect(wrapper.text()).toContain('Trend unavailable')
  })

  it('renders metric values, growth direction, targets, sparklines, loading, and errors', async () => {
    const wrapper = track(
      mount(TestMetricCard, {
        props: {
          title: 'Revenue',
          value: 12_000,
          previousValue: 10_000,
          target: 15_000,
          prefix: '¥',
          trend: [8, 10, 9, 12]
        }
      })
    )
    expect(wrapper.text()).toContain('¥1.2万')
    expect(wrapper.text()).toContain('20%')
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.find('.is-positive').exists()).toBe(true)
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe('Revenue 目标完成率')
    expect(wrapper.findComponent(TestChart).exists()).toBe(true)

    await wrapper.setProps({ loading: true })
    expect(wrapper.find('.x-metric-card__skeleton').exists()).toBe(true)
    await wrapper.setProps({ loading: false, error: 'metric failed' })
    expect(wrapper.text()).toContain('metric failed')

    await wrapper.setProps({ error: undefined, value: 8_000, positiveIsGood: false, trend: [] })
    expect(wrapper.find('.is-positive').exists()).toBe(true)
    await wrapper.setProps({ growthRate: 0 })
    expect(wrapper.find('.is-neutral').exists()).toBe(true)
    await wrapper.setProps({ error: new Error('network unavailable') })
    expect(wrapper.text()).toContain('network unavailable')
  })

  it('registers prefixed and compatible component names through the plugin', () => {
    const component = vi.fn()
    const provide = vi.fn()
    Vue3EChartsBusiness.install({ component, provide } as any, {})
    expect(component).toHaveBeenCalledWith('XChart', Chart)
    expect(component).toHaveBeenCalledWith('TrendChart', TrendChart)
    expect(provide).toHaveBeenCalled()

    const prefixedComponent = vi.fn()
    Vue3EChartsBusiness.install({ component: prefixedComponent, provide: vi.fn() } as any, {
      prefix: 'A',
      registerCompatibleNames: false
    })
    expect(prefixedComponent).toHaveBeenCalledWith('AChart', Chart)
    expect(prefixedComponent).not.toHaveBeenCalledWith('Chart', Chart)

    const english = createChartsContext({
      locale: 'en-US',
      messages: { 'en-US': { empty: 'Nothing to chart' } }
    })
    expect(english.t('loading')).toBe('Loading chart')
    expect(english.t('empty')).toBe('Nothing to chart')
    expect(createChartsContext({ messages: { error: 'Custom failure' } }).t('error')).toBe(
      'Custom failure'
    )
  })
})

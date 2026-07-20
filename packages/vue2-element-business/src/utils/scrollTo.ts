export interface ScrollToOptions {
  duration?: number
  container?: Window
}

export function scrollTo(top = 0, duration = 800, container?: Window): void {
  if (typeof window === 'undefined') {
    return
  }

  const scrollContainer = container ?? window
  const startTop = scrollContainer.pageYOffset
  const distance = top - startTop
  const startTime = Date.now()

  const step = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress

    scrollContainer.scrollTo(0, startTop + distance * eased)

    if (progress < 1) {
      window.requestAnimationFrame(step)
    }
  }

  window.requestAnimationFrame(step)
}

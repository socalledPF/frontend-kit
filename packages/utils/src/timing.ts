export interface CancelableFunction {
  cancel: () => void
}

export type DebouncedFunction<T extends (...args: any[]) => any> = ((
  ...args: Parameters<T>
) => void) &
  CancelableFunction & {
    flush: () => ReturnType<T> | undefined
  }

export type ThrottledFunction<T extends (...args: any[]) => any> = ((
  ...args: Parameters<T>
) => void) &
  CancelableFunction

export interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait = 300
): DebouncedFunction<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastThis: unknown
  let result: ReturnType<T> | undefined

  const invoke = () => {
    if (!lastArgs) {
      return result
    }

    result = fn.apply(lastThis, lastArgs)
    lastArgs = undefined
    lastThis = undefined
    return result
  }

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args
    lastThis = this

    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      timer = undefined
      invoke()
    }, wait)
  } as DebouncedFunction<T>

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
    }

    timer = undefined
    lastArgs = undefined
    lastThis = undefined
  }

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }

    return invoke()
  }

  return debounced
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait = 300,
  options: ThrottleOptions = {}
): ThrottledFunction<T> {
  const { leading = true, trailing = true } = options
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastThis: unknown
  let lastInvokeTime = 0
  let hasInvoked = false

  const invoke = () => {
    lastInvokeTime = Date.now()
    hasInvoked = true

    if (lastArgs) {
      fn.apply(lastThis, lastArgs)
      lastArgs = undefined
      lastThis = undefined
    }
  }

  const schedule = (delay: number) => {
    if (!trailing || timer) {
      return
    }

    timer = setTimeout(() => {
      timer = undefined
      invoke()
    }, delay)
  }

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args
    lastThis = this

    if (!hasInvoked) {
      if (leading) {
        invoke()
      } else {
        schedule(wait)
      }
      return
    }

    const remaining = wait - (Date.now() - lastInvokeTime)

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      invoke()
      return
    }

    schedule(remaining)
  } as ThrottledFunction<T>

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer)
    }

    timer = undefined
    lastArgs = undefined
    lastThis = undefined
    lastInvokeTime = 0
    hasInvoked = false
  }

  return throttled
}

export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  let result: ReturnType<T>

  return function (this: unknown, ...args: Parameters<T>) {
    if (!called) {
      called = true
      result = fn.apply(this, args)
    }

    return result
  } as T
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function uuid(): string {
  if (globalThis.crypto && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export async function copyText(text: string): Promise<void> {
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(text)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('copyText can only be used in a browser environment.')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

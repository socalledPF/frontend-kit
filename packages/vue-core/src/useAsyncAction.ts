import { ref, type Ref } from 'vue-demi'
import type { MaybePromise } from '@amusite/shared'

export type AsyncActionStatus = 'idle' | 'running' | 'success' | 'error' | 'cancelled'

export interface UseAsyncActionOptions<Result, Args extends unknown[] = unknown[]> {
  action: (...args: Args) => MaybePromise<Result>
  before?: (...args: Args) => MaybePromise<boolean | void>
  lock?: boolean
  throwOnError?: boolean
  onSuccess?: (result: Result, args: Args) => void
  onError?: (error: unknown, args: Args) => void
  onFinally?: (args: Args) => void
}

export interface UseAsyncActionReturn<Result, Args extends unknown[] = unknown[]> {
  loading: Ref<boolean>
  status: Ref<AsyncActionStatus>
  result: Ref<Result | undefined>
  error: Ref<unknown>
  execute: (...args: Args) => Promise<Result | undefined>
  run: (...args: Args) => Promise<Result | undefined>
  reset: () => void
}

export function useAsyncAction<Result, Args extends unknown[] = unknown[]>(
  options: UseAsyncActionOptions<Result, Args>
): UseAsyncActionReturn<Result, Args> {
  const loading = ref(false)
  const status = ref<AsyncActionStatus>('idle')
  const result = ref<Result | undefined>() as Ref<Result | undefined>
  const error = ref<unknown>()
  let currentTask: Promise<Result | undefined> | undefined
  let runningCount = 0

  const execute = (...args: Args): Promise<Result | undefined> => {
    if ((options.lock ?? true) && currentTask) {
      return currentTask
    }

    const task = (async () => {
      error.value = undefined
      let started = false

      try {
        const accepted = await options.before?.(...args)

        if (accepted === false) {
          status.value = 'cancelled'
          return undefined
        }

        started = true
        runningCount += 1
        loading.value = true
        status.value = 'running'
        const nextResult = await options.action(...args)
        result.value = nextResult
        status.value = 'success'
        options.onSuccess?.(nextResult, args)
        return nextResult
      } catch (caughtError) {
        error.value = caughtError
        status.value = 'error'
        options.onError?.(caughtError, args)

        if (options.throwOnError ?? true) {
          throw caughtError
        }

        return undefined
      } finally {
        if (started) {
          runningCount = Math.max(0, runningCount - 1)
          loading.value = runningCount > 0

          if (runningCount > 0) {
            status.value = 'running'
          }

          options.onFinally?.(args)
        }
      }
    })()

    currentTask = task
    const clearCurrentTask = () => {
      if (currentTask === task) {
        currentTask = undefined
      }
    }
    void task.then(clearCurrentTask, clearCurrentTask)
    return task
  }

  const reset = () => {
    if (loading.value) {
      return
    }

    status.value = 'idle'
    result.value = undefined
    error.value = undefined
  }

  return {
    loading,
    status,
    result,
    error,
    execute,
    run: execute,
    reset
  }
}

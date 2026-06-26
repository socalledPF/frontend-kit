import { ref, type Ref } from 'vue-demi'

export type ModalMode = 'create' | 'edit' | 'view'

export interface UseModalReturn<T, Mode extends string = ModalMode> {
  visible: Ref<boolean>
  payload: Ref<T | undefined>
  mode: Ref<Mode>
  confirmLoading: Ref<boolean>
  open: (nextPayload?: T, nextMode?: Mode) => void
  close: (clearPayload?: boolean) => void
  toggle: (nextVisible?: boolean) => void
  setPayload: (nextPayload?: T) => void
  setMode: (nextMode: Mode) => void
  setConfirmLoading: (nextLoading: boolean) => void
}

export function useModal<T = unknown, Mode extends string = ModalMode>(
  defaultMode = 'create' as Mode
): UseModalReturn<T, Mode> {
  const visible = ref(false)
  const payload = ref<T | undefined>() as Ref<T | undefined>
  const mode = ref(defaultMode) as Ref<Mode>
  const confirmLoading = ref(false)

  const open = (nextPayload?: T, nextMode?: Mode) => {
    payload.value = nextPayload

    if (nextMode) {
      mode.value = nextMode
    }

    visible.value = true
  }

  const close = (clearPayload = false) => {
    visible.value = false
    confirmLoading.value = false

    if (clearPayload) {
      payload.value = undefined
    }
  }

  const toggle = (nextVisible = !visible.value) => {
    visible.value = nextVisible
  }

  return {
    visible,
    payload,
    mode,
    confirmLoading,
    open,
    close,
    toggle,
    setPayload: (nextPayload?: T) => {
      payload.value = nextPayload
    },
    setMode: (nextMode: Mode) => {
      mode.value = nextMode
    },
    setConfirmLoading: (nextLoading: boolean) => {
      confirmLoading.value = nextLoading
    }
  }
}

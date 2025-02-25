import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

function genId() {
  return Math.random().toString(36).substr(2, 9)
}

export function useToast() {
  const [state, setState] = React.useState<State>({ toasts: [] })

  const toastTimeouts = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const addToRemoveQueue = React.useCallback((toastId: string) => {
    if (toastTimeouts.current.has(toastId)) {
      return
    }

    const timeout = setTimeout(() => {
      toastTimeouts.current.delete(toastId)
      setState((state) => ({
        ...state,
        toasts: state.toasts.filter((t) => t.id !== toastId),
      }))
    }, TOAST_REMOVE_DELAY)

    toastTimeouts.current.set(toastId, timeout)
  }, [])

  const toast = React.useCallback(
    function toast(props: Omit<ToasterToast, "id">) {
      const id = genId()

      setState((state) => {
        const newToasts = [
          {
            ...props,
            id,
            open: true,
            onOpenChange: (open) => {
              if (!open) {
                addToRemoveQueue(id)
              }
            },
          },
          ...state.toasts,
        ].slice(0, TOAST_LIMIT)

        return {
          ...state,
          toasts: newToasts,
        }
      })

      return {
        id,
        dismiss: () => addToRemoveQueue(id),
        update: (props: ToasterToast) =>
          setState((state) => ({
            ...state,
            toasts: state.toasts.map((t) =>
              t.id === id ? { ...t, ...props } : t
            ),
          })),
      }
    },
    [addToRemoveQueue]
  )

  const dismiss = React.useCallback(
    (toastId?: string) => {
      setState((state) => ({
        ...state,
        toasts: state.toasts.map((t) =>
          toastId === undefined || t.id === toastId
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }))
    },
    []
  )

  React.useEffect(() => {
    return () => {
      toastTimeouts.current.forEach((timeout) => {
        clearTimeout(timeout)
      })
    }
  }, [])

  return {
    toasts: state.toasts,
    toast,
    dismiss,
  }
}
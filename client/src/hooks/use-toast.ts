"use client"

import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 5000 // Changed from 1000000 to 5000ms (5 seconds)

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([])

  const toast = React.useCallback(
    function (props: Omit<ToasterToast, "id">) {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast = { ...props, id, open: true }

      setToasts((currentToasts) => {
        const nextToasts = [newToast, ...currentToasts].slice(0, TOAST_LIMIT)
        return nextToasts
      })

      return {
        id,
        dismiss: () => {
          setToasts((currentToasts) =>
            currentToasts.map((t) =>
              t.id === id ? { ...t, open: false } : t
            )
          )
          setTimeout(() => {
            setToasts((currentToasts) =>
              currentToasts.filter((t) => t.id !== id)
            )
          }, TOAST_REMOVE_DELAY)
        },
        update: (props: ToasterToast) => {
          setToasts((currentToasts) =>
            currentToasts.map((t) =>
              t.id === id ? { ...t, ...props } : t
            )
          )
        },
      }
    },
    []
  )

  const dismiss = React.useCallback((toastId?: string) => {
    setToasts((currentToasts) =>
      currentToasts.map((t) =>
        toastId === undefined || t.id === toastId
          ? { ...t, open: false }
          : t
      )
    )

    setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((t) =>
          toastId === undefined ? false : t.id !== toastId
        )
      )
    }, TOAST_REMOVE_DELAY)
  }, [])

  return {
    toasts,
    toast,
    dismiss,
  }
}
"use client"

import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([])

  function toast(props: Omit<ToasterToast, "id">) {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...props, id, open: true }

    setToasts((currentToasts) => [newToast, ...currentToasts].slice(0, 3))

    setTimeout(() => {
      setToasts((currentToasts) => 
        currentToasts.filter((t) => t.id !== id)
      )
    }, 5000)

    return {
      id,
      dismiss: () => setToasts((currentToasts) => 
        currentToasts.filter((t) => t.id !== id)
      ),
      update: (props: Partial<ToasterToast>) => 
        setToasts((currentToasts) =>
          currentToasts.map((t) =>
            t.id === id ? { ...t, ...props } : t
          )
        ),
    }
  }

  return {
    toast,
    toasts,
  }
}
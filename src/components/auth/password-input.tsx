"use client"

import * as React from "react"
import { Eye, EyeOff, Lock } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { withIcon?: boolean }>(
  function PasswordInput({ className, withIcon = true, ...props }, ref) {
    const t = useT()
    const [show, setShow] = React.useState(false)
    return (
      <div className="relative">
        {withIcon && <Lock className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />}
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("h-10 pr-10", withIcon && "pl-9", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t("common.hidePassword") : t("common.showPassword")}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    )
  }
)

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-xs">{message}</p>
}

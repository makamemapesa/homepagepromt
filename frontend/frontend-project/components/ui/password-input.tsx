"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">

/**
 * A password field with a reveal toggle.
 *
 * `type="button"` is not optional here: inside a `<form>` a bare button submits
 * it, so revealing the password would post the login form instead.
 *
 * The toggle stays in the tab order — someone typing a password by keyboard is
 * exactly who needs to check it — and resets to hidden whenever the field
 * unmounts, which is what closing a dialog does.
 */
function PasswordInput({ className, disabled, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      <Input
        {...props}
        disabled={disabled}
        type={visible ? "text" : "password"}
        // Room for the button. Callers can still add their own padding — twMerge
        // keeps the last one, so pass pr-* only if you mean to override this.
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className={cn(
          "absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-md",
          "text-muted-foreground transition-colors hover:text-foreground",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  )
}

export { PasswordInput }

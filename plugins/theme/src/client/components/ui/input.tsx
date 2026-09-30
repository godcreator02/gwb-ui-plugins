import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "theme:h-9 theme:w-full theme:min-w-0 theme:rounded-md theme:border theme:border-input theme:bg-transparent theme:px-3 theme:py-1 theme:text-base theme:shadow-xs theme:transition-[color,box-shadow] theme:outline-none theme:selection:bg-primary theme:selection:text-primary-foreground theme:file:inline-flex theme:file:h-7 theme:file:border-0 theme:file:bg-transparent theme:file:text-sm theme:file:font-medium theme:file:text-foreground theme:placeholder:text-muted-foreground theme:disabled:pointer-events-none theme:disabled:cursor-not-allowed theme:disabled:opacity-50 theme:md:text-sm theme:dark:bg-input/30",
        "theme:focus-visible:border-ring theme:focus-visible:ring-[3px] theme:focus-visible:ring-ring/50",
        "theme:aria-invalid:border-destructive theme:aria-invalid:ring-destructive/20 theme:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }

import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "theme:flex theme:field-sizing-content theme:min-h-16 theme:w-full theme:rounded-md theme:border theme:border-input theme:bg-transparent theme:px-3 theme:py-2 theme:text-base theme:shadow-xs theme:transition-[color,box-shadow] theme:outline-none theme:placeholder:text-muted-foreground theme:focus-visible:border-ring theme:focus-visible:ring-[3px] theme:focus-visible:ring-ring/50 theme:disabled:cursor-not-allowed theme:disabled:opacity-50 theme:aria-invalid:border-destructive theme:aria-invalid:ring-destructive/20 theme:md:text-sm theme:dark:bg-input/30 theme:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

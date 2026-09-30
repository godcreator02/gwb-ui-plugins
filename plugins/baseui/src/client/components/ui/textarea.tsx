import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "baseui:flex baseui:field-sizing-content baseui:min-h-16 baseui:w-full baseui:rounded-md baseui:border baseui:border-input baseui:bg-transparent baseui:px-3 baseui:py-2 baseui:text-base baseui:shadow-xs baseui:transition-[color,box-shadow] baseui:outline-none baseui:placeholder:text-muted-foreground baseui:focus-visible:border-ring baseui:focus-visible:ring-[3px] baseui:focus-visible:ring-ring/50 baseui:disabled:cursor-not-allowed baseui:disabled:opacity-50 baseui:aria-invalid:border-destructive baseui:aria-invalid:ring-destructive/20 baseui:md:text-sm baseui:dark:bg-input/30 baseui:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

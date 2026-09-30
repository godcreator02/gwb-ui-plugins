import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "shell:h-9 shell:w-full shell:min-w-0 shell:rounded-md shell:border shell:border-input shell:bg-transparent shell:px-3 shell:py-1 shell:text-base shell:shadow-xs shell:transition-[color,box-shadow] shell:outline-none shell:selection:bg-primary shell:selection:text-primary-foreground shell:file:inline-flex shell:file:h-7 shell:file:border-0 shell:file:bg-transparent shell:file:text-sm shell:file:font-medium shell:file:text-foreground shell:placeholder:text-muted-foreground shell:disabled:pointer-events-none shell:disabled:cursor-not-allowed shell:disabled:opacity-50 shell:md:text-sm shell:dark:bg-input/30",
        "shell:focus-visible:border-ring shell:focus-visible:ring-[3px] shell:focus-visible:ring-ring/50",
        "shell:aria-invalid:border-destructive shell:aria-invalid:ring-destructive/20 shell:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }

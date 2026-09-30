import * as React from "react"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "baseui:peer baseui:size-4 baseui:shrink-0 baseui:rounded-[4px] baseui:border baseui:border-input baseui:shadow-xs baseui:transition-shadow baseui:outline-none baseui:focus-visible:border-ring baseui:focus-visible:ring-[3px] baseui:focus-visible:ring-ring/50 baseui:disabled:cursor-not-allowed baseui:disabled:opacity-50 baseui:aria-invalid:border-destructive baseui:aria-invalid:ring-destructive/20 baseui:data-[state=checked]:border-primary baseui:data-[state=checked]:bg-primary baseui:data-[state=checked]:text-primary-foreground baseui:dark:bg-input/30 baseui:dark:aria-invalid:ring-destructive/40 baseui:dark:data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="baseui:grid baseui:place-content-center baseui:text-current baseui:transition-none"
      >
        <CheckIcon className="baseui:size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

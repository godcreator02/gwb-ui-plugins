import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "shell:inline-flex shell:shrink-0 shell:items-center shell:justify-center shell:gap-2 shell:rounded-md shell:text-sm shell:font-medium shell:whitespace-nowrap shell:transition-all shell:outline-none shell:focus-visible:border-ring shell:focus-visible:ring-[3px] shell:focus-visible:ring-ring/50 shell:disabled:pointer-events-none shell:disabled:opacity-50 shell:aria-invalid:border-destructive shell:aria-invalid:ring-destructive/20 shell:dark:aria-invalid:ring-destructive/40 shell:[&_svg]:pointer-events-none shell:[&_svg]:shrink-0 shell:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "shell:bg-primary shell:text-primary-foreground shell:hover:bg-primary/90",
        destructive:
          "shell:bg-destructive shell:text-white shell:hover:bg-destructive/90 shell:focus-visible:ring-destructive/20 shell:dark:bg-destructive/60 shell:dark:focus-visible:ring-destructive/40",
        outline:
          "shell:border shell:bg-background shell:shadow-xs shell:hover:bg-accent shell:hover:text-accent-foreground shell:dark:border-input shell:dark:bg-input/30 shell:dark:hover:bg-input/50",
        secondary:
          "shell:bg-secondary shell:text-secondary-foreground shell:hover:bg-secondary/80",
        ghost:
          "shell:hover:bg-accent shell:hover:text-accent-foreground shell:dark:hover:bg-accent/50",
        link: "shell:text-primary shell:underline-offset-4 shell:hover:underline",
      },
      size: {
        default: "shell:h-9 shell:px-4 shell:py-2 shell:has-[>svg]:px-3",
        xs: "shell:h-6 shell:gap-1 shell:rounded-md shell:px-2 shell:text-xs shell:has-[>svg]:px-1.5 shell:[&_svg:not([class*=size-])]:size-3",
        sm: "shell:h-8 shell:gap-1.5 shell:rounded-md shell:px-3 shell:has-[>svg]:px-2.5",
        lg: "shell:h-10 shell:rounded-md shell:px-6 shell:has-[>svg]:px-4",
        icon: "shell:size-9",
        "icon-xs": "shell:size-6 shell:rounded-md shell:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "shell:size-8",
        "icon-lg": "shell:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

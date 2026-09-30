import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "theme:inline-flex theme:shrink-0 theme:items-center theme:justify-center theme:gap-2 theme:rounded-md theme:text-sm theme:font-medium theme:whitespace-nowrap theme:transition-all theme:outline-none theme:focus-visible:border-ring theme:focus-visible:ring-[3px] theme:focus-visible:ring-ring/50 theme:disabled:pointer-events-none theme:disabled:opacity-50 theme:aria-invalid:border-destructive theme:aria-invalid:ring-destructive/20 theme:dark:aria-invalid:ring-destructive/40 theme:[&_svg]:pointer-events-none theme:[&_svg]:shrink-0 theme:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "theme:bg-primary theme:text-primary-foreground theme:hover:bg-primary/90",
        destructive:
          "theme:bg-destructive theme:text-white theme:hover:bg-destructive/90 theme:focus-visible:ring-destructive/20 theme:dark:bg-destructive/60 theme:dark:focus-visible:ring-destructive/40",
        outline:
          "theme:border theme:bg-background theme:shadow-xs theme:hover:bg-accent theme:hover:text-accent-foreground theme:dark:border-input theme:dark:bg-input/30 theme:dark:hover:bg-input/50",
        secondary:
          "theme:bg-secondary theme:text-secondary-foreground theme:hover:bg-secondary/80",
        ghost:
          "theme:hover:bg-accent theme:hover:text-accent-foreground theme:dark:hover:bg-accent/50",
        link: "theme:text-primary theme:underline-offset-4 theme:hover:underline",
      },
      size: {
        default: "theme:h-9 theme:px-4 theme:py-2 theme:has-[>svg]:px-3",
        xs: "theme:h-6 theme:gap-1 theme:rounded-md theme:px-2 theme:text-xs theme:has-[>svg]:px-1.5 theme:[&_svg:not([class*=size-])]:size-3",
        sm: "theme:h-8 theme:gap-1.5 theme:rounded-md theme:px-3 theme:has-[>svg]:px-2.5",
        lg: "theme:h-10 theme:rounded-md theme:px-6 theme:has-[>svg]:px-4",
        icon: "theme:size-9",
        "icon-xs": "theme:size-6 theme:rounded-md theme:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "theme:size-8",
        "icon-lg": "theme:size-10",
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

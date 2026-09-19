import * as React from "react"
import { cn } from "cn"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { ContextMenu as ContextMenuPrimitive } from "radix-ui"

function ContextMenu({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

function ContextMenuGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
  )
}

function ContextMenuPortal({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return (
    <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />
  )
}

function ContextMenuSub({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
}

function ContextMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...props}
    />
  )
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "shell:flex shell:cursor-default shell:items-center shell:rounded-sm shell:px-2 shell:py-1.5 shell:text-sm shell:outline-hidden shell:select-none shell:focus:bg-accent shell:focus:text-accent-foreground shell:data-[inset]:pl-8 shell:data-[state=open]:bg-accent shell:data-[state=open]:text-accent-foreground shell:[&_svg]:pointer-events-none shell:[&_svg]:shrink-0 shell:[&_svg:not([class*=size-])]:size-4 shell:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="shell:ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  )
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={cn(
        "shell:z-50 shell:min-w-[8rem] shell:origin-(--radix-context-menu-content-transform-origin) shell:overflow-hidden shell:rounded-md shell:border shell:bg-popover shell:p-1 shell:text-popover-foreground shell:shadow-lg shell:data-[side=bottom]:slide-in-from-top-2 shell:data-[side=left]:slide-in-from-right-2 shell:data-[side=right]:slide-in-from-left-2 shell:data-[side=top]:slide-in-from-bottom-2 shell:data-[state=closed]:animate-out shell:data-[state=closed]:fade-out-0 shell:data-[state=closed]:zoom-out-95 shell:data-[state=open]:animate-in shell:data-[state=open]:fade-in-0 shell:data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuContent({
  className,
  container,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content> & {
  // 本仓加的一格（官方原样之外唯一的改动）：标签菜单要挂进本桌面的浮层户口，桌面切走它跟着藏
  container?: HTMLElement | null
}) {
  return (
    <ContextMenuPrimitive.Portal container={container}>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          "shell:z-50 shell:max-h-(--radix-context-menu-content-available-height) shell:min-w-[8rem] shell:origin-(--radix-context-menu-content-transform-origin) shell:overflow-x-hidden shell:overflow-y-auto shell:rounded-md shell:border shell:bg-popover shell:p-1 shell:text-popover-foreground shell:shadow-md shell:data-[side=bottom]:slide-in-from-top-2 shell:data-[side=left]:slide-in-from-right-2 shell:data-[side=right]:slide-in-from-left-2 shell:data-[side=top]:slide-in-from-bottom-2 shell:data-[state=closed]:animate-out shell:data-[state=closed]:fade-out-0 shell:data-[state=closed]:zoom-out-95 shell:data-[state=open]:animate-in shell:data-[state=open]:fade-in-0 shell:data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "shell:relative shell:flex shell:cursor-default shell:items-center shell:gap-2 shell:rounded-sm shell:px-2 shell:py-1.5 shell:text-sm shell:outline-hidden shell:select-none shell:focus:bg-accent shell:focus:text-accent-foreground shell:data-[disabled]:pointer-events-none shell:data-[disabled]:opacity-50 shell:data-[inset]:pl-8 shell:data-[variant=destructive]:text-destructive shell:data-[variant=destructive]:focus:bg-destructive/10 shell:data-[variant=destructive]:focus:text-destructive shell:dark:data-[variant=destructive]:focus:bg-destructive/20 shell:[&_svg]:pointer-events-none shell:[&_svg]:shrink-0 shell:[&_svg:not([class*=size-])]:size-4 shell:[&_svg:not([class*=text-])]:text-muted-foreground shell:data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        "shell:relative shell:flex shell:cursor-default shell:items-center shell:gap-2 shell:rounded-sm shell:py-1.5 shell:pr-2 shell:pl-8 shell:text-sm shell:outline-hidden shell:select-none shell:focus:bg-accent shell:focus:text-accent-foreground shell:data-[disabled]:pointer-events-none shell:data-[disabled]:opacity-50 shell:[&_svg]:pointer-events-none shell:[&_svg]:shrink-0 shell:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="shell:pointer-events-none shell:absolute shell:left-2 shell:flex shell:size-3.5 shell:items-center shell:justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="shell:size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        "shell:relative shell:flex shell:cursor-default shell:items-center shell:gap-2 shell:rounded-sm shell:py-1.5 shell:pr-2 shell:pl-8 shell:text-sm shell:outline-hidden shell:select-none shell:focus:bg-accent shell:focus:text-accent-foreground shell:data-[disabled]:pointer-events-none shell:data-[disabled]:opacity-50 shell:[&_svg]:pointer-events-none shell:[&_svg]:shrink-0 shell:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    >
      <span className="shell:pointer-events-none shell:absolute shell:left-2 shell:flex shell:size-3.5 shell:items-center shell:justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CircleIcon className="shell:size-2 shell:fill-current" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        "shell:px-2 shell:py-1.5 shell:text-sm shell:font-medium shell:text-foreground shell:data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("shell:-mx-1 shell:my-1 shell:h-px shell:bg-border", className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        "shell:ml-auto shell:text-xs shell:tracking-widest shell:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}

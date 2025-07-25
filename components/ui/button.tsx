import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary-200 text-dark-100 shadow-xs hover:bg-primary-200/90 focus-visible:ring-primary-200/50 focus-visible:ring-[3px] disabled:bg-gray-700 disabled:text-gray-400",
        destructive:
          "bg-destructive-100 text-white shadow-xs hover:bg-destructive-200 focus-visible:ring-destructive-100/50 focus-visible:ring-[3px] disabled:bg-gray-700 disabled:text-gray-400",
        outline:
          "border border-gray-600 bg-gray-800 text-white shadow-xs hover:bg-gray-700 hover:text-white focus-visible:ring-primary-200/50 focus-visible:ring-[3px] disabled:bg-gray-800/50 disabled:text-gray-500 disabled:border-gray-700",
        secondary:
          "bg-gray-700 text-white shadow-xs hover:bg-gray-600 focus-visible:ring-primary-200/50 focus-visible:ring-[3px] disabled:bg-gray-800 disabled:text-gray-500",
        ghost:
          "text-white hover:bg-gray-800 hover:text-white focus-visible:ring-primary-200/50 focus-visible:ring-[3px] disabled:text-gray-500",
        link: "text-primary-200 underline-offset-4 hover:underline focus-visible:ring-primary-200/50 focus-visible:ring-[3px] disabled:text-gray-500",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
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
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const isDisabled = props.disabled;
  
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles for dark theme
        "bg-gray-800 text-white placeholder-gray-400 border-gray-600",
        "flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none",
        "md:text-sm",
        // File input specific styles
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white",
        // Selection styles
        "selection:bg-primary-200 selection:text-dark-100",
        // Focus states with brand color (primary-200 from globals.css)
        "focus-visible:border-primary-200 focus-visible:ring-primary-200/50 focus-visible:ring-[3px]",
        // Disabled states with proper contrast
        isDisabled && "disabled:bg-gray-800/50 disabled:text-gray-500 disabled:placeholder-gray-500 disabled:cursor-not-allowed disabled:opacity-75",
        // Validation error states
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }

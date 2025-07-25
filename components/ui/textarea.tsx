import * as React from "react"
import { cn } from "@/lib/utils"



const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    const isDisabled = props.disabled;
    
    return (
      <textarea
        className={cn(
          // Base styles for dark theme
          "bg-gray-800 text-white placeholder-gray-400 border-gray-600",
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm transition-[color,box-shadow] outline-none",
          // Selection styles
          "selection:bg-primary-200 selection:text-dark-100",
          // Focus states with brand color
          "focus-visible:border-primary-200 focus-visible:ring-primary-200/50 focus-visible:ring-[3px]",
          // Disabled states with proper contrast
          isDisabled && "disabled:bg-gray-800/50 disabled:text-gray-500 disabled:placeholder-gray-500 disabled:cursor-not-allowed disabled:opacity-75",
          // Validation error states
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

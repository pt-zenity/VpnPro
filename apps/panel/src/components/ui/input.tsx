import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Glass input field
          "flex h-11 w-full rounded-xl px-3 py-2 text-sm",
          "bg-white/[0.04] backdrop-blur-md",
          "border border-white/[0.08]",
          "text-foreground placeholder:text-muted-foreground/60",
          "ring-offset-background",
          "transition-all duration-200",
          // Focus — cyan glow ring
          "focus-visible:outline-none",
          "focus-visible:border-[hsl(192_100%_58%/0.50)]",
          "focus-visible:ring-2 focus-visible:ring-[hsl(192_100%_58%/0.25)]",
          "focus-visible:bg-white/[0.06]",
          "focus-visible:shadow-[0_0_16px_hsl(192_100%_58%/0.12)]",
          "disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — glass-aware transitions + focus ring
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl",
    "text-sm font-medium",
    "ring-offset-background transition-all duration-200",
    "active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Solid cyan with glow
        default: [
          "bg-[hsl(192_100%_58%)] text-[hsl(230_45%_5%)]",
          "shadow-[0_0_20px_hsl(192_100%_58%/0.30)]",
          "hover:bg-[hsl(192_100%_65%)]",
          "hover:shadow-[0_0_32px_hsl(192_100%_58%/0.45)]",
        ].join(" "),

        // Destructive
        destructive: [
          "bg-destructive/80 text-destructive-foreground",
          "backdrop-blur-sm border border-destructive/30",
          "hover:bg-destructive/90",
        ].join(" "),

        // Frosted-glass outline
        outline: [
          "border border-white/[0.10]",
          "bg-white/[0.04] backdrop-blur-md",
          "text-foreground",
          "hover:bg-white/[0.08] hover:border-white/[0.16]",
          "hover:shadow-[0_0_16px_hsl(192_100%_58%/0.10)]",
        ].join(" "),

        // Slightly opaque secondary glass
        secondary: [
          "bg-white/[0.06] backdrop-blur-md",
          "border border-white/[0.07]",
          "text-secondary-foreground",
          "hover:bg-white/[0.10] hover:border-white/[0.12]",
        ].join(" "),

        // Ghost — near-invisible until hover
        ghost: [
          "hover:bg-white/[0.06]",
          "hover:text-foreground",
          "text-muted-foreground",
        ].join(" "),

        // Link
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-9 rounded-lg px-3 text-xs",
        lg:      "h-12 rounded-xl px-8 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

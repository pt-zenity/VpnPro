import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center rounded-lg border px-2.5 py-0.5",
    "text-xs font-semibold",
    "backdrop-blur-sm",
    "transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border-[hsl(192_100%_58%/0.30)]",
          "bg-[hsl(192_100%_58%/0.12)]",
          "text-[hsl(192_100%_68%)]",
          "hover:bg-[hsl(192_100%_58%/0.20)]",
        ].join(" "),

        secondary: [
          "border-white/[0.08]",
          "bg-white/[0.06]",
          "text-secondary-foreground",
          "hover:bg-white/[0.10]",
        ].join(" "),

        destructive: [
          "border-destructive/30",
          "bg-destructive/15",
          "text-red-400",
          "hover:bg-destructive/25",
        ].join(" "),

        outline: [
          "border-white/[0.10]",
          "bg-transparent",
          "text-foreground",
        ].join(" "),

        success: [
          "border-emerald-500/30",
          "bg-emerald-500/12",
          "text-emerald-400",
          "hover:bg-emerald-500/20",
        ].join(" "),

        warning: [
          "border-amber-500/30",
          "bg-amber-500/12",
          "text-amber-400",
          "hover:bg-amber-500/20",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

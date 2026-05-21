import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap leading-none",
  {
    variants: {
      variant: {
        default:          "bg-primary text-primary-foreground",
        secondary:        "bg-secondary text-secondary-foreground",
        destructive:      "bg-destructive text-destructive-foreground",
        success:          "bg-success text-success-foreground",
        warning:          "bg-warning text-warning-foreground",
        launch:           "bg-gradient-brand text-white",
        muted:            "bg-muted text-muted-foreground",
        outline:          "border-2 border-primary/20 text-primary bg-transparent",
        /* Variantes "soft" — fundo com opacidade, ideal para áreas densas (tabelas admin, listas) */
        "soft-destructive": "bg-destructive/15 text-destructive border border-destructive/25",
        "soft-warning":     "bg-warning/15 text-warning border border-warning/25",
        "soft-success":     "bg-success/15 text-success border border-success/25",
        "soft-primary":     "bg-primary/10 text-primary border border-primary/20",
      },
      size: {
        default: "px-2.5 py-1 text-2xs",
        sm:      "px-1.5 py-0.5 text-2xs",
        lg:      "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { badgeVariants };

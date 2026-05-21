import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  /* Base: 16px no mobile evita zoom automático do iOS Safari.
     Desktop (md+) volta para text-sm para densidade adequada.
     ring-offset garante que o focus ring não corte em fundo colorido. */
  "flex w-full rounded-lg border bg-background px-4 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150",
  {
    variants: {
      status: {
        default: "border-input focus-visible:ring-ring",
        error:   "border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive",
        success: "border-success focus-visible:ring-success/30 focus-visible:border-success",
      },
      size: {
        /* Mobile h-12, desktop h-11 — padrão para todos os inputs da loja */
        default: "h-12 md:h-11 text-base md:text-sm",
        sm:      "h-10 md:h-9 text-base md:text-sm px-3",
        lg:      "h-14 md:h-13 text-base",
      },
    },
    defaultVariants: { status: "default", size: "default" },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, status, size, ...props }, ref) => (
    <input
      type={type}
      className={cn(inputVariants({ status, size }), className)}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { inputVariants };

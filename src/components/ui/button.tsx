import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary-glow shadow-elegant hover:shadow-pop",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft",
        outline:     "border-2 border-primary/20 text-primary hover:border-primary hover:bg-primary/5",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm hover:shadow-md",
        ghost:       "hover:bg-muted active:scale-100",
        link:        "text-primary underline-offset-4 hover:underline active:scale-100",
        /* CTA laranja — estado triplo de sombra para micro-interação de conversão.
           Texto escuro (secondary-foreground) para contraste AA sobre laranja. */
        cta: [
          "bg-secondary text-secondary-foreground font-bold",
          "hover:brightness-110",
          "disabled:saturate-50",
          "focus-visible:ring-secondary",
          "[box-shadow:var(--shadow-cta)]",
          "hover:[box-shadow:var(--shadow-cta-hover)]",
          "active:[box-shadow:var(--shadow-cta-active)]",
        ].join(" "),
        /* WhatsApp — identidade de marca; nunca trocar por verde genérico */
        whatsapp: [
          "bg-whatsapp text-whatsapp-foreground",
          "hover:bg-whatsapp-hover",
          "focus-visible:ring-whatsapp",
        ].join(" "),
      },
      size: {
        default: "h-11 px-6",
        sm:      "h-9 px-4 text-xs",
        lg:      "h-12 px-8 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };

import { cn } from "@/lib/utils";

/**
 * Skeleton minimalista — usa apenas tokens semânticos do design system.
 * Animação `pulse` do Tailwind (já incluída) → zero CSS extra.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/60 animate-pulse",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.6s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.04] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}
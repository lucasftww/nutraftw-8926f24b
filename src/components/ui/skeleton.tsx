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
        "animate-pulse rounded-md bg-muted/60",
        className,
      )}
      {...props}
    />
  );
}
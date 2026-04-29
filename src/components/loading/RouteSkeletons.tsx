import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeletons por rota — substituem o "Carregando…" durante o download do
 * chunk lazy + a hidratação inicial. Eles imitam a forma final da página
 * para reduzir CLS percebido e fazer a navegação parecer instantânea.
 */

export function MyAccountSkeleton() {
  return (
    <div className="container py-8 md:py-12 max-w-5xl animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`bg-card rounded-2xl border border-border p-4 ${i === 2 ? "hidden md:block" : ""}`}
          >
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto pb-px">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-none" />
        ))}
      </div>

      {/* Form */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <div className="pt-4 mt-4 border-t border-border flex justify-end">
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    </div>
  );
}

export function CheckoutSkeleton() {
  return (
    <div className="container py-8 md:py-12 max-w-6xl animate-in fade-in duration-200">
      <Skeleton className="h-9 w-40 mb-6" />
      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-6 space-y-4">
              <Skeleton className="h-5 w-48" />
              <div className="grid sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <aside className="bg-card rounded-2xl border border-border p-6 space-y-3 h-fit">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
          <Skeleton className="h-12 w-full mt-4" />
        </aside>
      </div>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="container py-8 animate-in fade-in duration-200">
      <Skeleton className="h-9 w-56 mb-6" />
      <div className="flex gap-2 mb-6 overflow-x-auto pb-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border p-4">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function WishlistSkeleton() {
  return (
    <div className="container py-8 animate-in fade-in duration-200">
      <Skeleton className="h-9 w-40 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <div className="container py-12 animate-in fade-in duration-200">
      <Skeleton className="h-9 w-64 mb-6" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-4 w-9/12" />
      </div>
    </div>
  );
}
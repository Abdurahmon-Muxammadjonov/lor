import { Skeleton } from '@/components/ui/skeleton';

/** Hisobotlar sahifasi skeletoni: sarlavha, filtr paneli, KPI kartalari, tablar va grafik/jadval */
export default function ReportsLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="glass flex flex-wrap items-center gap-2 p-3">
        <Skeleton className="h-8 w-72 max-w-full rounded-lg" />
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="ml-auto h-8 w-40 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-3 h-4 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-2xl rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass p-5 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-64" />
          <Skeleton className="mt-6 h-[260px] w-full rounded-lg" />
        </div>
        <div className="glass p-5">
          <Skeleton className="h-5 w-36" />
          <div className="mt-6 flex justify-center">
            <Skeleton className="size-44 rounded-full" />
          </div>
          <div className="mt-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

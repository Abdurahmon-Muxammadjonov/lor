import { Skeleton } from '@/components/ui/skeleton';

/** Bosh sahifa skeletoni: sarlavha + davr, 4 ta statistika kartasi, grafiklar va panellar */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-56 max-w-full rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass p-5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-36" />
            <Skeleton className="mt-3 h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass p-5 lg:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
          <Skeleton className="mt-6 h-[260px] w-full rounded-lg" />
        </div>
        <div className="glass p-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-3 w-40" />
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
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass p-5">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass p-5 lg:col-span-2">
          <Skeleton className="h-5 w-52" />
          <div className="mt-5 divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-16" />
                <Skeleton className="hidden h-4 w-24 sm:block" />
                <Skeleton className="hidden h-2 w-28 rounded-full md:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

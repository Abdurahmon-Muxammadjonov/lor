import { Skeleton } from '@/components/ui/skeleton';

/** /dashboard/services yuklanish holati: sarlavha + yon panel + jadval skeletoni */
export default function ServicesLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="card-surface flex gap-2 p-3 lg:flex-col">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-lg lg:h-10 lg:w-full" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="card-surface flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-72 max-w-full" />
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="card-surface overflow-hidden">
            <div className="divide-y divide-line">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-4 w-48 max-w-[40%]" />
                  <Skeleton className="ml-auto h-12 w-52 max-w-[35%]" />
                  <Skeleton className="hidden h-5 w-10 rounded-full md:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

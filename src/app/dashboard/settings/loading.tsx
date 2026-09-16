import { Skeleton } from '@/components/ui/skeleton';

/** Sozlamalar sahifasi skeletoni: sarlavha, tablar roʻyxati va forma kartasi */
export default function SettingsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-3xl rounded-lg" />
      <div className="glass space-y-5 p-6">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

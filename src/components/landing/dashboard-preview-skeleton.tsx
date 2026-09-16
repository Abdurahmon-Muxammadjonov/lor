import { Skeleton } from '@/components/ui/skeleton';

/** Dashboard namunasi yuklanguncha koʻrsatiladigan skelet (server-safe, oʻlchami haqiqiy panel bilan bir xil) */
export function DashboardPreviewSkeleton({ label }: { label: string }) {
  return (
    <div className="glass-strong w-full p-4 sm:p-5" role="status" aria-label={label}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Skeleton className="h-[74px]" />
        <Skeleton className="h-[74px]" />
        <Skeleton className="h-[74px]" />
      </div>
      <Skeleton className="mt-4 h-[120px]" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <Skeleton className="mt-4 h-12" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

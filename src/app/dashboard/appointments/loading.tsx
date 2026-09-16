import { Skeleton } from '@/components/ui/skeleton';
import { CalendarSkeleton } from '@/components/appointments/calendar-skeleton';

/** /dashboard/appointments yuklanish holati */
export default function AppointmentsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <CalendarSkeleton withToolbar columns={3} rows={7} />
    </div>
  );
}

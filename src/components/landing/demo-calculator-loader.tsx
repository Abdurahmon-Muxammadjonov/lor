'use client';

import dynamic from 'next/dynamic';
import { useT } from '@/i18n/client';
import { Skeleton } from '@/components/ui/skeleton';

/** Demo kalkulyator skeleti — haqiqiy blok bilan bir xil balandlikda (layout sakramaydi) */
export function DemoCalculatorSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]" role="status" aria-label={label}>
      <div className="glass space-y-5 p-6">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
      <div className="glass space-y-4 p-6">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="glass lg:col-span-2">
        <Skeleton className="h-64 w-full" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

const DemoCalculator = dynamic(() => import('./demo-calculator').then((m) => m.DemoCalculator), {
  ssr: false,
  loading: () => <DemoCalculatorSkeletonWithT />,
});

function DemoCalculatorSkeletonWithT() {
  const t = useT();
  return <DemoCalculatorSkeleton label={t('landing.demo.loading')} />;
}

export function DemoCalculatorLoader() {
  return <DemoCalculator />;
}

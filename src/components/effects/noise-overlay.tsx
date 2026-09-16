'use client';

import { cn } from '@/lib/utils';

export interface NoiseOverlayProps {
  className?: string;
}

/** Butun sahifa ustidagi nozik shovqin (film grain) qatlami — 3% opacity, bosishga xalaqit bermaydi */
export function NoiseOverlay({ className }: NoiseOverlayProps) {
  return <div aria-hidden="true" className={cn('noise pointer-events-none fixed inset-0 z-[1]', className)} />;
}

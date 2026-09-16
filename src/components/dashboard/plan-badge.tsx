'use client';

import * as React from 'react';
import type { Plan } from '@prisma/client';
import { Crown, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Badge } from '@/components/ui/badge';

const PLAN_STYLE: Record<Plan, { variant: 'outline' | 'accent' | 'success'; icon: React.ElementType }> = {
  START: { variant: 'outline', icon: Zap },
  PRO: { variant: 'accent', icon: Sparkles },
  CLINIC: { variant: 'success', icon: Crown },
};

export function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  const t = useT();
  const s = PLAN_STYLE[plan];
  const Icon = s.icon;
  return (
    <Badge variant={s.variant} className={cn('h-5 gap-1 px-2 text-[10px] uppercase tracking-wider', className)} title={t('dashboard.sidebar.planLabel')}>
      <Icon aria-hidden="true" />
      {t(`dashboard.sidebar.plan.${plan}`)}
    </Badge>
  );
}

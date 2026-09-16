'use client';

import { CircleCheck, CircleOff } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Badge } from '@/components/ui/badge';

export interface ConfigBadgeProps {
  configured: boolean;
  /** Matnni almashtirish (masalan "Yoqilgan" / "Oʻchirilgan") */
  labels?: { on: string; off: string };
  className?: string;
}

/** Sozlanganlik holati (env orqali) — yashil/kulrang belgi */
export function ConfigBadge({ configured, labels, className }: ConfigBadgeProps) {
  const t = useT();
  const on = labels?.on ?? t('settings.status.configured');
  const off = labels?.off ?? t('settings.status.notConfigured');
  return (
    <Badge variant={configured ? 'success' : 'secondary'} className={className}>
      {configured ? <CircleCheck className="size-3.5" aria-hidden="true" /> : <CircleOff className="size-3.5" aria-hidden="true" />}
      {configured ? on : off}
    </Badge>
  );
}

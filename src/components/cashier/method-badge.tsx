'use client';

import * as React from 'react';
import type { PayMethod } from '@prisma/client';
import { ArrowLeftRight, Banknote, CreditCard, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Badge } from '@/components/ui/badge';
import { methodBadgeVariant } from '@/lib/cashier/format';

export const METHOD_ICONS: Record<PayMethod, LucideIcon> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  CLICK: Smartphone,
  PAYME: Wallet,
};

export interface MethodBadgeProps {
  method: PayMethod;
  className?: string;
  /** Faqat ikonka (mobil) */
  iconOnly?: boolean;
}

/** Toʻlov usuli belgisi: ikonka + common.payMethod.* */
export function MethodBadge({ method, className, iconOnly = false }: MethodBadgeProps) {
  const t = useT();
  const Icon = METHOD_ICONS[method];
  const label = t(`common.payMethod.${method}`);
  return (
    <Badge
      variant={methodBadgeVariant(method)}
      className={cn('gap-1', className)}
      aria-label={iconOnly ? label : undefined}
      title={label}
    >
      <Icon aria-hidden="true" />
      {iconOnly ? null : label}
    </Badge>
  );
}

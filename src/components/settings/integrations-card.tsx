'use client';

import { Bot, CreditCard, MessageSquareText, ShieldCheck, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Skeleton } from '@/components/ui/skeleton';
import type { IntegrationStatusDTO } from '@/lib/settings/schemas';
import { ConfigBadge } from './config-badge';
import { FormCard } from './form-field';
import { useIntegrationStatus } from './use-settings';

const ITEMS: { key: keyof IntegrationStatusDTO; icon: LucideIcon }[] = [
  { key: 'eskiz', icon: MessageSquareText },
  { key: 'telegram', icon: Bot },
  { key: 'click', icon: CreditCard },
  { key: 'payme', icon: Wallet },
  { key: 'cron', icon: ShieldCheck },
];

/** Integratsiyalar env orqali sozlanganligi (sirlarsiz) */
export function IntegrationsCard() {
  const t = useT();
  const query = useIntegrationStatus();
  return (
    <FormCard title={t('settings.integrations.title')} description={t('settings.integrations.description')}>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg-elevated/60 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
              <span className="truncate">{t(`settings.integrations.${key}`)}</span>
            </span>
            {query.isPending ? <Skeleton className="h-5 w-20 rounded-full" /> : <ConfigBadge configured={query.data?.[key] ?? false} />}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-muted">{t('settings.integrations.docs')}</p>
    </FormCard>
  );
}

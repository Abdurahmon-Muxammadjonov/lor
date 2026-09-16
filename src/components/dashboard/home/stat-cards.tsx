'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ListOrdered, Receipt, Users, Wallet } from 'lucide-react';
import type { Role } from '@prisma/client';
import { can } from '@/lib/permissions';
import { formatMoney } from '@/lib/money';
import { useT } from '@/i18n/client';
import { formatCount } from '@/lib/dashboard/format';
import type { TodayStatsDTO } from '@/lib/dashboard/types';
import { StatCard } from '@/components/shared/stat-card';
import { Money } from '@/components/shared/money';

export interface StatCardsProps {
  today: TodayStatsDTO | undefined;
  /** Jonli navbat soni (15 s polling); boʻlmasa statistikadagi qiymat */
  waitingLive: number | undefined;
  loading: boolean;
  role: Role;
}

/** Katta pul qiymati: raqam yirik, valyuta kichik (karta kengligiga sigʻadi, qisqarmaydi) */
function MoneyValue({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Money value={value} suffix={null} />
      <span className="text-sm font-semibold text-text-muted">{unit}</span>
    </span>
  );
}

/** 4 ta asosiy koʻrsatkich: bugungi tushum, bemorlar, navbat (jonli), oʻrtacha chek */
export function StatCards({ today, waitingLive, loading, role }: StatCardsProps) {
  const t = useT();
  const router = useRouter();
  const currency = t('common.currency');
  const waiting = waitingLive ?? today?.waiting ?? 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title={t('dashboard.stats.todayRevenue')}
        value={<MoneyValue value={today?.revenue ?? 0} unit={currency} />}
        delta={today?.deltaPct}
        deltaLabel={t('dashboard.stats.vsYesterday')}
        hint={today ? t('dashboard.stats.yesterday', { value: formatMoney(today.revenueYesterday, { suffix: currency }) }) : undefined}
        icon={Wallet}
        accent="mint"
        loading={loading}
        onClick={can(role, 'payments.view') ? () => router.push('/dashboard/cashier') : undefined}
      />
      <StatCard
        title={t('dashboard.stats.todayVisits')}
        value={formatCount(today?.visits ?? 0)}
        delta={today?.visitsDeltaPct}
        deltaLabel={t('dashboard.stats.vsYesterday')}
        hint={today ? t('dashboard.stats.yesterday', { value: formatCount(today.visitsYesterday) }) : undefined}
        icon={Users}
        accent="cyan"
        loading={loading}
        onClick={can(role, 'patients.view') ? () => router.push('/dashboard/patients') : undefined}
      />
      <StatCard
        title={t('dashboard.stats.waiting')}
        value={
          <span className="inline-flex items-center gap-2">
            <span aria-live="polite" aria-atomic="true">
              {formatCount(waiting)}
            </span>
            {waiting > 0 ? (
              <span aria-hidden="true" className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-[#7C5CFF] opacity-70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-[#B7A8FF] shadow-[0_0_8px_rgba(124,92,255,0.8)]" />
              </span>
            ) : null}
          </span>
        }
        hint={`${t('dashboard.stats.live')} · ${t('dashboard.stats.openQueue')}`}
        icon={ListOrdered}
        accent="violet"
        loading={loading && waitingLive === undefined}
        onClick={can(role, 'queue.view') ? () => router.push('/dashboard/queue') : undefined}
      />
      <StatCard
        title={t('dashboard.stats.avgCheck')}
        value={<MoneyValue value={today?.avgCheck ?? 0} unit={currency} />}
        hint={t('dashboard.stats.perVisit')}
        icon={Receipt}
        accent="cyan"
        loading={loading}
      />
    </div>
  );
}

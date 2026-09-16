'use client';

import { CheckCheck, Hourglass, Timer, Users } from 'lucide-react';
import { useT } from '@/i18n/client';
import { StatCard } from '@/components/shared/stat-card';
import type { QueueStatsDTO } from '@/lib/queue/types';

export interface QueueStatsProps {
  stats: QueueStatsDTO | null;
  loading?: boolean;
}

/** Sarlavha statistikasi: kutmoqda / chaqirilgan+qabulda / bugun xizmat / oʻrtacha kutish */
export function QueueStats({ stats, loading = false }: QueueStatsProps) {
  const t = useT();
  const min = (v: number | null) => (v === null ? t('queue.stats.noData') : t('queue.stats.minutes', { n: v }));
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard title={t('queue.stats.waiting')} value={stats ? stats.waiting : '—'} icon={Users} accent="cyan" loading={loading} />
      <StatCard title={t('queue.stats.inProgress')} value={stats ? stats.called + stats.serving : '—'} icon={Hourglass} accent="violet" loading={loading} />
      <StatCard title={t('queue.stats.servedToday')} value={stats ? stats.done : '—'} icon={CheckCheck} accent="mint" loading={loading} />
      <StatCard
        title={t('queue.stats.avgWait')}
        value={stats ? min(stats.avgWaitMin) : '—'}
        icon={Timer}
        hint={stats && stats.avgServiceMin !== null ? `${t('queue.stats.avgService')}: ${min(stats.avgServiceMin)}` : undefined}
        loading={loading}
      />
    </div>
  );
}

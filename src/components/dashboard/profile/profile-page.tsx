'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { UserRound } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { useLocale } from '@/i18n/client';
import { fmtDate, fmtSmartDate } from '@/lib/date';
import { formatPhone } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { PhoneLink } from '@/components/shared/phone-link';
import { UserAvatar } from '../user-avatar';
import { useMe } from '../queries';
import { ProfileForm } from './profile-form';

/** Profil sahifasi: hisob kartasi (DB dan) + shaxsiy maʼlumotlar / parol formasi */
export function ProfilePage({ user }: { user: SessionUser }) {
  const { t, locale } = useLocale();
  const { data, isLoading, isError, error, refetch } = useMe();

  React.useEffect(() => {
    if (isError) toast.error(t('dashboard.errors.me'), { id: 'me-error', description: error.message });
  }, [isError, error, t]);

  const me = data?.user;
  const clinicName = data?.clinic.name ?? user.clinicName;

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-500">
      <PageHeader title={t('dashboard.profile.title')} description={t('dashboard.profile.subtitle')} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-label={t('dashboard.profile.account')} className="glass h-fit p-5">
          {isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="size-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40 max-w-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ) : !me ? (
            <EmptyState
              compact
              icon={UserRound}
              title={t('dashboard.errors.me')}
              action={
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  {t('common.retry')}
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center gap-4">
                <UserAvatar name={me.fullName} color={me.color} size="lg" online />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-heading text-lg font-bold text-text" title={me.fullName}>
                    {me.fullName}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="accent">{t(`common.role.${me.role}`)}</Badge>
                    {me.room ? <Badge variant="outline">{`${t('dashboard.profile.room')} ${me.room}`}</Badge> : null}
                  </div>
                </div>
              </div>
              <dl className="mt-6 divide-y divide-line text-sm">
                <Row label={t('dashboard.profile.login')} value={<span className="font-mono">{me.login}</span>} />
                <Row label={t('dashboard.profile.clinic')} value={clinicName} />
                <Row label={t('dashboard.profile.email')} value={me.email ?? '—'} />
                <Row label={t('dashboard.profile.phone')} value={me.phone ? <PhoneLink phone={me.phone} className="text-accent hover:underline" /> : '—'} />
                {me.specialty ? <Row label={t('dashboard.profile.specialty')} value={me.specialty} /> : null}
                <Row label={t('dashboard.profile.lastLogin')} value={me.lastLoginAt ? fmtSmartDate(me.lastLoginAt, locale) : '—'} />
                <Row label={t('dashboard.profile.memberSince')} value={fmtDate(me.createdAt, locale)} />
              </dl>
            </>
          )}
        </section>

        <div className="min-w-0 lg:col-span-2">
          {isLoading ? (
            <div className="space-y-4">
              <div className="glass p-5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-2 h-3 w-64 max-w-full" />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="glass p-5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-2 h-3 w-72 max-w-full" />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
          ) : me ? (
            <ProfileForm me={me} />
          ) : (
            <ProfileForm
              me={{
                id: user.id,
                login: user.login,
                email: null,
                fullName: user.fullName,
                role: user.role,
                phone: null,
                specialty: null,
                room: user.room ?? null,
                color: user.color ?? '#00D4FF',
                clinicId: user.clinicId,
                lastLoginAt: null,
                createdAt: new Date(0).toISOString(),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-text">{typeof value === 'string' ? formatMaybePhone(value) : value}</dd>
    </div>
  );
}

function formatMaybePhone(v: string): string {
  return /^\+?\d{12}$/.test(v) ? formatPhone(v) : v;
}

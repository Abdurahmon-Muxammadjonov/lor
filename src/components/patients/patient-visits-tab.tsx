'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ClipboardList, ExternalLink, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/i18n/client';
import { fmtDateTime } from '@/lib/date';
import { formatQuantity } from '@/lib/calc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { Pagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/status-badge';
import type { PatientVisitDTO } from '@/lib/patients/types';
import { lineName } from '@/lib/patients/format';
import { CardListSkeleton } from './skeletons';
import { patientErrorMessage, usePatientVisits } from './use-patients';

export interface PatientVisitsTabProps {
  patientId: string;
  enabled: boolean;
  canVisit: boolean;
  onStartVisit: () => void;
}

const PAGE_SIZE = 10;
const LINES_PREVIEW = 3;

function VisitLines({ visit }: { visit: PatientVisitDTO }) {
  const t = useT();
  const { locale } = useLocale();
  const [expanded, setExpanded] = React.useState(false);
  const lines = visit.lines;
  if (lines.length === 0) return <p className="text-sm text-text-muted">{t('patients.visits.noLines')}</p>;
  const shown = expanded ? lines : lines.slice(0, LINES_PREVIEW);
  const hidden = lines.length - shown.length;
  return (
    <div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-bg-elevated">
        {shown.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 basis-40 font-medium text-text">{lineName(l, locale)}</span>
            <span className="tabular text-text-muted">
              {formatQuantity(l.quantity)} {l.unit}
            </span>
            {l.organ ? (
              <Badge variant="outline" className="text-[11px]">
                {t(`common.organ.${l.organ}`)}
                {l.side ? ` · ${t(`common.side.${l.side}`)}` : ''}
              </Badge>
            ) : l.side ? (
              <Badge variant="outline" className="text-[11px]">
                {t(`common.side.${l.side}`)}
              </Badge>
            ) : null}
            {l.withMedicine ? (
              <Badge variant="secondary" className="text-[11px]">
                {t('common.withMedicine')}
              </Badge>
            ) : null}
            <Money value={l.lineTotal} className="ml-auto font-semibold" />
          </li>
        ))}
      </ul>
      {lines.length > LINES_PREVIEW ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1 h-8 px-1 text-xs"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          {expanded ? t('patients.visits.less') : t('patients.visits.more', { n: hidden })}
        </Button>
      ) : null}
    </div>
  );
}

function Totals({ visit }: { visit: PatientVisitDTO }) {
  const t = useT();
  const debt = visit.balance > 0;
  const rows: { label: string; value: number; className?: string }[] = [
    { label: t('patients.visits.gross'), value: visit.totalGross },
    { label: t('patients.visits.discount'), value: visit.discount },
    { label: t('patients.visits.net'), value: visit.totalNet, className: 'font-semibold text-text' },
    { label: t('patients.visits.paid'), value: visit.paidAmount, className: 'text-[#00FFB2]' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-5">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col">
          <dt className="text-[11px] uppercase tracking-wider text-text-muted">{r.label}</dt>
          <dd>
            <Money value={r.value} className={cn('text-text-muted', r.className)} />
          </dd>
        </div>
      ))}
      <div className="flex flex-col">
        <dt className="text-[11px] uppercase tracking-wider text-text-muted">
          {t('patients.visits.balance')}
        </dt>
        <dd>
          {visit.balance === 0 ? (
            <span className="text-[#00FFB2]">{t('patients.noDebt')}</span>
          ) : (
            <Money
              value={Math.abs(visit.balance)}
              className={cn('font-semibold', debt ? 'text-danger' : 'text-[#B7A8FF]')}
            />
          )}
        </dd>
      </div>
    </dl>
  );
}

/** Tashriflar tarixi — vaqt chizigʻi (sana, shifokor, tashxis, muolajalar snapshot, jamlar, holat) */
export function PatientVisitsTab({ patientId, enabled, canVisit, onStartVisit }: PatientVisitsTabProps) {
  const t = useT();
  const { locale } = useLocale();
  const [page, setPage] = React.useState(1);
  const q = usePatientVisits(patientId, page, PAGE_SIZE, enabled);

  if (q.isLoading || (!q.data && q.isFetching)) return <CardListSkeleton rows={3} />;
  if (q.isError) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={ClipboardList}
          title={t('patients.errors.loadFailed')}
          description={patientErrorMessage(q.error, t)}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={ClipboardList}
          title={t('patients.visits.empty')}
          description={t('patients.visits.emptyDescription')}
          action={
            canVisit ? (
              <Button type="button" size="sm" onClick={onStartVisit}>
                <Stethoscope aria-hidden="true" />
                {t('patients.actions.newVisit')}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-4', q.isFetching && 'opacity-80 transition-opacity')}
      aria-busy={q.isFetching || undefined}
    >
      <ol className="relative ml-2 space-y-4 border-l border-line pl-6 sm:ml-3">
        {items.map((v) => (
          <li key={v.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[31px] top-5 size-3 rounded-full border-2 border-bg-base ring-2 ring-line"
              style={{ backgroundColor: v.doctor.color }}
            />
            <article
              className="glass rounded-xl p-4 sm:p-5"
              aria-label={`${fmtDateTime(v.createdAt, locale)} — ${v.doctor.fullName}`}
            >
              <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <time
                  dateTime={v.createdAt}
                  className="tabular font-heading text-base font-semibold text-text"
                >
                  {fmtDateTime(v.createdAt, locale)}
                </time>
                <StatusBadge kind="visit" status={v.status} />
                <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: v.doctor.color }}
                  />
                  {v.doctor.fullName}
                  {v.doctor.room ? (
                    <span className="text-xs">
                      · {v.doctor.room} {t('patients.visits.room')}
                    </span>
                  ) : null}
                </span>
                <Button asChild variant="ghost" size="sm" className="ml-auto text-accent hover:text-accent">
                  <Link href={`/dashboard/visits/${v.id}`}>
                    {t('patients.visits.open')}
                    <ExternalLink aria-hidden="true" />
                  </Link>
                </Button>
              </header>

              <div className="mt-3 space-y-3">
                <div className="text-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t('patients.visits.diagnosis')}
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {v.icd10 ? (
                      <Badge variant="accent" className="font-mono text-[11px]">
                        {v.icd10}
                      </Badge>
                    ) : null}
                    <span className={cn(!v.diagnosis && 'text-text-muted')}>
                      {v.diagnosis || t('patients.visits.noDiagnosis')}
                    </span>
                  </div>
                  {v.complaint ? (
                    <p className="mt-1 text-xs text-text-muted">
                      {t('patients.visits.complaint')}: {v.complaint}
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    <span>{t('patients.visits.lines')}</span>
                    <span className="normal-case tracking-normal">
                      {v.payments.count > 0
                        ? t('patients.visits.payments', { n: v.payments.count })
                        : t('patients.visits.noPayments')}
                    </span>
                  </div>
                  <VisitLines visit={v} />
                </div>

                <Totals visit={v} />
              </div>
            </article>
          </li>
        ))}
      </ol>
      {total > PAGE_SIZE ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} simple />
      ) : null}
    </div>
  );
}

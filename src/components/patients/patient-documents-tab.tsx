'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ExternalLink, FileText, Printer } from 'lucide-react';
import { useLocale, useT } from '@/i18n/client';
import { fmtDateTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import type { PatientVisitDTO } from '@/lib/patients/types';
import { printUrlInFrame } from '@/lib/patients/print-frame';
import { CardListSkeleton } from './skeletons';
import { patientErrorMessage, usePatientVisits } from './use-patients';

export interface PatientDocumentsTabProps {
  patientId: string;
  enabled: boolean;
}

const DOCS_PAGE_SIZE = 50;

function paymentStatus(v: PatientVisitDTO): 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERPAID' {
  if (v.balance < 0) return 'OVERPAID';
  if (v.balance === 0 && v.totalNet > 0) return 'PAID';
  if (v.paidAmount > 0) return 'PARTIAL';
  return 'UNPAID';
}

/** Hujjatlar: har bir qabul uchun chek (/print/receipt/[visitId]) — ochish va chop etish */
export function PatientDocumentsTab({ patientId, enabled }: PatientDocumentsTabProps) {
  const t = useT();
  const { locale } = useLocale();
  const q = usePatientVisits(patientId, 1, DOCS_PAGE_SIZE, enabled);
  const [printing, setPrinting] = React.useState<string | null>(null);

  const print = async (visitId: string) => {
    const url = `/print/receipt/${visitId}`;
    setPrinting(visitId);
    try {
      await printUrlInFrame(url);
      toast.success(t('patients.toast.printing'));
    } catch {
      window.open(url, '_blank', 'noopener');
      toast.error(t('patients.documents.printFailed'));
    } finally {
      setPrinting(null);
    }
  };

  if (q.isLoading) return <CardListSkeleton rows={3} />;
  if (q.isError || !q.data) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={FileText}
          title={t('patients.errors.loadFailed')}
          description={q.error ? patientErrorMessage(q.error, t) : undefined}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const docs = q.data.items.filter((v) => v.status !== 'CANCELLED' && v.lines.length > 0);
  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={FileText}
          title={t('patients.documents.empty')}
          description={t('patients.documents.emptyDescription')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">{t('patients.documents.description')}</p>
      <ul className="space-y-2">
        {docs.map((v) => {
          const status = paymentStatus(v);
          return (
            <li key={v.id} className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-accent">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <div className="font-medium text-text">
                  {t('patients.documents.receipt')} ·{' '}
                  {t('patients.documents.receiptFor', {
                    date: fmtDateTime(v.createdAt, locale),
                    doctor: v.doctor.fullName,
                  })}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                  <span className="tabular font-mono">
                    {v.payments.receiptNos.length > 0
                      ? `${t('patients.documents.receiptNo')} ${v.payments.receiptNos.join(', ')}`
                      : t('patients.documents.noReceiptNo')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t('patients.documents.linesCount', { n: v.lines.length })}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Money value={v.totalNet} className="tabular font-semibold" />
                <StatusBadge kind="payment" status={status} />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void print(v.id)}
                  loading={printing === v.id}
                  aria-label={`${t('patients.documents.print')}: ${fmtDateTime(v.createdAt, locale)}`}
                >
                  <Printer aria-hidden="true" />
                  {t('patients.documents.print')}
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link
                    href={`/print/receipt/${v.id}`}
                    target="_blank"
                    rel="noopener"
                    aria-label={`${t('patients.documents.openInNew')}: ${fmtDateTime(v.createdAt, locale)}`}
                  >
                    <ExternalLink aria-hidden="true" />
                    {t('patients.documents.open')}
                  </Link>
                </Button>
              </div>
              {v.status === 'OPEN' ? (
                <Badge variant="accent" className="w-full justify-center sm:w-auto">
                  {t('common.visitStatus.OPEN')}
                </Badge>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

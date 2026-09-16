'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Link2,
  MoreHorizontal,
  PhoneCall,
  Play,
  Printer,
  RotateCcw,
  SkipForward,
  Stethoscope,
  Undo2,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { can } from '@/lib/permissions';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/shared/status-badge';
import { tzTime } from '@/lib/queue/ticket';
import { waitedMinutes } from '@/lib/queue/board';
import type { QueueAction, QueueRowDTO, QueueViewer } from '@/lib/queue/types';
import { QUEUE_TYPE_META } from './queue-type-meta';

export interface TicketCardProps {
  row: QueueRowDTO;
  /** Taxta vaqti (kutish daqiqalari uchun) */
  now: string;
  viewer: QueueViewer;
  /** Oʻtgan kun — faqat koʻrish */
  readOnly?: boolean;
  busy?: boolean;
  onAction: (row: QueueRowDTO, action: QueueAction, opts?: { requeue?: boolean }) => void;
  onStartVisit: (row: QueueRowDTO) => void;
  onReprint: (row: QueueRowDTO) => void;
  onLinkPatient: (row: QueueRowDTO) => void;
  /** Yaqinda oʻzgargan — qisqa yorugʻlik */
  highlight?: boolean;
  compact?: boolean;
}

const VISIT_TYPES = new Set(['DOCTOR', 'RECHECK']);

export const TicketCard = React.memo(function TicketCard({
  row,
  now,
  viewer,
  readOnly = false,
  busy = false,
  onAction,
  onStartVisit,
  onReprint,
  onLinkPatient,
  highlight = false,
  compact = false,
}: TicketCardProps) {
  const t = useT();
  const reduced = useReducedMotion();
  const meta = QUEUE_TYPE_META[row.type];
  const isDoctor = viewer.role === 'DOCTOR';
  const otherDoctor = isDoctor && !!row.doctorId && row.doctorId !== viewer.id;
  const canCall = !readOnly && can(viewer.role, 'queue.call') && !otherDoctor;
  const canManage = !readOnly && can(viewer.role, 'queue.manage');
  const canVisit = !readOnly && can(viewer.role, 'visits.create') && !otherDoctor && VISIT_TYPES.has(row.type);
  const hasVisit = !!row.visit;
  const waited = row.status === 'WAITING' ? waitedMinutes(row, now) : null;
  const room = row.room ?? row.doctor?.room ?? null;

  const timeLabel =
    row.status === 'WAITING'
      ? `${t('queue.ticket.createdAt')} ${tzTime(row.createdAt)}`
      : row.status === 'CALLED'
        ? `${t('queue.ticket.calledAt')} ${tzTime(row.calledAt ?? row.updatedAt)}`
        : row.status === 'SERVING'
          ? `${t('queue.ticket.servedAt')} ${tzTime(row.servedAt ?? row.updatedAt)}`
          : row.status === 'DONE'
            ? `${t('queue.ticket.doneAt')} ${tzTime(row.doneAt ?? row.updatedAt)}`
            : `${t('queue.ticket.createdAt')} ${tzTime(row.createdAt)}`;

  // ── Asosiy amal ──
  let primary: React.ReactNode = null;
  if (row.status === 'WAITING' && canCall) {
    primary = (
      <Button size="sm" onClick={() => onAction(row, 'call')} loading={busy} aria-label={`${t('queue.actions.call')} ${row.number}`}>
        <PhoneCall aria-hidden="true" />
        {t('queue.actions.call')}
      </Button>
    );
  } else if (row.status === 'CALLED' || (row.status === 'SERVING' && !hasVisit)) {
    if (hasVisit && row.visit) {
      primary = (
        <Button asChild size="sm" variant="secondary">
          <Link href={`/dashboard/visits/${row.visit.id}`}>
            <ExternalLink aria-hidden="true" />
            {t('queue.actions.openVisit')}
          </Link>
        </Button>
      );
    } else if (canVisit && row.status === 'CALLED') {
      primary = row.patient ? (
        <Button size="sm" variant="gradient" onClick={() => onStartVisit(row)} loading={busy} aria-label={`${t('queue.actions.startVisit')} ${row.number}`}>
          <Stethoscope aria-hidden="true" />
          {t('queue.actions.startVisit')}
        </Button>
      ) : canManage ? (
        <Button size="sm" variant="secondary" onClick={() => onLinkPatient(row)} disabled={busy} aria-label={`${t('queue.actions.linkPatient')} ${row.number}`}>
          <Link2 aria-hidden="true" />
          {t('queue.actions.linkPatient')}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => onAction(row, 'serve')} loading={busy}>
          <Play aria-hidden="true" />
          {t('queue.actions.serveNoVisit')}
        </Button>
      );
    } else if (canCall && row.status === 'CALLED') {
      primary = (
        <Button size="sm" variant="secondary" onClick={() => onAction(row, 'serve')} loading={busy} aria-label={`${t('queue.actions.serveNoVisit')} ${row.number}`}>
          <Play aria-hidden="true" />
          {t('queue.actions.serveNoVisit')}
        </Button>
      );
    } else if (canCall) {
      primary = (
        <Button size="sm" variant="secondary" onClick={() => onAction(row, 'done')} loading={busy} aria-label={`${t('queue.actions.done')} ${row.number}`}>
          <CheckCircle2 aria-hidden="true" />
          {t('queue.actions.done')}
        </Button>
      );
    }
  } else if (row.status === 'SERVING' && hasVisit && row.visit) {
    primary = (
      <Button asChild size="sm" variant="secondary">
        <Link href={`/dashboard/visits/${row.visit.id}`}>
          <ExternalLink aria-hidden="true" />
          {t('queue.actions.openVisit')}
        </Link>
      </Button>
    );
  } else if (row.status === 'SKIPPED' && canCall) {
    primary = (
      <Button size="sm" variant="secondary" onClick={() => onAction(row, 'recall')} loading={busy} aria-label={`${t('queue.actions.recall')} ${row.number}`}>
        <Bell aria-hidden="true" />
        {t('queue.actions.recall')}
      </Button>
    );
  }

  // ── Qoʻshimcha amallar ──
  const menu: React.ReactNode[] = [];
  if (canCall && row.status === 'CALLED') {
    menu.push(
      <DropdownMenuItem key="recall" onSelect={() => onAction(row, 'recall')}>
        <Bell className="size-4" aria-hidden="true" /> {t('queue.actions.recall')}
      </DropdownMenuItem>,
    );
  }
  if (canCall && (row.status === 'CALLED' || row.status === 'SKIPPED')) {
    menu.push(
      <DropdownMenuItem key="requeue" onSelect={() => onAction(row, 'recall', { requeue: true })}>
        <Undo2 className="size-4" aria-hidden="true" /> {t('queue.actions.requeue')}
      </DropdownMenuItem>,
    );
  }
  if (canCall && (row.status === 'CALLED' || row.status === 'SERVING' || row.status === 'WAITING')) {
    menu.push(
      <DropdownMenuItem key="done" onSelect={() => onAction(row, 'done')}>
        <CheckCircle2 className="size-4" aria-hidden="true" /> {t('queue.actions.done')}
      </DropdownMenuItem>,
    );
  }
  if (canCall && (row.status === 'WAITING' || row.status === 'CALLED' || row.status === 'SERVING')) {
    menu.push(
      <DropdownMenuItem key="skip" onSelect={() => onAction(row, 'skip')}>
        <SkipForward className="size-4" aria-hidden="true" /> {t('queue.actions.skip')}
      </DropdownMenuItem>,
    );
  }
  if (canManage && !hasVisit) {
    menu.push(
      <DropdownMenuItem key="link" onSelect={() => onLinkPatient(row)}>
        <Link2 className="size-4" aria-hidden="true" /> {row.patient ? t('queue.actions.changePatient') : t('queue.actions.linkPatient')}
      </DropdownMenuItem>,
    );
  }
  if (row.patient) {
    menu.push(
      <DropdownMenuItem key="patient" asChild>
        <Link href={`/dashboard/patients/${row.patient.id}`}>
          <UserRound className="size-4" aria-hidden="true" /> {t('queue.actions.openPatient')}
        </Link>
      </DropdownMenuItem>,
    );
  }
  menu.push(<DropdownMenuSeparator key="sep" />);
  menu.push(
    <DropdownMenuItem key="print" onSelect={() => onReprint(row)}>
      <Printer className="size-4" aria-hidden="true" /> {t('queue.actions.reprint')}
    </DropdownMenuItem>,
  );

  return (
    <motion.article
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        'glass relative overflow-hidden rounded-xl border border-line p-3 transition-shadow',
        highlight && meta.glow,
        otherDoctor && 'opacity-70',
        row.status === 'CALLED' && 'ring-1 ring-primary/30',
      )}
      aria-label={`${row.number} · ${t(`common.queueStatus.${row.status}`)}`}
      data-status={row.status}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: meta.hex }} aria-hidden="true" />
      <div className="flex items-start gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('tabular font-heading text-2xl font-bold leading-none tracking-tight text-text', compact && 'text-xl')}>{row.number}</span>
            <StatusBadge kind="queue" status={row.status} className="h-5 px-1.5 text-[10px]" />
            {row.printedAt ? null : (
              <span className="text-[10px] uppercase tracking-wide text-text-muted" title={t('queue.ticket.notPrinted')}>
                {t('queue.ticket.notPrinted')}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm">
            {row.patient ? (
              <Link href={`/dashboard/patients/${row.patient.id}`} className="truncate font-medium text-text hover:text-accent hover:underline">
                {row.patient.fullName}
              </Link>
            ) : (
              <span className="truncate italic text-text-muted">{t('queue.ticket.noPatient')}</span>
            )}
            {row.patient ? <span className="tabular shrink-0 text-xs text-text-muted">{row.patient.cardNumber}</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
            <span className="tabular">{timeLabel}</span>
            {waited !== null && waited > 0 ? <span className="tabular">{t('queue.ticket.waitingFor', { min: waited })}</span> : null}
            {row.doctor ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: row.doctor.color }} aria-hidden="true" />
                <span className="truncate">{row.doctor.fullName}</span>
              </span>
            ) : null}
            {room ? <span className="tabular font-medium text-text">{t('queue.ticket.room', { room })}</span> : null}
            {hasVisit ? <span className="text-[#00FFB2]">{t('queue.board.linkedVisit')}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {primary}
          {!readOnly && menu.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`${t('queue.actions.more')} ${row.number}`} disabled={busy}>
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {menu}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" className="size-8" aria-label={`${t('queue.actions.reprint')} ${row.number}`} onClick={() => onReprint(row)}>
              <Printer aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      {row.status === 'SKIPPED' && !primary && !readOnly ? (
        <div className="mt-2 pl-1 text-xs text-text-muted">
          <RotateCcw className="mr-1 inline size-3" aria-hidden="true" />
          {t('common.queueStatus.SKIPPED')}
        </div>
      ) : null}
    </motion.article>
  );
});

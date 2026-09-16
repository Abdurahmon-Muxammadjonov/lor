'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { QueueType } from '@prisma/client';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox,
  ListOrdered,
  MonitorPlay,
  PhoneCall,
  Plus,
  Stethoscope,
  TabletSmartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { can } from '@/lib/permissions';
import type { QueueSettings } from '@/lib/settings/types';
import { useHotkey } from '@/hooks/use-hotkey';
import { useIsMobile } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { useQueueRealtime } from '@/lib/realtime/use-queue-realtime';
import type { QueueEvent } from '@/lib/realtime/types';
import { currentTicketFor } from '@/lib/queue/board';
import { useCallNext, useQueueBoard, useQueueCache, useTicketAction, useVisitFromTicket } from '@/lib/queue/queries';
import { QUEUE_TYPES, type QueueAction, type QueueBoardDTO, type QueueRowDTO, type QueueViewer } from '@/lib/queue/types';
import { ANY_DOCTOR, DoctorSelect } from './doctor-select';
import { LinkPatientDialog } from './link-patient-dialog';
import { NewTicketDialog } from './new-ticket-dialog';
import { QUEUE_TYPE_META, QueueTypeIcon } from './queue-type-meta';
import { QueueStats } from './queue-stats';
import { RealtimeBadge } from './realtime-badge';
import { ReprintDialog } from './reprint-dialog';
import { TicketCard } from './ticket-card';

export interface QueueBoardProps {
  viewer: QueueViewer;
  clinic: { name: string; phone: string; ticketFooter: string; kioskKey: string | null };
  settings: QueueSettings;
  initialBoard: QueueBoardDTO;
  todayKey: string;
  /** ?new=1 — "Yangi talon" dialogini darhol ochish */
  openNew?: boolean;
}

type ColumnKey = 'waiting' | 'called' | 'serving' | 'done';
type TypeFilter = 'ALL' | QueueType;

const COLUMNS: ColumnKey[] = ['waiting', 'called', 'serving', 'done'];
const HIGHLIGHT_MS = 4000;

function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** /dashboard/queue — jonli taxta: ustunlar, tur filtri, chaqirish, yangi talon, dialoglar, N tugmasi */
export function QueueBoard({ viewer, clinic, settings, initialBoard, todayKey, openNew = false }: QueueBoardProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [dateKey, setDateKey] = React.useState(initialBoard.dateKey);
  const isToday = dateKey === todayKey;
  const readOnly = dateKey < todayKey;
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('ALL');
  const [mobileColumn, setMobileColumn] = React.useState<ColumnKey>('waiting');
  const [newOpen, setNewOpen] = React.useState(openNew);
  const [reprintRow, setReprintRow] = React.useState<QueueRowDTO | null>(null);
  const [linkRow, setLinkRow] = React.useState<QueueRowDTO | null>(null);
  const [linkThenStart, setLinkThenStart] = React.useState(false);
  const [doctorPickRow, setDoctorPickRow] = React.useState<QueueRowDTO | null>(null);
  const [pickedDoctor, setPickedDoctor] = React.useState(ANY_DOCTOR);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState<Record<string, number>>({});

  const canCall = can(viewer.role, 'queue.call') && !readOnly;
  const canManage = can(viewer.role, 'queue.manage') && !readOnly;
  const canVisit = can(viewer.role, 'visits.create') && !readOnly;

  const cache = useQueueCache();
  const board = useQueueBoard(dateKey, { initialData: dateKey === initialBoard.dateKey ? initialBoard : undefined, live: isToday });
  const ticketAction = useTicketAction();
  const callNext = useCallNext();
  const visitFromTicket = useVisitFromTicket();

  // ── Jonli yangilanish (faqat bugun) ──
  const invalidateTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEvent = React.useCallback(
    (ev: QueueEvent) => {
      setHighlight((h) => ({ ...h, [ev.queueId]: Date.now() + HIGHLIGHT_MS }));
      if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
      invalidateTimer.current = setTimeout(() => void cache.invalidate(todayKey), 150);
    },
    [cache, todayKey],
  );
  const onSnapshot = React.useCallback((snap: QueueBoardDTO) => cache.setBoard(snap), [cache]);
  const realtime = useQueueRealtime<QueueBoardDTO>({ url: isToday ? '/api/queue/stream' : null, enabled: isToday, onEvent, onSnapshot });

  React.useEffect(() => {
    const ids = Object.keys(highlight);
    if (!ids.length) return;
    const id = setTimeout(() => {
      const now = Date.now();
      setHighlight((h) => Object.fromEntries(Object.entries(h).filter(([, until]) => until > now)));
    }, HIGHLIGHT_MS);
    return () => clearTimeout(id);
  }, [highlight]);

  React.useEffect(() => {
    if (board.isError) toast.error(t('queue.toast.loadError'));
  }, [board.isError, t]);

  const data = board.data;

  // ── Tur filtri ──
  const typeOptions = React.useMemo(() => {
    const present = new Set<QueueType>();
    for (const x of settings.enabledTypes) present.add(x);
    if (data) for (const x of QUEUE_TYPES) if (data.stats.byType[x].total > 0) present.add(x);
    const types = QUEUE_TYPES.filter((x) => present.has(x));
    return [
      { value: 'ALL' as TypeFilter, label: `${t('queue.board.allTypes')}${data ? ` · ${data.stats.waiting}` : ''}` },
      ...types.map((x) => ({
        value: x as TypeFilter,
        icon: <QueueTypeIcon type={x} className="size-3.5" />,
        label: `${t(`common.queueType.${x}`)}${data ? ` · ${data.stats.byType[x].waiting}` : ''}`,
      })),
    ];
  }, [settings.enabledTypes, data, t]);

  const filterRows = React.useCallback((rows: QueueRowDTO[]) => (typeFilter === 'ALL' ? rows : rows.filter((r) => r.type === typeFilter)), [typeFilter]);

  const columns = React.useMemo(() => {
    if (!data) return null;
    return {
      waiting: filterRows(data.waiting),
      called: filterRows(data.called),
      serving: filterRows(data.serving),
      done: [...filterRows(data.done), ...filterRows(data.skipped)],
    } satisfies Record<ColumnKey, QueueRowDTO[]>;
  }, [data, filterRows]);

  const current = React.useMemo(() => (data && viewer.role === 'DOCTOR' ? currentTicketFor(data, viewer.id) : null), [data, viewer]);

  // ── Amallar ──
  const errorText = (err: unknown) => (err instanceof ApiClientError ? err.message : t('queue.errors.generic'));

  const runAction = React.useCallback(
    async (row: QueueRowDTO, action: QueueAction, opts?: { requeue?: boolean }) => {
      setBusyId(row.id);
      try {
        const updated = await ticketAction.mutateAsync({ id: row.id, action, requeue: opts?.requeue });
        cache.patchRow(dateKey, updated);
        const key =
          action === 'call' ? 'called' : action === 'done' ? 'done' : action === 'skip' ? 'skipped' : action === 'serve' ? 'serving' : opts?.requeue ? 'requeued' : 'recalled';
        toast.success(t(`queue.toast.${key}`, { number: updated.number }));
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setBusyId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticketAction, cache, dateKey, t],
  );

  const startVisitWith = React.useCallback(
    async (row: QueueRowDTO, doctorId?: string | null) => {
      setBusyId(row.id);
      try {
        const res = await visitFromTicket.mutateAsync({ id: row.id, doctorId });
        cache.patchRow(dateKey, res.ticket);
        if (!res.existing) toast.success(t('queue.toast.visitCreated'));
        router.push(`/dashboard/visits/${res.visitId}`);
      } catch (err) {
        toast.error(errorText(err));
      } finally {
        setBusyId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visitFromTicket, cache, dateKey, router, t],
  );

  const onStartVisit = React.useCallback(
    (row: QueueRowDTO) => {
      if (row.visit) {
        router.push(`/dashboard/visits/${row.visit.id}`);
        return;
      }
      if (!row.patient) {
        if (canManage) {
          setLinkThenStart(true);
          setLinkRow(row);
        } else {
          toast.warning(t('queue.errors.patientRequired'));
        }
        return;
      }
      if (viewer.role !== 'DOCTOR' && !row.doctorId) {
        setPickedDoctor(ANY_DOCTOR);
        setDoctorPickRow(row);
        return;
      }
      void startVisitWith(row, row.doctorId);
    },
    [router, canManage, viewer.role, startVisitWith, t],
  );

  const nextType = React.useCallback((): QueueType => {
    if (viewer.role === 'CASHIER') return 'CASHIER';
    if (typeFilter !== 'ALL') return typeFilter;
    return 'DOCTOR';
  }, [viewer.role, typeFilter]);

  const onNext = React.useCallback(async () => {
    if (!canCall || callNext.isPending) return;
    try {
      const first = nextType();
      let res = await callNext.mutateAsync(first);
      // Shifokor: A navbati boʻsh boʻlsa — qayta koʻrik (B)
      if (!res.ticket && viewer.role === 'DOCTOR' && first === 'DOCTOR' && typeFilter === 'ALL') res = await callNext.mutateAsync('RECHECK');
      const ticket = res.ticket;
      if (ticket) {
        cache.patchRow(dateKey, ticket);
        setHighlight((h) => ({ ...h, [ticket.id]: Date.now() + HIGHLIGHT_MS }));
        toast.success(t('queue.toast.called', { number: ticket.number }), { duration: 6000 });
      } else {
        toast.info(t('queue.toast.nextEmpty'));
      }
    } catch (err) {
      toast.error(errorText(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCall, callNext, nextType, viewer.role, typeFilter, cache, dateKey, t]);

  useHotkey('n', () => void onNext(), { enabled: canCall && !newOpen && !reprintRow && !linkRow && !doctorPickRow });
  useHotkey('t', () => setNewOpen(true), { enabled: canManage && !newOpen });

  const kioskHref = clinic.kioskKey ? `/kiosk?key=${encodeURIComponent(clinic.kioskKey)}` : null;
  const displayHref = clinic.kioskKey ? `/display?key=${encodeURIComponent(clinic.kioskKey)}` : null;

  const columnTitle: Record<ColumnKey, string> = {
    waiting: t('queue.board.waiting'),
    called: t('queue.board.called'),
    serving: t('queue.board.serving'),
    done: t('queue.board.done'),
  };
  const columnAccent: Record<ColumnKey, string> = {
    waiting: 'bg-accent',
    called: 'bg-[#7C5CFF]',
    serving: 'bg-[#00FFB2]',
    done: 'bg-text-muted',
  };

  const renderColumn = (key: ColumnKey) => {
    const rows = columns?.[key] ?? [];
    return (
      <section key={key} className="flex min-w-0 flex-col" aria-labelledby={`col-${key}`}>
        <header className="mb-2 flex items-center justify-between px-1">
          <h2 id={`col-${key}`} className="inline-flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-wide text-text-muted">
            <span className={cn('inline-block size-2 rounded-full', columnAccent[key])} aria-hidden="true" />
            {columnTitle[key]}
          </h2>
          <span className="tabular rounded-full border border-line bg-bg-elevated px-2 py-0.5 text-xs text-text-muted">{rows.length}</span>
        </header>
        <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto rounded-xl border border-dashed border-border/60 bg-popover/30 p-2 lg:max-h-[calc(100vh-22rem)]">
          {!columns ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">{t('queue.board.emptyColumn')}</p>
          ) : (
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <TicketCard
                  key={row.id}
                  row={row}
                  now={data?.now ?? new Date().toISOString()}
                  viewer={viewer}
                  readOnly={readOnly}
                  busy={busyId === row.id}
                  highlight={(highlight[row.id] ?? 0) > Date.now()}
                  onAction={(r, a, o) => void runAction(r, a, o)}
                  onStartVisit={onStartVisit}
                  onReprint={setReprintRow}
                  onLinkPatient={(r) => {
                    setLinkThenStart(false);
                    setLinkRow(r);
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>
    );
  };

  const totalToday = data?.stats.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('queue.title')}
        description={t('queue.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isToday ? <RealtimeBadge status={realtime.status} /> : null}
            {kioskHref ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={kioskHref} target="_blank" rel="noopener">
                  <TabletSmartphone aria-hidden="true" />
                  {t('queue.actions.openKiosk')}
                  <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            {displayHref ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={displayHref} target="_blank" rel="noopener">
                  <MonitorPlay aria-hidden="true" />
                  {t('queue.actions.openDisplay')}
                  <ExternalLink className="size-3 opacity-60" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
                <Plus aria-hidden="true" />
                {t('queue.actions.newTicket')}
                <Kbd className="ml-1 hidden md:inline-flex">T</Kbd>
              </Button>
            ) : null}
            {canCall ? (
              <Button variant="gradient" size="sm" onClick={() => void onNext()} loading={callNext.isPending} title={t('queue.actions.nextHint')}>
                <PhoneCall aria-hidden="true" />
                {t('queue.actions.next')}
                <Kbd className="ml-1 hidden md:inline-flex">N</Kbd>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Sana va filtr */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-9" aria-label={t('common.prev')} onClick={() => setDateKey((d) => shiftDateKey(d, -1))}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <label className="relative inline-flex items-center gap-2 rounded-md border border-line bg-bg-elevated px-3 py-1.5 text-sm text-text">
            <CalendarDays className="size-4 text-text-muted" aria-hidden="true" />
            <span className="sr-only">{t('queue.board.date')}</span>
            <input
              type="date"
              value={dateKey}
              max={todayKey}
              onChange={(e) => e.target.value && setDateKey(e.target.value)}
              className="tabular bg-transparent text-sm text-text outline-none [color-scheme:dark]"
              aria-label={t('queue.board.date')}
            />
          </label>
          <Button variant="ghost" size="icon" className="size-9" aria-label={t('common.next')} disabled={isToday} onClick={() => setDateKey((d) => shiftDateKey(d, 1))}>
            <ChevronRight aria-hidden="true" />
          </Button>
          {!isToday ? (
            <Button variant="link" size="sm" onClick={() => setDateKey(todayKey)}>
              {t('queue.board.today')}
            </Button>
          ) : null}
          {readOnly ? <span className="ml-2 text-xs text-warning">{t('queue.board.pastDay')}</span> : null}
        </div>
        <Segmented value={typeFilter} onChange={setTypeFilter} options={typeOptions} size="sm" ariaLabel={t('queue.dialog.new.type')} className="max-w-full overflow-x-auto" />
      </div>

      <QueueStats stats={data?.stats ?? null} loading={!data} />

      {/* Shifokor: hozirgi bemor */}
      {viewer.role === 'DOCTOR' && isToday ? (
        <div className={cn('glass-strong rounded-xl border p-4', current ? 'border-primary/30 shadow-glow' : 'border-line')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-accent">
                <Stethoscope className="size-5" aria-hidden="true" />
              </span>
              <div>
                <div className="text-xs uppercase tracking-wide text-text-muted">{viewer.room ? t('queue.board.myRoom', { room: viewer.room }) : t('queue.board.noRoom')}</div>
                {current ? (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn('tabular font-heading text-3xl font-extrabold', QUEUE_TYPE_META[current.type].text)}>{current.number}</span>
                    <span className="text-sm text-text">{current.patient?.fullName ?? t('queue.ticket.noPatient')}</span>
                    <span className="text-xs text-text-muted">{t(`common.queueStatus.${current.status}`)}</span>
                  </div>
                ) : (
                  <div className="text-sm text-text-muted">{t('queue.board.emptyToday')}</div>
                )}
              </div>
            </div>
            {current ? (
              <div className="flex flex-wrap gap-2">
                {current.visit ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/dashboard/visits/${current.visit.id}`}>
                      <ExternalLink aria-hidden="true" />
                      {t('queue.actions.openVisit')}
                    </Link>
                  </Button>
                ) : canVisit ? (
                  <Button size="sm" variant="gradient" onClick={() => onStartVisit(current)} loading={busyId === current.id}>
                    <Stethoscope aria-hidden="true" />
                    {t('queue.actions.startVisit')}
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => void runAction(current, 'done')} loading={busyId === current.id}>
                  {t('queue.actions.done')}
                </Button>
                {current.status === 'CALLED' ? (
                  <Button size="sm" variant="ghost" onClick={() => void runAction(current, 'skip')} disabled={busyId === current.id}>
                    {t('queue.actions.skip')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Ustunlar */}
      {data && totalToday === 0 ? (
        <EmptyState
          icon={isToday ? Inbox : ListOrdered}
          title={isToday ? t('queue.board.emptyToday') : t('queue.board.emptyDay')}
          description={t('queue.board.emptyDayHint')}
          action={
            canManage ? (
              <Button onClick={() => setNewOpen(true)}>
                <Plus aria-hidden="true" />
                {t('queue.actions.newTicket')}
              </Button>
            ) : undefined
          }
        />
      ) : isMobile ? (
        <div className="space-y-3">
          <Segmented
            value={mobileColumn}
            onChange={setMobileColumn}
            fullWidth
            size="sm"
            ariaLabel={t('common.status')}
            options={COLUMNS.map((c) => ({ value: c, label: `${columnTitle[c]} · ${columns?.[c].length ?? 0}` }))}
          />
          {renderColumn(mobileColumn)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{COLUMNS.map(renderColumn)}</div>
      )}

      <p className="hidden text-xs text-text-muted md:block">
        {t('queue.shortcuts.next')}
        {canManage ? ` · ${t('queue.shortcuts.newTicket')}` : ''}
      </p>

      {/* Dialoglar */}
      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} settings={settings} defaultType={typeFilter === 'ALL' ? 'DOCTOR' : typeFilter} />
      <ReprintDialog row={reprintRow} onOpenChange={(o) => !o && setReprintRow(null)} clinic={clinic} />
      <LinkPatientDialog
        row={linkRow}
        onOpenChange={(o) => {
          if (!o) {
            setLinkRow(null);
            setLinkThenStart(false);
          }
        }}
        onLinked={(updated) => {
          cache.patchRow(dateKey, updated);
          if (linkThenStart) onStartVisit(updated);
        }}
      />
      <Dialog open={doctorPickRow !== null} onOpenChange={(o) => !o && setDoctorPickRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t('queue.dialog.visit.title')} {doctorPickRow ? <span className="tabular text-accent">· {doctorPickRow.number}</span> : null}
            </DialogTitle>
            <DialogDescription>{doctorPickRow?.patient?.fullName ?? ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="queue-visit-doctor" required>
              {t('queue.dialog.visit.doctor')}
            </Label>
            <DoctorSelect id="queue-visit-doctor" value={pickedDoctor} onChange={setPickedDoctor} allowAny={false} enabled={doctorPickRow !== null} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDoctorPickRow(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="gradient"
              disabled={pickedDoctor === ANY_DOCTOR}
              loading={doctorPickRow ? busyId === doctorPickRow.id : false}
              onClick={() => {
                if (!doctorPickRow) return;
                const row = doctorPickRow;
                setDoctorPickRow(null);
                void startVisitWith(row, pickedDoctor);
              }}
            >
              <Stethoscope aria-hidden="true" />
              {t('queue.dialog.visit.start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

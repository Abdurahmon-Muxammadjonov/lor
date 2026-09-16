'use client';

import * as React from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { CalendarX2, RefreshCw, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/client';
import { api } from '@/lib/api/client';
import { minutesToHm, todayKey as computeTodayKey } from '@/lib/date';
import { useIsMobile } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { useConfirm } from '@/components/shared/confirm-dialog';
import {
  atTz,
  durationMinutes,
  formatDateKey,
  snapToSlot,
  tzMinutesOfDay,
  tzTime,
} from '@/lib/appointments/availability';
import {
  appointmentDateKey,
  dayColumns,
  gridMetrics,
  rangeForView,
  weekColumns,
  type CalendarColumn,
  type CalendarView,
} from '@/lib/appointments/calendar';
import type { AppointmentStatusCode } from '@/lib/appointments/schemas';
import type {
  AppointmentDTO,
  ClinicCalendarConfig,
  DoctorOption,
  QueueTicketLite,
} from '@/lib/appointments/types';
import { AgendaView } from './agenda-view';
import { AppointmentDialog, type AppointmentDialogMode } from './appointment-dialog';
import { CalendarProvider, type CalendarInteractions, type DragPreview } from './calendar-context';
import { CalendarSkeleton } from './calendar-skeleton';
import { CalendarToolbar } from './calendar-toolbar';
import { DayColumnHeader, DoctorColumnHeader } from './column-headers';
import { SLOT_PX, appointmentErrorMessage } from './constants';
import { columnKeyFromDropId, makeCalendarKeyboardCoordinates } from './dnd-keyboard';
import type { PatientLite } from './patient-picker';
import { StatusLegend } from './status-legend';
import { TimeGrid } from './time-grid';
import {
  appointmentKeys,
  useAppointmentsRange,
  useDeleteAppointment,
  useMoveAppointment,
  useSetStatus,
} from './use-appointments';

export interface AppointmentsCalendarProps {
  doctors: DoctorOption[];
  clinic: ClinicCalendarConfig;
  canWrite: boolean;
  todayKey: string;
  initialDate: string;
  initialView: CalendarView;
  initialDoctorIds: string[];
  /** `?patientId=` — bemor oldindan tanlangan yangi yozilish dialogi */
  initialPatientId: string | null;
  /** `?new=1` — dialogni darhol ochish */
  openNew: boolean;
}

interface DragData {
  appointment: AppointmentDTO;
  columnKey: string;
}

interface PatientCardLite {
  id: string;
  fullName: string;
  cardNumber: string;
  phone: string;
  gender: 'MALE' | 'FEMALE';
  smsConsent: boolean;
}

const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : rectIntersection(args);
};

/**
 * Yozilish kalendari (client): kun/hafta koʻrinishi, shifokor filtri, drag & drop (@dnd-kit),
 * yaratish/tahrirlash dialogi, holat menyusi (ARRIVED → navbat raqami), mobil roʻyxat.
 */
export function AppointmentsCalendar({
  doctors,
  clinic,
  canWrite,
  todayKey: serverTodayKey,
  initialDate,
  initialView,
  initialDoctorIds,
  initialPatientId,
  openNew,
}: AppointmentsCalendarProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();

  const [dateKey, setDateKey] = React.useState(initialDate);
  const [view, setView] = React.useState<CalendarView>(initialView);
  const [doctorIds, setDoctorIds] = React.useState<string[]>(initialDoctorIds);
  const [now, setNow] = React.useState<{ dateKey: string; minutes: number }>({
    dateKey: serverTodayKey,
    minutes: -1,
  });
  const [dialog, setDialog] = React.useState<{ open: boolean; mode: AppointmentDialogMode | null }>({
    open: false,
    mode: null,
  });
  const [dragPreview, setDragPreview] = React.useState<DragPreview | null>(null);
  const dragPreviewRef = React.useRef<DragPreview | null>(null);
  const suppressClickRef = React.useRef(false);
  const [confirm, confirmElement] = useConfirm();

  // Hozirgi vaqt (Toshkent) — chiziq va oʻtgan slotlar uchun; har 30 soniyada yangilanadi
  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow({ dateKey: computeTodayKey(d), minutes: tzMinutesOfDay(d) });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const metrics = React.useMemo(
    () => gridMetrics(clinic.workStart, clinic.workEnd, clinic.slotMinutes, SLOT_PX),
    [clinic],
  );
  const range = React.useMemo(() => rangeForView(view, dateKey), [view, dateKey]);
  const rangeParams = React.useMemo(() => ({ from: range.from, to: range.to }), [range.from, range.to]);
  const rangeKey = appointmentKeys.range(rangeParams);
  const query = useAppointmentsRange(rangeParams);

  React.useEffect(() => {
    if (query.isError) toast.error(t('appointments.toast.loadFailed'), { id: 'appointments-load' });
  }, [query.isError, t]);

  const visibleDoctors = React.useMemo(
    () => (doctorIds.length ? doctors.filter((d) => doctorIds.includes(d.id)) : doctors),
    [doctors, doctorIds],
  );
  const allItems = React.useMemo(() => query.data?.items ?? [], [query.data]);
  const visibleItems = React.useMemo(() => {
    const ids = new Set(visibleDoctors.map((d) => d.id));
    return allItems.filter((a) => ids.has(a.doctorId));
  }, [allItems, visibleDoctors]);

  const columns = React.useMemo<CalendarColumn[]>(
    () =>
      view === 'day'
        ? dayColumns(dateKey, visibleDoctors, allItems)
        : weekColumns(range.keys, visibleDoctors, allItems),
    [view, dateKey, visibleDoctors, allItems, range.keys],
  );
  const columnsByKey = React.useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const doctorsById = React.useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  const columnLabel = React.useCallback(
    (col: CalendarColumn): string => {
      if (view === 'day' && col.doctorId)
        return doctorsById.get(col.doctorId)?.fullName ?? formatDateKey(col.dateKey);
      return formatDateKey(col.dateKey);
    },
    [view, doctorsById],
  );

  // ── URL sinxronizatsiyasi (?date&view&doctor) ──
  const consumedRef = React.useRef(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    sp.set('date', dateKey);
    if (view === 'week') sp.set('view', 'week');
    else sp.delete('view');
    if (doctorIds.length) sp.set('doctor', doctorIds.join(','));
    else sp.delete('doctor');
    if (consumedRef.current) {
      sp.delete('patientId');
      sp.delete('new');
    }
    const qs = sp.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`)
      window.history.replaceState(null, '', next);
  }, [dateKey, view, doctorIds, dialog.open]);

  // ── Mutatsiyalar ──
  const move = useMoveAppointment(rangeKey, doctors);
  const setStatus = useSetStatus();
  const remove = useDeleteAppointment();

  const pendingIds = React.useMemo(() => {
    const s = new Set<string>();
    if (move.isPending && move.variables) s.add(move.variables.id);
    if (setStatus.isPending && setStatus.variables) s.add(setStatus.variables.id);
    if (remove.isPending && remove.variables) s.add(remove.variables.id);
    return s;
  }, [
    move.isPending,
    move.variables,
    setStatus.isPending,
    setStatus.variables,
    remove.isPending,
    remove.variables,
  ]);

  const openCreate = React.useCallback(
    (init: Omit<Extract<AppointmentDialogMode, { kind: 'create' }>, 'kind'>) =>
      setDialog({ open: true, mode: { kind: 'create', ...init } }),
    [],
  );
  const openEdit = React.useCallback(
    (a: AppointmentDTO) => setDialog({ open: true, mode: { kind: 'edit', appointment: a } }),
    [],
  );

  const onStatus = React.useCallback(
    async (a: AppointmentDTO, status: AppointmentStatusCode) => {
      if (!canWrite) return;
      if (status === 'CANCELLED') {
        const ok = await confirm({
          title: t('appointments.confirmCancel.title'),
          description: t('appointments.confirmCancel.description', {
            patient: a.patient.fullName,
            time: `${formatDateKey(appointmentDateKey(a))} ${tzTime(a.startAt)}`,
          }),
          confirmText: t('appointments.actions.cancel'),
          destructive: true,
        });
        if (!ok) return;
      }
      try {
        await setStatus.mutateAsync({ id: a.id, status });
        toast.success(
          t('appointments.toast.statusChanged', { status: t(`common.appointmentStatus.${status}`) }),
        );
      } catch (err) {
        toast.error(appointmentErrorMessage(t, err));
        return;
      }
      if (status === 'ARRIVED') {
        // Navbat raqami [queue] moduli orqali: server faqat holatni saqlaydi
        try {
          const ticket = await api.post<QueueTicketLite>('/api/queue', {
            type: 'DOCTOR',
            patientId: a.patientId,
            doctorId: a.doctorId,
          });
          toast.success(t('appointments.toast.queueCreated', { number: ticket.number }), { duration: 8000 });
        } catch {
          toast.warning(t('appointments.toast.queueFailed'));
        }
      }
    },
    [canWrite, confirm, setStatus, t],
  );

  const onDelete = React.useCallback(
    async (a: AppointmentDTO) => {
      if (!canWrite) return;
      const ok = await confirm({
        title: t('appointments.delete.title'),
        description: t('appointments.delete.description', {
          patient: a.patient.fullName,
          time: `${formatDateKey(appointmentDateKey(a))} ${tzTime(a.startAt)}`,
        }),
        destructive: true,
      });
      if (!ok) return;
      try {
        await remove.mutateAsync({ id: a.id });
        toast.success(t('appointments.toast.deleted'));
      } catch (err) {
        toast.error(appointmentErrorMessage(t, err));
      }
    },
    [canWrite, confirm, remove, t],
  );

  // ── ?patientId= / ?new=1 ──
  const patientQuery = useQuery({
    queryKey: ['patient', initialPatientId],
    queryFn: () => api.get<PatientCardLite>(`/api/patients/${initialPatientId}`),
    enabled: !!initialPatientId && canWrite,
    staleTime: 60_000,
  });
  React.useEffect(() => {
    if (consumedRef.current || !canWrite) return;
    if (initialPatientId) {
      if (patientQuery.isError) {
        consumedRef.current = true;
        toast.error(t('appointments.toast.patientLoadFailed'));
        return;
      }
      if (!patientQuery.data) return;
      const p = patientQuery.data;
      const patient: PatientLite = {
        id: p.id,
        fullName: p.fullName,
        cardNumber: p.cardNumber,
        phone: p.phone,
        gender: p.gender,
        smsConsent: p.smsConsent,
      };
      consumedRef.current = true;
      openCreate({
        date: initialDate,
        patient,
        doctorId: initialDoctorIds.length === 1 ? initialDoctorIds[0] : null,
      });
      return;
    }
    if (openNew) {
      consumedRef.current = true;
      openCreate({ date: initialDate, doctorId: initialDoctorIds.length === 1 ? initialDoctorIds[0] : null });
    }
  }, [
    initialPatientId,
    openNew,
    patientQuery.data,
    patientQuery.isError,
    canWrite,
    openCreate,
    initialDate,
    initialDoctorIds,
    t,
  ]);

  // ── Drag & drop ──
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: React.useMemo(() => makeCalendarKeyboardCoordinates(SLOT_PX), []),
    }),
  );

  const originStart = React.useCallback(
    (a: AppointmentDTO) => {
      const dur = durationMinutes(a.startAt, a.endAt);
      const raw = tzMinutesOfDay(new Date(a.startAt));
      return Math.min(
        Math.max(raw, metrics.workStartMin),
        Math.max(metrics.workStartMin, metrics.workEndMin - dur),
      );
    },
    [metrics],
  );

  const updatePreview = React.useCallback((p: DragPreview | null) => {
    dragPreviewRef.current = p;
    setDragPreview(p);
  }, []);

  const onDragStart = React.useCallback(
    (e: DragStartEvent) => {
      const data = e.active.data.current as DragData | undefined;
      if (!data) return;
      suppressClickRef.current = true;
      updatePreview({
        id: data.appointment.id,
        columnKey: data.columnKey,
        startMin: originStart(data.appointment),
        appointment: data.appointment,
      });
    },
    [originStart, updatePreview],
  );

  const onDragMove = React.useCallback(
    (e: DragMoveEvent) => {
      const data = e.active.data.current as DragData | undefined;
      if (!data) return;
      const dur = durationMinutes(data.appointment.startAt, data.appointment.endAt);
      const startMin = snapToSlot(
        originStart(data.appointment) + e.delta.y / metrics.pxPerMin,
        metrics.step,
        metrics.workStartMin,
        Math.max(metrics.workStartMin, metrics.workEndMin - dur),
      );
      const overKey = columnKeyFromDropId(e.over?.id) ?? dragPreviewRef.current?.columnKey ?? data.columnKey;
      const prev = dragPreviewRef.current;
      if (prev && prev.columnKey === overKey && prev.startMin === startMin) return;
      updatePreview({ id: data.appointment.id, columnKey: overKey, startMin, appointment: data.appointment });
    },
    [metrics, originStart, updatePreview],
  );

  const finishDrag = React.useCallback(() => {
    updatePreview(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }, [updatePreview]);

  const onDragEnd = React.useCallback(
    (e: DragEndEvent) => {
      const data = e.active.data.current as DragData | undefined;
      const preview = dragPreviewRef.current;
      finishDrag();
      if (!data || !preview) return;
      const col = columnsByKey.get(preview.columnKey);
      if (!col) return;
      const a = data.appointment;
      const unchanged = preview.columnKey === data.columnKey && preview.startMin === originStart(a);
      if (unchanged) return;
      const doctorId = col.doctorId ?? a.doctorId;
      const startAt = atTz(col.dateKey, minutesToHm(preview.startMin)).toISOString();
      const label = `${formatDateKey(col.dateKey)} ${minutesToHm(preview.startMin)}`;
      move.mutate(
        { id: a.id, startAt, doctorId },
        {
          onSuccess: () => toast.success(t('appointments.toast.moved', { time: label })),
          onError: (err) =>
            toast.error(`${t('appointments.toast.moveFailed')}: ${appointmentErrorMessage(t, err)}`),
        },
      );
    },
    [columnsByKey, finishDrag, move, originStart, t],
  );

  const announcements = React.useMemo<Announcements>(() => {
    const dataOf = (active: Active) => active.data.current as DragData | undefined;
    const where = (): { column: string; time: string } | null => {
      const p = dragPreviewRef.current;
      if (!p) return null;
      const col = columnsByKey.get(p.columnKey);
      return { column: col ? columnLabel(col) : '', time: minutesToHm(p.startMin) };
    };
    return {
      onDragStart: ({ active }) => {
        const d = dataOf(active);
        return d ? t('appointments.dnd.pickedUp', { patient: d.appointment.patient.fullName }) : undefined;
      },
      onDragOver: ({ active }) => {
        const d = dataOf(active);
        const w = where();
        return d && w
          ? t('appointments.dnd.movedOver', { patient: d.appointment.patient.fullName, ...w })
          : undefined;
      },
      onDragEnd: ({ active }) => {
        const d = dataOf(active);
        const w = where();
        return d && w
          ? t('appointments.dnd.dropped', { patient: d.appointment.patient.fullName, ...w })
          : undefined;
      },
      onDragCancel: () => t('appointments.dnd.cancelled'),
    };
  }, [t, columnsByKey, columnLabel]);

  const onSlotClick = React.useCallback(
    (col: CalendarColumn, minutes: number) => {
      if (!canWrite) return;
      openCreate({
        doctorId: col.doctorId ?? (visibleDoctors.length === 1 ? (visibleDoctors[0]?.id ?? null) : null),
        date: col.dateKey,
        time: minutesToHm(minutes),
      });
    },
    [canWrite, openCreate, visibleDoctors],
  );

  const onSaved = React.useCallback(
    (a: AppointmentDTO) => {
      const key = appointmentDateKey(a);
      if (!range.keys.includes(key)) setDateKey(key);
    },
    [range.keys],
  );

  const interactions = React.useMemo<CalendarInteractions>(
    () => ({
      canWrite,
      slotMinutes: metrics.step,
      workStartMin: metrics.workStartMin,
      workEndMin: metrics.workEndMin,
      pxPerMin: metrics.pxPerMin,
      now,
      dragPreview,
      suppressClickRef,
      pendingIds,
      onOpen: openEdit,
      onStatus: (a, s) => void onStatus(a, s),
      onDelete: (a) => void onDelete(a),
    }),
    [canWrite, metrics, now, dragPreview, pendingIds, openEdit, onStatus, onDelete],
  );

  const renderHeader = React.useCallback(
    (col: CalendarColumn) => {
      if (view === 'day' && col.doctorId) {
        const d = doctorsById.get(col.doctorId);
        return d ? <DoctorColumnHeader doctor={d} count={col.items.length} /> : null;
      }
      return (
        <DayColumnHeader
          dateKey={col.dateKey}
          isToday={col.dateKey === now.dateKey}
          count={col.items.length}
        />
      );
    },
    [view, doctorsById, now.dateKey],
  );

  // Hafta koʻrinishida bir ustunda bir necha shifokor boʻlishi mumkin — kartada rang nuqtasi
  const showDoctorOnCards = view === 'week' && visibleDoctors.length !== 1;

  let content: React.ReactNode;
  if (doctors.length === 0) {
    content = (
      <EmptyState
        icon={Stethoscope}
        title={t('appointments.filter.noDoctors')}
        description={t('appointments.filter.noDoctorsHint')}
        action={
          <Button asChild variant="outline">
            <a href="/dashboard/doctors">{t('common.nav.doctors')}</a>
          </Button>
        }
      />
    );
  } else if (query.isPending) {
    content = <CalendarSkeleton columns={Math.min(4, view === 'day' ? visibleDoctors.length || 1 : 7)} />;
  } else if (query.isError && !query.data) {
    content = (
      <EmptyState
        icon={CalendarX2}
        title={t('appointments.toast.loadFailed')}
        action={
          <Button variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw aria-hidden="true" />
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (isMobile) {
    content = (
      <AgendaView
        items={visibleItems}
        keys={range.keys}
        view={view}
        onNew={() => openCreate({ date: dateKey })}
      />
    );
  } else {
    content = (
      <div className="flex flex-col gap-3">
        {visibleItems.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarX2}
            title={view === 'week' ? t('appointments.empty.week') : t('appointments.empty.day')}
            description={canWrite ? t('appointments.empty.description') : t('appointments.empty.readOnly')}
            className="rounded-xl border border-dashed border-line bg-card/40"
          />
        ) : null}
        <TimeGrid
          columns={columns}
          renderHeader={renderHeader}
          showDoctorOnCards={showDoctorOnCards}
          workStart={clinic.workStart}
          workEnd={clinic.workEnd}
          onSlotClick={canWrite ? onSlotClick : undefined}
        />
        {canWrite ? (
          <p className="text-xs text-text-muted">{t('appointments.grid.dropHint')}</p>
        ) : (
          <p className="text-xs text-text-muted">{t('appointments.grid.readOnly')}</p>
        )}
      </div>
    );
  }

  return (
    <CalendarProvider value={interactions}>
      <div className="flex flex-col gap-5">
        <PageHeader
          title={t('appointments.title')}
          description={t('appointments.description')}
          breadcrumbs={[
            { label: t('common.nav.dashboard'), href: '/dashboard' },
            { label: t('appointments.title') },
          ]}
        />
        <CalendarToolbar
          dateKey={dateKey}
          todayKey={now.dateKey}
          view={view}
          onDateChange={setDateKey}
          onViewChange={setView}
          doctors={doctors}
          selectedDoctorIds={doctorIds}
          onDoctorsChange={setDoctorIds}
          canWrite={canWrite}
          onNew={() =>
            openCreate({
              date: dateKey,
              doctorId: visibleDoctors.length === 1 ? (visibleDoctors[0]?.id ?? null) : null,
            })
          }
          count={visibleItems.length}
        />
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={finishDrag}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: t('appointments.dnd.instructions') },
          }}
        >
          {content}
        </DndContext>
        <StatusLegend />
        <AppointmentDialog
          open={dialog.open}
          onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
          mode={dialog.mode}
          doctors={doctors}
          clinic={clinic}
          todayKey={now.dateKey}
          onSaved={onSaved}
        />
        {confirmElement}
      </div>
    </CalendarProvider>
  );
}

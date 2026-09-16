'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatPhone } from '@/lib/utils';
import { api, qs } from '@/lib/api/client';
import { fmtDate } from '@/lib/date';
import type { SessionUser } from '@/lib/auth/session';
import { useLocale } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchInput } from '@/components/shared/search-input';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { visitApi, visitErrorMessage } from './visit-api';
import { patientAgeInfo } from './visit-utils';

/** `GET /api/patients/search` elementi (patients moduli) */
export interface PatientPick {
  id: string;
  fullName: string;
  cardNumber: string;
  phone: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE';
}

/** `GET /api/users?role=DOCTOR&active=1` elementi (staff moduli) */
interface DoctorOption {
  id: string;
  fullName: string;
  role: string;
  specialty: string | null;
  room: string | null;
  color: string;
  isActive: boolean;
}

export interface NewVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
  /** Boshqa sahifadan (masalan bemor kartasidan) kelgan bemor */
  initialPatientId?: string | null;
  childAgeLimit?: number;
}

/**
 * "Yangi qabul": bemor qidiruvi (/api/patients/search) + shifokor (/api/users?role=DOCTOR) → POST /api/visits → qabul sahifasi.
 * DOCTOR roli uchun shifokor — oʻzi (oʻzgartirib boʻlmaydi).
 */
export function NewVisitDialog({
  open,
  onOpenChange,
  user,
  initialPatientId = null,
  childAgeLimit = 14,
}: NewVisitDialogProps) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const isDoctor = user.role === 'DOCTOR';

  const [q, setQ] = React.useState('');
  const [patient, setPatient] = React.useState<PatientPick | null>(null);
  const [doctorId, setDoctorId] = React.useState<string>(isDoctor ? user.id : '');

  React.useEffect(() => {
    if (!open) {
      setQ('');
      setPatient(null);
      setDoctorId(isDoctor ? user.id : '');
    }
  }, [open, isDoctor, user.id]);

  const initial = useQuery({
    queryKey: ['patient', initialPatientId ?? ''] as const,
    queryFn: () => api.get<PatientPick>(`/api/patients/${initialPatientId}`),
    enabled: open && !!initialPatientId && !patient,
    staleTime: 60_000,
  });
  React.useEffect(() => {
    if (initial.data && !patient) setPatient(initial.data);
  }, [initial.data, patient]);

  const search = useQuery({
    queryKey: ['patients', 'search', q] as const,
    queryFn: () => api.get<{ items: PatientPick[] }>(`/api/patients/search${qs({ q, limit: 8 })}`),
    enabled: open && q.trim().length >= 2 && !patient,
    staleTime: 30_000,
  });

  const doctors = useQuery({
    queryKey: ['users', { role: 'DOCTOR', active: '1' }] as const,
    queryFn: () => api.get<{ items: DoctorOption[] }>(`/api/users${qs({ role: 'DOCTOR', active: '1' })}`),
    enabled: open && !isDoctor,
    staleTime: 5 * 60_000,
  });
  const doctorItems = React.useMemo(
    () => (doctors.data?.items ?? []).filter((d) => d.isActive),
    [doctors.data],
  );

  // Bitta shifokor boʻlsa — avtomatik tanlash
  React.useEffect(() => {
    if (!isDoctor && !doctorId && doctorItems.length === 1 && doctorItems[0]) setDoctorId(doctorItems[0].id);
  }, [isDoctor, doctorId, doctorItems]);

  const create = useMutation({
    mutationFn: () =>
      visitApi.create({
        patientId: patient?.id ?? '',
        doctorId: isDoctor ? undefined : doctorId || undefined,
      }),
    onSuccess: (visit) => {
      toast.success(t('visits.toasts.created'));
      onOpenChange(false);
      router.push(`/dashboard/visits/${visit.id}`);
    },
    onError: (err) => toast.error(visitErrorMessage(err, t)),
  });

  const canCreate = !!patient && (isDoctor || !!doctorId) && !create.isPending;
  const results = search.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canCreate) create.mutate();
          }}
          className="space-y-5"
        >
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-accent" aria-hidden="true" />
              {t('visits.newVisit.title')}
            </DialogTitle>
            <DialogDescription>{t('visits.newVisit.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="nv-patient" required>
              {t('visits.newVisit.patient')}
            </Label>
            {patient ? (
              <PatientCard
                patient={patient}
                childAgeLimit={childAgeLimit}
                locale={locale}
                onChange={() => setPatient(null)}
              />
            ) : (
              <>
                <SearchInput
                  id="nv-patient"
                  value={q}
                  onChange={setQ}
                  placeholder={t('visits.newVisit.patientPlaceholder')}
                  autoFocus
                  loading={search.isFetching}
                  debounce={250}
                />
                <div className="min-h-[3rem]">
                  {q.trim().length < 2 ? (
                    <p className="flex items-center gap-1.5 px-1 text-xs text-text-muted">
                      <Search className="size-3.5" aria-hidden="true" />
                      {t('visits.newVisit.searchHint')}
                    </p>
                  ) : search.isPending ? (
                    <div className="space-y-2" aria-busy="true">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : results.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-text-muted">
                      <div>{t('visits.newVisit.noPatients')}</div>
                      <Button asChild variant="link" size="sm" className="mt-1 h-auto">
                        <a href={`/dashboard/patients?new=1&q=${encodeURIComponent(q.trim())}`}>
                          {t('visits.newVisit.registerPatient')}
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <ul
                      className="scrollbar-thin max-h-64 space-y-1 overflow-y-auto"
                      role="listbox"
                      aria-label={t('visits.newVisit.patient')}
                    >
                      {results.map((p) => {
                        const info = patientAgeInfo(p.birthDate, childAgeLimit);
                        return (
                          <li key={p.id} role="option" aria-selected={false}>
                            <button
                              type="button"
                              onClick={() => setPatient(p)}
                              className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-line hover:bg-surface focus-visible:border-accent focus-visible:outline-none"
                            >
                              <GenderAvatar gender={p.gender} name={p.fullName} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-text">
                                  {p.fullName}
                                </span>
                                <span className="tabular block truncate text-xs text-text-muted">
                                  {t('visits.newVisit.card', { n: p.cardNumber })} ·{' '}
                                  {t('visits.header.age', { n: info.age })} · {formatPhone(p.phone)}
                                </span>
                              </span>
                              <ArrowRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nv-doctor" required>
              {t('visits.newVisit.doctor')}
            </Label>
            {isDoctor ? (
              <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-bg-elevated px-3 text-sm text-text">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: user.color ?? '#00D4FF' }}
                />
                {user.fullName}
                {user.room ? <span className="text-text-muted">· {user.room}</span> : null}
              </div>
            ) : (
              <Select value={doctorId} onValueChange={setDoctorId} disabled={doctors.isPending}>
                <SelectTrigger id="nv-doctor" aria-label={t('visits.newVisit.doctor')}>
                  <SelectValue
                    placeholder={
                      doctors.isPending ? t('common.loading') : t('visits.newVisit.doctorPlaceholder')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {doctorItems.length === 0 && !doctors.isPending ? (
                    <div className="px-3 py-2 text-sm text-text-muted">{t('visits.newVisit.noDoctors')}</div>
                  ) : null}
                  {doctorItems.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{ backgroundColor: d.color }}
                        />
                        {d.fullName}
                        {d.room ? <span className="text-text-muted">· {d.room}</span> : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="gradient"
              className="glow"
              disabled={!canCreate}
              loading={create.isPending}
            >
              {t('visits.newVisit.create')}
              <ArrowRight aria-hidden="true" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PatientCard({
  patient,
  childAgeLimit,
  locale,
  onChange,
}: {
  patient: PatientPick;
  childAgeLimit: number;
  locale: 'uz' | 'ru';
  onChange: () => void;
}) {
  const { t } = useLocale();
  const info = patientAgeInfo(patient.birthDate, childAgeLimit);
  return (
    <div
      className={cn('flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5')}
    >
      <GenderAvatar gender={patient.gender} name={patient.fullName} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-text">{patient.fullName}</div>
        <div className="tabular truncate text-xs text-text-muted">
          {t('visits.newVisit.card', { n: patient.cardNumber })} ·{' '}
          {info.type === 'CHILD'
            ? t('visits.header.child', { n: info.age })
            : t('visits.header.age', { n: info.age })}{' '}
          · {fmtDate(patient.birthDate, locale)} · {formatPhone(patient.phone)}
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onChange}>
        {t('visits.newVisit.change')}
      </Button>
    </div>
  );
}

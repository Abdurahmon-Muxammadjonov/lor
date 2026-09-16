import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/permissions';
import { todayKey } from '@/lib/date';
import { parseClinicSettings, parseWeeklySchedule } from '@/lib/settings/types';
import { getT } from '@/i18n/server';
import { isValidDateKey } from '@/lib/appointments/availability';
import { isCalendarView, type CalendarView } from '@/lib/appointments/calendar';
import type { ClinicCalendarConfig, DoctorOption } from '@/lib/appointments/types';
import { AppointmentsCalendar } from '@/components/appointments/appointments-calendar';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('appointments.title'), robots: { index: false, follow: false } };
}

interface AppointmentsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * /dashboard/appointments — shifokorlar kalendari (kun/hafta, drag & drop).
 * ?date=YYYY-MM-DD · ?view=day|week · ?doctor=id1,id2 · ?patientId= (bemor oldindan tanlangan) · ?new=1
 */
export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const user = await requireUser('appointments.view');
  const clinicId = user.clinicId;

  const [clinic, doctorRows] = await Promise.all([
    prisma.clinic.findFirst({
      where: { id: clinicId },
      select: { name: true, workStart: true, workEnd: true, slotMinutes: true, settings: true },
    }),
    prisma.user.findMany({
      where: { clinicId, role: 'DOCTOR', isActive: true },
      orderBy: [{ room: 'asc' }, { fullName: 'asc' }],
      select: { id: true, fullName: true, room: true, color: true, specialty: true, schedule: true },
    }),
  ]);

  const config: ClinicCalendarConfig = {
    name: clinic?.name ?? user.clinicName,
    workStart: clinic?.workStart ?? '08:00',
    workEnd: clinic?.workEnd ?? '20:00',
    slotMinutes: clinic?.slotMinutes ?? 20,
    smsEnabled: parseClinicSettings(clinic?.settings).sms.enabled,
  };
  const doctors: DoctorOption[] = doctorRows.map((d) => ({
    id: d.id,
    fullName: d.fullName,
    room: d.room,
    color: d.color,
    specialty: d.specialty,
    schedule: parseWeeklySchedule(d.schedule),
  }));

  const today = todayKey();
  const dateParam = first(searchParams.date);
  const viewParam = first(searchParams.view);
  const doctorParam = first(searchParams.doctor);
  const patientParam = first(searchParams.patientId);
  const knownIds = new Set(doctors.map((d) => d.id));
  const requestedDoctors = (doctorParam ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((id) => knownIds.has(id));
  // Shifokor oʻz kalendarini koʻradi (filtr berilmagan boʻlsa)
  const defaultDoctors = requestedDoctors.length
    ? requestedDoctors
    : user.role === 'DOCTOR' && knownIds.has(user.id)
      ? [user.id]
      : [];
  const view: CalendarView = isCalendarView(viewParam) ? viewParam : 'day';

  return (
    <AppointmentsCalendar
      doctors={doctors}
      clinic={config}
      canWrite={can(user.role, 'appointments.write')}
      todayKey={today}
      initialDate={isValidDateKey(dateParam) ? dateParam : today}
      initialView={view}
      initialDoctorIds={defaultDoctors}
      initialPatientId={patientParam && /^[\w-]{1,64}$/.test(patientParam) ? patientParam : null}
      openNew={first(searchParams.new) === '1'}
    />
  );
}

import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { getLocale, getT } from '@/i18n/server';
import { CLINIC_TZ, fmtWeekday } from '@/lib/date';
import { greetingKey } from '@/lib/dashboard/greeting';
import { HomeDashboard } from '@/components/dashboard/home/home-dashboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('dashboard.meta.title') };
}

/** Klinika vaqti (Asia/Tashkent) boʻyicha soat — salomlashuv serverda hisoblanadi (gidratsiya bir xil) */
function clinicHour(now: Date): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: CLINIC_TZ, hour: '2-digit', hour12: false }).format(now);
  const n = Number(h);
  return Number.isFinite(n) ? n % 24 : now.getHours();
}

/** Klinika vaqt mintaqasidagi devor soati bilan Date (server TZ qanday boʻlishidan qatʼi nazar) */
function clinicLocalDate(now: Date): Date {
  const local = new Date(now.toLocaleString('en-US', { timeZone: CLINIC_TZ }));
  return Number.isNaN(local.getTime()) ? now : local;
}

/** /dashboard — bosh sahifa (dashboard.view). CASHIER ham shu yerga kirishi mumkin — yoʻnaltirish yoʻq. */
export default async function DashboardHomePage() {
  const user = await requireUser('dashboard.view');
  const now = new Date();
  const dateLabel = fmtWeekday(clinicLocalDate(now), getLocale());
  return <HomeDashboard user={user} dateLabel={dateLabel} greeting={greetingKey(clinicHour(now))} />;
}

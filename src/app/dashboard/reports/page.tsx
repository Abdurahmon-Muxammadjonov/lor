import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { getT } from '@/i18n/server';
import { allowedTabs } from '@/lib/reports/access';
import { PrintQuerySchema } from '@/lib/reports/schemas';
import { ReportsPage } from '@/components/reports/reports-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('reports.meta.title') };
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** /dashboard/reports — hisobotlar (reports.view). URL parametrlari boshlangʻich holat sifatida beriladi. */
export default async function ReportsRoute({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser('reports.view');
  const parsed = PrintQuerySchema.safeParse({
    tab: first(searchParams.tab),
    from: first(searchParams.from),
    to: first(searchParams.to),
    groupBy: first(searchParams.groupBy),
    doctorId: first(searchParams.doctorId),
    all: first(searchParams.all),
  });
  const q = parsed.success ? parsed.data : PrintQuerySchema.parse({});
  const tabs = allowedTabs(user.role);
  const tab = tabs.includes(q.tab) ? q.tab : tabs[0] ?? 'revenue';
  return (
    <ReportsPage
      role={user.role}
      initial={{ tab, from: q.from, to: q.to, groupBy: q.groupBy, doctorId: q.doctorId, allTime: q.all }}
    />
  );
}

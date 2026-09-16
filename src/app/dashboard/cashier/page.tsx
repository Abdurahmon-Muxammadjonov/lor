import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { getT } from '@/i18n/server';
import { CashierPage, type CashierTab } from '@/components/cashier/cashier-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('cashier.meta.title'), robots: { index: false, follow: false } };
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : null;
}

function tabOf(v: string | null): CashierTab {
  return v === 'payments' || v === 'shifts' ? v : 'unpaid';
}

/** /dashboard/cashier — kassa (payments.view). `?visit=<id>` yoki `?visitId=<id>` toʻlov oynasini darhol ochadi. */
export default async function CashierRoute({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser('payments.view');
  const initialVisitId = first(searchParams.visit) ?? first(searchParams.visitId);
  return (
    <CashierPage
      viewer={{ id: user.id, role: user.role, fullName: user.fullName }}
      initialVisitId={initialVisitId}
      initialTab={tabOf(first(searchParams.tab))}
    />
  );
}

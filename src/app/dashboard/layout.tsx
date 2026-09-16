import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/session';
import { getMeClinic } from '@/lib/dashboard/me';
import type { MeClinicDTO } from '@/lib/dashboard/types';
import { QueueSettingsSchema } from '@/lib/settings/types';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export const dynamic = 'force-dynamic';

/**
 * Klinika maʼlumoti DB dan; vaqtinchalik xato boʻlsa sessiyadagi minimal maʼlumot bilan davom etamiz —
 * qobiq (yon panel, yuqori panel) hech qachon butun dashboardni yiqitmasligi kerak.
 */
async function loadClinic(user: Awaited<ReturnType<typeof requireUser>>): Promise<MeClinicDTO> {
  try {
    return await getMeClinic(user.clinicId, user.role);
  } catch {
    return {
      id: user.clinicId,
      name: user.clinicName,
      slug: user.clinicSlug,
      plan: 'START',
      phone: '',
      kioskKey: null,
      settings: { queue: QueueSettingsSchema.parse({}) },
    };
  }
}

/** /dashboard/* qobigʻi: sessiya majburiy (kirmagan → /login), keyin client qobiq */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const clinic = await loadClinic(user);
  return (
    <DashboardShell user={user} clinic={clinic}>
      {children}
    </DashboardShell>
  );
}

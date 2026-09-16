import type { Metadata } from 'next';
import { ResetForm } from '@/components/auth/reset-form';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('auth.meta.reset'), robots: { index: false, follow: false } };
}

interface ResetPasswordPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/** /reset-password?token=… — yangi parol oʻrnatish */
export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const raw = searchParams.token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  return <ResetForm token={token} />;
}

import type { Metadata } from 'next';
import { ForgotForm } from '@/components/auth/forgot-form';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('auth.meta.forgot'), robots: { index: false, follow: false } };
}

/** /forgot-password — parolni tiklash havolasini soʻrash */
export default function ForgotPasswordPage() {
  return <ForgotForm />;
}

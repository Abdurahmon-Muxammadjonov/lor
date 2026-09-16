import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { getT } from '@/i18n/server';
import { sanitizeCallbackUrl } from '@/lib/auth/schemas';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('auth.meta.login'), robots: { index: false, follow: false } };
}

interface LoginPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * /login — kirish sahifasi. Kirgan foydalanuvchilarni middleware /dashboard ga yoʻnaltiradi.
 * `?callbackUrl=` faqat sayt ichidagi yoʻl boʻlsa ishlatiladi, aks holda /dashboard.
 */
export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackUrl = sanitizeCallbackUrl(searchParams.callbackUrl);
  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDS === '1';
  return <LoginForm callbackUrl={callbackUrl} showDemo={showDemo} />;
}

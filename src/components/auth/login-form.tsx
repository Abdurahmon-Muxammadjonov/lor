'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { AlertCircle, Eye, EyeOff, KeyRound, LogIn, Sparkles, UserRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useT } from '@/i18n/client';
import { LoginSchema, type LoginInput } from '@/lib/auth/schemas';
import { cn } from '@/lib/utils';

const AUTH_ERROR_CODES = ['INVALID_CREDENTIALS', 'RATE_LIMITED', 'INACTIVE', 'CLINIC_INACTIVE'] as const;
type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

function isAuthErrorCode(v: string): v is AuthErrorCode {
  return (AUTH_ERROR_CODES as readonly string[]).includes(v);
}

/** NextAuth `res.error` → i18n kaliti */
export function loginErrorKey(error: string | null | undefined): string {
  if (!error) return 'auth.errors.default';
  const code = error.trim();
  return isAuthErrorCode(code) ? `auth.errors.${code}` : 'auth.errors.default';
}

/** Seed hisoblari (prisma/seed-data/users.ts) — faqat NEXT_PUBLIC_SHOW_DEMO_CREDS=1 boʻlganda koʻrsatiladi */
const DEMO_ACCOUNTS = [
  { login: 'abdurahmon', password: '12345678', role: 'ADMIN' },
  { login: 'admin', password: 'Admin123!', role: 'ADMIN' },
  { login: 'doctor', password: 'Doctor123!', role: 'DOCTOR' },
  { login: 'reception', password: 'Reception123!', role: 'RECEPTION' },
  { login: 'cashier', password: 'Cashier123!', role: 'CASHIER' },
] as const;

const REMEMBER_KEY = 'lor:remember-login';

export interface LoginFormProps {
  /** Kirishdan soʻng yoʻnaltirish (sahifa `sanitizeCallbackUrl` bilan tekshiradi) */
  callbackUrl: string;
  /** Demo hisoblar blokini koʻrsatish */
  showDemo?: boolean;
}

export function LoginForm({ callbackUrl, showDemo = false }: LoginFormProps) {
  const t = useT();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [remembered, setRemembered, clearRemembered] = useLocalStorage<string>(REMEMBER_KEY, '');
  const [remember, setRemember] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { login: '', password: '' },
    mode: 'onTouched',
  });

  // Saqlangan login (localStorage) — montajdan keyin toʻldiriladi
  useEffect(() => {
    if (remembered) {
      setValue('login', remembered);
      setRemember(true);
    }
  }, [remembered, setValue]);

  const onSubmit = useCallback(
    async (values: LoginInput) => {
      setErrorKey(null);
      try {
        const res = await signIn('credentials', {
          login: values.login,
          password: values.password,
          redirect: false,
        });
        if (!res || res.error || !res.ok) {
          setErrorKey(loginErrorKey(res?.error));
          setValue('password', '');
          setFocus('password');
          return;
        }
        if (remember) setRemembered(values.login);
        else clearRemembered();
        router.push(callbackUrl);
        router.refresh();
      } catch {
        setErrorKey('auth.errors.network');
      }
    },
    [callbackUrl, clearRemembered, remember, router, setFocus, setRemembered, setValue],
  );

  const fillDemo = (login: string, password: string) => {
    setValue('login', login, { shouldValidate: true, shouldDirty: true });
    setValue('password', password, { shouldValidate: true, shouldDirty: true });
    setErrorKey(null);
    setFocus('password');
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text">{t('auth.login.title')}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{t('auth.login.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-busy={isSubmitting}>
        {errorKey ? (
          <Alert variant="danger">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{t(errorKey)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="login" required>
            {t('auth.login.login')}
          </Label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="login"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              placeholder={t('auth.login.loginPlaceholder')}
              className="h-11 pl-10"
              aria-invalid={errors.login ? true : undefined}
              aria-describedby={errors.login ? 'login-error' : undefined}
              autoFocus
              {...register('login')}
            />
          </div>
          {errors.login?.message ? (
            <p id="login-error" role="alert" className="text-xs text-danger">
              {t(errors.login.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              {t('auth.login.password')}
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-accent underline-offset-4 hover:underline focus-visible:underline"
            >
              {t('auth.login.forgot')}
            </Link>
          </div>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('auth.login.passwordPlaceholder')}
              className="h-11 pl-10 pr-11"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password?.message ? (
            <p id="password-error" role="alert" className="text-xs text-danger">
              {t(errors.password.message)}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
            aria-describedby="remember-label"
          />
          <Label
            htmlFor="remember"
            id="remember-label"
            className="cursor-pointer font-normal text-text-muted"
          >
            {t('auth.login.remember')}
          </Label>
        </div>

        <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>
          {!isSubmitting ? <LogIn aria-hidden="true" /> : null}
          {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>

      {showDemo ? (
        <section
          aria-labelledby="demo-title"
          className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4"
        >
          <h2 id="demo-title" className="flex items-center gap-2 font-sans text-sm font-semibold text-text">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            {t('auth.login.demoTitle')}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{t('auth.login.demoHint')}</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const roleLabel = t(`common.role.${acc.role}`);
              return (
                <li key={acc.login}>
                  <button
                    type="button"
                    onClick={() => fillDemo(acc.login, acc.password)}
                    aria-label={t('auth.login.fill', { role: roleLabel })}
                    className={cn(
                      'flex w-full flex-col items-start rounded-lg border border-line bg-bg-elevated px-3 py-2 text-left transition-colors',
                      'hover:border-primary/40 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <span className="text-xs font-semibold text-text">{roleLabel}</span>
                    <span className="mt-0.5 font-mono text-[11px] text-text-muted">
                      {acc.login} / {acc.password}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-text-muted">{t('auth.login.noAccount')}</p>
    </div>
  );
}

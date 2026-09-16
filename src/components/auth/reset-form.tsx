'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LinkIcon,
  LogIn,
  ShieldCheck,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/client';
import { api, ApiClientError } from '@/lib/api/client';
import { passwordStrength, ResetSchema, type ResetInput } from '@/lib/auth/schemas';
import { cn } from '@/lib/utils';

interface ResetResponse {
  done: boolean;
}

export interface ResetFormProps {
  /** `?token=` — boʻsh boʻlsa yaroqsiz havola holati koʻrsatiladi */
  token: string;
}

const STRENGTH_LABEL_KEYS = ['', 'weak', 'fair', 'good', 'strong'] as const;
const STRENGTH_COLORS = ['bg-line', 'bg-danger', 'bg-warning', 'bg-accent', 'bg-[#00FFB2]'] as const;

function InvalidTokenState() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/10 text-danger">
        <LinkIcon className="size-7" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text">
          {t('auth.reset.invalid')}
        </h1>
        <p className="text-sm leading-relaxed text-text-muted">{t('auth.reset.invalidHint')}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="gradient" size="lg" className="w-full sm:flex-1">
          <Link href="/forgot-password">{t('auth.reset.requestAgain')}</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full sm:flex-1">
          <Link href="/login">
            <ArrowLeft aria-hidden="true" />
            {t('auth.reset.backToLogin')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DoneState() {
  const t = useT();
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-[#00FFB2]/25 bg-[#00FFB2]/10 text-[#00FFB2]">
        <CheckCircle2 className="size-7" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text">{t('auth.reset.done')}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{t('auth.reset.doneHint')}</p>
      </div>
      <Button asChild variant="gradient" size="lg" className="w-full">
        <Link href="/login">
          <LogIn aria-hidden="true" />
          {t('auth.reset.backToLogin')}
        </Link>
      </Button>
    </div>
  );
}

export function ResetForm({ token }: ResetFormProps) {
  const t = useT();
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(!token);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    resolver: zodResolver(ResetSchema),
    defaultValues: { token, password: '', confirm: '' },
    mode: 'onTouched',
  });

  const password = watch('password');
  const strength = passwordStrength(password ?? '');
  const strengthKey = STRENGTH_LABEL_KEYS[strength];

  const onSubmit = async (values: ResetInput) => {
    setErrorKey(null);
    try {
      await api.post<ResetResponse>('/api/auth/reset', values);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'NOT_FOUND') {
          setInvalid(true);
          return;
        }
        setErrorKey(err.code === 'RATE_LIMITED' ? 'auth.errors.RATE_LIMITED' : 'auth.errors.default');
      } else {
        setErrorKey('auth.errors.network');
      }
    }
  };

  if (done) return <DoneState />;
  if (invalid) return <InvalidTokenState />;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text">{t('auth.reset.title')}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{t('auth.reset.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-busy={isSubmitting}>
        <input type="hidden" {...register('token')} />

        {errorKey ? (
          <Alert variant="danger">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{t(errorKey)}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="new-password" required>
            {t('auth.reset.password')}
          </Label>
          <div className="relative">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('auth.login.passwordPlaceholder')}
              className="h-11 pl-10 pr-11"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? 'new-password-error' : 'new-password-hint'}
              autoFocus
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

          {/* Parol kuchi indikatori */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-4 gap-1" role="presentation">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 rounded-full transition-colors duration-300',
                    i <= strength ? STRENGTH_COLORS[strength] : 'bg-line',
                  )}
                />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span id="new-password-hint" className="text-text-muted">
                {t('auth.reset.hint')}
              </span>
              {strengthKey ? (
                <span
                  className={cn(
                    'font-medium',
                    strength <= 1 && 'text-danger',
                    strength === 2 && 'text-warning',
                    strength === 3 && 'text-accent',
                    strength === 4 && 'text-[#00FFB2]',
                  )}
                >
                  {t(`auth.reset.strength.${strengthKey}`)}
                </span>
              ) : null}
            </div>
          </div>

          {errors.password?.message ? (
            <p id="new-password-error" role="alert" className="text-xs text-danger">
              {t(errors.password.message)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" required>
            {t('auth.reset.confirm')}
          </Label>
          <div className="relative">
            <ShieldCheck
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('auth.login.passwordPlaceholder')}
              className="h-11 pl-10 pr-11"
              aria-invalid={errors.confirm ? true : undefined}
              aria-describedby={errors.confirm ? 'confirm-password-error' : undefined}
              {...register('confirm')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
              aria-pressed={showConfirm}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showConfirm ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.confirm?.message ? (
            <p id="confirm-password-error" role="alert" className="text-xs text-danger">
              {t(errors.confirm.message)}
            </p>
          ) : null}
        </div>

        {errors.token?.message ? (
          <p role="alert" className="text-xs text-danger">
            {t(errors.token.message)}
          </p>
        ) : null}

        <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>
          {!isSubmitting ? <ShieldCheck aria-hidden="true" /> : null}
          {t('auth.reset.submit')}
        </Button>
      </form>

      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('auth.reset.backToLogin')}
      </Link>
    </div>
  );
}

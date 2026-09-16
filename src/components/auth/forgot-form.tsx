'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ArrowLeft, AtSign, MailCheck, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/client';
import { api, ApiClientError } from '@/lib/api/client';
import { ForgotSchema, type ForgotInput } from '@/lib/auth/schemas';

interface ForgotResponse {
  sent: boolean;
}

export function ForgotForm() {
  const t = useT();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ForgotInput>({
    resolver: zodResolver(ForgotSchema),
    defaultValues: { login: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: ForgotInput) => {
    setErrorKey(null);
    try {
      await api.post<ForgotResponse>('/api/auth/forgot', { login: values.login });
      setSentTo(values.login);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorKey(err.code === 'RATE_LIMITED' ? 'auth.errors.RATE_LIMITED' : 'auth.errors.default');
      } else {
        setErrorKey('auth.errors.network');
      }
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-[#00FFB2]/25 bg-[#00FFB2]/10 text-[#00FFB2]">
          <MailCheck className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-text">
            {t('auth.forgot.sent')}
          </h1>
          <p className="text-sm leading-relaxed text-text-muted">{t('auth.forgot.sentHint')}</p>
          <p className="text-sm text-text">
            <span className="font-mono text-accent">{sentTo}</span>
          </p>
          <p className="text-xs leading-relaxed text-text-muted">{t('auth.forgot.noEmailHint')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg" className="w-full sm:flex-1">
            <Link href="/login">
              <ArrowLeft aria-hidden="true" />
              {t('auth.forgot.back')}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:flex-1"
            onClick={() => {
              setSentTo(null);
              reset({ login: '' });
            }}
          >
            {t('auth.forgot.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-text">{t('auth.forgot.title')}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{t('auth.forgot.subtitle')}</p>
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
          <Label htmlFor="forgot-login" required>
            {t('auth.forgot.login')}
          </Label>
          <div className="relative">
            <AtSign
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              id="forgot-login"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              placeholder={t('auth.forgot.loginPlaceholder')}
              className="h-11 pl-10"
              aria-invalid={errors.login ? true : undefined}
              aria-describedby={errors.login ? 'forgot-login-error' : undefined}
              autoFocus
              {...register('login')}
            />
          </div>
          {errors.login?.message ? (
            <p id="forgot-login-error" role="alert" className="text-xs text-danger">
              {t(errors.login.message)}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="gradient" size="lg" className="w-full" loading={isSubmitting}>
          {!isSubmitting ? <Send aria-hidden="true" /> : null}
          {t('auth.forgot.submit')}
        </Button>
      </form>

      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('auth.forgot.back')}
      </Link>
    </div>
  );
}

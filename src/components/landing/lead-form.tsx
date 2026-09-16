'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, RotateCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { api, ApiClientError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LeadSchema, type LeadFormValues } from './lead-schema';

interface LeadResponse {
  received: boolean;
  forwarded: boolean;
}

const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  angle: (360 / 14) * i,
  distance: 44 + (i % 3) * 14,
  delay: (i % 5) * 60,
  size: 4 + (i % 3) * 2,
  color: ['#00D4FF', '#7C5CFF', '#00FFB2', '#FFB547'][i % 4] ?? '#00D4FF',
}));

/** Soʻrov formasi: RHF + zod (LeadSchema), POST /api/public/lead, muvaffaqiyatda uchqunli holat */
export function LeadForm({ source = 'landing' }: { source?: string }) {
  const { t, locale } = useLocale();
  const uid = React.useId();
  const [sentPhone, setSentPhone] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(LeadSchema),
    defaultValues: { name: '', phone: '', clinic: '', message: '', website: '' },
    mode: 'onTouched',
  });

  const fieldError = (field: keyof LeadFormValues): string | null => {
    const msg = errors[field]?.message;
    if (!msg) return null;
    // zPhone xabari kalit emas — telefon uchun doim landing kaliti
    if (field === 'phone') return t('landing.cta.form.errors.phone');
    return t(msg);
  };

  const onSubmit = async (values: LeadFormValues) => {
    setServerError(null);
    try {
      await api.post<LeadResponse>('/api/public/lead', { ...values, locale, source });
      setSentPhone(values.phone);
      toast.success(t('landing.cta.form.successTitle'));
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.code === 'RATE_LIMITED'
          ? t('landing.cta.form.rateLimited')
          : t('landing.cta.form.error');
      setServerError(msg);
      toast.error(msg);
    }
  };

  if (sentPhone) {
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center" role="status" aria-live="polite">
        <div className="relative">
          {SPARKLES.map((s, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2"
              style={{ transform: `rotate(${s.angle}deg) translateY(-${s.distance}px)` }}
            >
              <span
                className="block rounded-full motion-safe:duration-700 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:slide-in-from-bottom-8 motion-safe:fill-mode-both"
                style={{
                  width: s.size,
                  height: s.size,
                  backgroundColor: s.color,
                  animationDelay: `${s.delay}ms`,
                  boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
                }}
              />
            </span>
          ))}
          <span className="relative inline-flex size-16 items-center justify-center rounded-full border border-[#00FFB2]/30 bg-[#00FFB2]/10 text-[#00FFB2] shadow-glow-mint motion-safe:duration-500 motion-safe:animate-in motion-safe:zoom-in-75">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </span>
        </div>
        <div>
          <h3 className="font-heading text-2xl font-bold text-text">{t('landing.cta.form.successTitle')}</h3>
          <p className="mt-2 text-sm text-text-muted">
            {t('landing.cta.form.successDesc', { phone: formatPhone(sentPhone) || sentPhone })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSentPhone(null);
            reset();
          }}
        >
          <RotateCcw aria-hidden="true" />
          {t('landing.cta.form.again')}
        </Button>
      </div>
    );
  }

  const field = (
    name: keyof LeadFormValues,
    label: string,
    placeholder: string,
    opts: { required?: boolean; type?: string; autoComplete?: string; inputMode?: 'tel' | 'text' } = {},
  ) => {
    const id = `${uid}-${name}`;
    const err = fieldError(name);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} required={opts.required}>
          {label}
        </Label>
        <Input
          id={id}
          type={opts.type ?? 'text'}
          placeholder={placeholder}
          autoComplete={opts.autoComplete}
          inputMode={opts.inputMode}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-err` : undefined}
          className="h-11"
          {...register(name)}
        />
        {err ? (
          <p id={`${id}-err`} className="flex items-center gap-1 text-xs text-danger" role="alert">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {err}
          </p>
        ) : null}
      </div>
    );
  };

  const messageId = `${uid}-message`;
  const messageErr = fieldError('message');
  // "{privacy}" oʻrniga havola: shablonni ikkiga boʻlamiz
  const [privacyBefore = '', privacyAfter = ''] = t('landing.cta.form.privacy').split('{privacy}');

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4"
      aria-label={t('landing.cta.form.title')}
    >
      <h3 className="font-heading text-xl font-bold text-text">{t('landing.cta.form.title')}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', t('landing.cta.form.name'), t('landing.cta.form.namePlaceholder'), {
          required: true,
          autoComplete: 'name',
        })}
        {field('phone', t('landing.cta.form.phone'), t('landing.cta.form.phonePlaceholder'), {
          required: true,
          type: 'tel',
          autoComplete: 'tel',
          inputMode: 'tel',
        })}
      </div>
      {field('clinic', t('landing.cta.form.clinic'), t('landing.cta.form.clinicPlaceholder'), {
        required: true,
        autoComplete: 'organization',
      })}
      <div className="space-y-1.5">
        <Label htmlFor={messageId}>{t('landing.cta.form.message')}</Label>
        <Textarea
          id={messageId}
          rows={3}
          placeholder={t('landing.cta.form.messagePlaceholder')}
          aria-invalid={messageErr ? true : undefined}
          aria-describedby={messageErr ? `${messageId}-err` : undefined}
          {...register('message')}
        />
        {messageErr ? (
          <p id={`${messageId}-err`} className="flex items-center gap-1 text-xs text-danger" role="alert">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {messageErr}
          </p>
        ) : null}
      </div>

      {/* Honeypot — odamlar koʻrmaydi, botlar toʻldiradi */}
      <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      {serverError ? (
        <p
          className={cn(
            'flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-danger',
          )}
          role="alert"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="gradient"
        size="lg"
        className="w-full"
        loading={isSubmitting}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          t('landing.cta.form.sending')
        ) : (
          <>
            <Send aria-hidden="true" />
            {t('landing.cta.form.submit')}
          </>
        )}
      </Button>
      <p className="text-center text-xs text-text-muted">
        {privacyBefore}
        <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
          {t('landing.cta.form.privacyLink')}
        </Link>
        {privacyAfter}
      </p>
    </form>
  );
}

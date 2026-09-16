'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound, Save, UserRoundPen } from 'lucide-react';
import { ApiClientError } from '@/lib/api/client';
import { formatPhone } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { ProfileFormSchema, type ProfileFormValues } from '@/lib/dashboard/schemas';
import type { UpdateMeInput } from '@/lib/dashboard/schemas';
import type { MeUserDTO } from '@/lib/dashboard/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateMe } from '../queries';
import { DashboardCard } from '../home/dashboard-card';

export interface ProfileFormProps {
  me: MeUserDTO;
}

type PasswordField = 'currentPassword' | 'newPassword' | 'confirmPassword';

function toFormValues(me: MeUserDTO): ProfileFormValues {
  return {
    fullName: me.fullName,
    phone: me.phone ? formatPhone(me.phone) : '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };
}

/** Serverdan kelgan VALIDATION xatosidagi `password.current` maydoni (joriy parol notoʻgʻri) */
function wrongCurrentPassword(err: unknown): boolean {
  if (!(err instanceof ApiClientError) || err.code !== 'VALIDATION') return false;
  const d = err.details;
  if (!d || typeof d !== 'object' || !('fieldErrors' in d)) return false;
  const fe = (d as { fieldErrors?: unknown }).fieldErrors;
  return !!fe && typeof fe === 'object' && 'password.current' in fe;
}

/** Profil formasi: F.I.Sh., telefon va (ixtiyoriy) parolni almashtirish — PATCH /api/me */
export function ProfileForm({ me }: ProfileFormProps) {
  const t = useT();
  const router = useRouter();
  const { update: updateSession } = useSession();
  const mutation = useUpdateMe();
  const [shown, setShown] = React.useState<Record<PasswordField, boolean>>({ currentPassword: false, newPassword: false, confirmPassword: false });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: toFormValues(me),
    values: toFormValues(me),
    resetOptions: { keepDirtyValues: true },
    mode: 'onBlur',
  });
  const { register, handleSubmit, formState, setError, resetField, watch } = form;
  const { errors, isDirty, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (v) => {
    const wantsPassword = v.newPassword !== '';
    const input: UpdateMeInput = {
      fullName: v.fullName.trim(),
      phone: v.phone.trim(),
      ...(wantsPassword ? { password: { current: v.currentPassword, next: v.newPassword } } : {}),
    };
    const changed = input.fullName !== me.fullName || (input.phone === '' ? me.phone !== null : formatPhone(me.phone) !== formatPhone(input.phone ?? '')) || wantsPassword;
    if (!changed) {
      toast.info(t('dashboard.profile.nothingChanged'));
      return;
    }
    try {
      const result = await mutation.mutateAsync(input);
      toast.success(result.passwordChanged ? t('dashboard.profile.passwordChanged') : t('dashboard.profile.saved'));
      (['currentPassword', 'newPassword', 'confirmPassword'] as const).forEach((f) => resetField(f, { defaultValue: '' }));
      if (result.user.fullName !== me.fullName) {
        await updateSession();
        router.refresh();
      }
    } catch (err) {
      if (wrongCurrentPassword(err)) {
        setError('currentPassword', { type: 'server', message: 'dashboard.profile.wrongPassword' });
        return;
      }
      toast.error(err instanceof Error ? err.message : t('common.error'));
    }
  });

  const toggle = (f: PasswordField) => setShown((s) => ({ ...s, [f]: !s[f] }));
  const busy = isSubmitting || mutation.isPending;
  const [watchedNew, watchedCurrent] = watch(['newPassword', 'currentPassword']);
  const passwordStarted = watchedNew !== '' || watchedCurrent !== '';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <DashboardCard
        title={
          <span className="inline-flex items-center gap-2">
            <UserRoundPen className="size-4 text-accent" aria-hidden="true" />
            {t('dashboard.profile.personal')}
          </span>
        }
        description={t('dashboard.profile.personalHint')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-fullName" required>
              {t('dashboard.profile.fullName')}
            </Label>
            <Input
              id="profile-fullName"
              autoComplete="name"
              maxLength={120}
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? 'profile-fullName-error' : undefined}
              {...register('fullName')}
            />
            {errors.fullName?.message ? (
              <p id="profile-fullName-error" role="alert" className="text-xs text-danger">
                {t(errors.fullName.message)}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">{t('dashboard.profile.phone')}</Label>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t('dashboard.profile.phonePlaceholder')}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'profile-phone-error' : undefined}
              {...register('phone')}
            />
            {errors.phone?.message ? (
              <p id="profile-phone-error" role="alert" className="text-xs text-danger">
                {t(errors.phone.message)}
              </p>
            ) : null}
          </div>
        </div>
      </DashboardCard>

      <DashboardCard
        title={
          <span className="inline-flex items-center gap-2">
            <KeyRound className="size-4 text-accent" aria-hidden="true" />
            {t('dashboard.profile.security')}
          </span>
        }
        description={t('dashboard.profile.securityHint')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordInput
            id="profile-currentPassword"
            label={t('dashboard.profile.currentPassword')}
            autoComplete="current-password"
            shown={shown.currentPassword}
            onToggle={() => toggle('currentPassword')}
            error={errors.currentPassword?.message}
            required={passwordStarted}
            showLabel={t('dashboard.profile.showPassword')}
            hideLabel={t('dashboard.profile.hidePassword')}
            t={t}
            registration={register('currentPassword')}
          />
          <div className="hidden sm:block" aria-hidden="true" />
          <PasswordInput
            id="profile-newPassword"
            label={t('dashboard.profile.newPassword')}
            autoComplete="new-password"
            shown={shown.newPassword}
            onToggle={() => toggle('newPassword')}
            error={errors.newPassword?.message}
            hint={t('dashboard.profile.passwordHint')}
            showLabel={t('dashboard.profile.showPassword')}
            hideLabel={t('dashboard.profile.hidePassword')}
            t={t}
            registration={register('newPassword')}
          />
          <PasswordInput
            id="profile-confirmPassword"
            label={t('dashboard.profile.confirmPassword')}
            autoComplete="new-password"
            shown={shown.confirmPassword}
            onToggle={() => toggle('confirmPassword')}
            error={errors.confirmPassword?.message}
            showLabel={t('dashboard.profile.showPassword')}
            hideLabel={t('dashboard.profile.hidePassword')}
            t={t}
            registration={register('confirmPassword')}
          />
        </div>
      </DashboardCard>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isDirty ? <span className="mr-auto text-xs text-text-muted">{t('common.unsaved')}</span> : null}
        <Button type="submit" variant="gradient" loading={busy} disabled={!isDirty}>
          <Save aria-hidden="true" />
          {t('dashboard.profile.save')}
        </Button>
      </div>
    </form>
  );
}

interface PasswordInputProps {
  id: string;
  label: string;
  autoComplete: string;
  shown: boolean;
  onToggle: () => void;
  error?: string;
  hint?: string;
  required?: boolean;
  showLabel: string;
  hideLabel: string;
  t: (key: string) => string;
  registration: UseFormRegisterReturn;
}

function PasswordInput({ id, label, autoComplete, shown, onToggle, error, hint, required, showLabel, hideLabel, t, registration }: PasswordInputProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <div className="relative">
        <Input id={id} type={shown ? 'text' : 'password'} autoComplete={autoComplete} maxLength={128} className="pr-10" aria-invalid={!!error} aria-describedby={describedBy} {...registration} />
        <button
          type="button"
          onClick={onToggle}
          aria-label={shown ? hideLabel : showLabel}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

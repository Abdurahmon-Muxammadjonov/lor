'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useT } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { passwordStrength } from '@/lib/auth/schemas';
import { cn } from '@/lib/utils';
import { PasswordFormSchema, type PasswordFormInput } from '@/lib/staff/schemas';
import type { StaffUserDTO } from '@/lib/staff/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetStaffPassword } from './use-staff';

export interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUserDTO | null;
}

const STRENGTH_COLOR = ['bg-secondary', 'bg-danger', 'bg-warning', 'bg-accent', 'bg-[#00FFB2]'] as const;

/** Xodim paroli oynasi: yangi parol + tasdiqlash, kuch indikatori */
export function PasswordDialog({ open, onOpenChange, user }: PasswordDialogProps) {
  const t = useT();
  const [show, setShow] = React.useState(false);
  const mutation = useSetStaffPassword();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormInput>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { password: '', confirm: '' },
    mode: 'onTouched',
  });

  React.useEffect(() => {
    if (open) {
      reset({ password: '', confirm: '' });
      setShow(false);
    }
  }, [open, reset]);

  const busy = isSubmitting || mutation.isPending;
  const strength = passwordStrength(watch('password') ?? '');

  const onSubmit = async (values: PasswordFormInput) => {
    if (!user) return;
    try {
      await mutation.mutateAsync({ id: user.id, body: { password: values.password } });
      toast.success(t('staff.toasts.passwordChanged'));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? t(err.message) : t('common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent className="max-w-md" hideClose={busy}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5" aria-busy={busy}>
          <DialogHeader className="items-center gap-2 sm:flex-row sm:items-start sm:gap-4">
            <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-accent">
              <KeyRound className="size-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{t('staff.password.title')}</DialogTitle>
              <DialogDescription>{t('staff.password.description', { name: user?.fullName ?? '' })}</DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw-new" required>
                {t('staff.password.new')}
              </Label>
              <div className="relative">
                <Input
                  id="pw-new"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-10"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby="pw-strength"
                  disabled={busy}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? t('staff.form.hidePassword') : t('staff.form.showPassword')}
                  aria-pressed={show}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
              <div id="pw-strength" className="flex items-center gap-2" aria-live="polite">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= strength ? STRENGTH_COLOR[strength] : 'bg-secondary')} />
                  ))}
                </div>
                <span className="text-xs text-text-muted">{t(`staff.password.strength.${strength}`)}</span>
              </div>
              {errors.password?.message ? (
                <p role="alert" className="text-xs text-danger">
                  {t(errors.password.message)}
                </p>
              ) : (
                <p className="text-xs text-text-muted">{t('staff.form.passwordHint')}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm" required>
                {t('staff.password.confirm')}
              </Label>
              <Input
                id="pw-confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={errors.confirm ? true : undefined}
                disabled={busy}
                {...register('confirm')}
              />
              {errors.confirm?.message ? (
                <p role="alert" className="text-xs text-danger">
                  {t(errors.confirm.message)}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {t('staff.password.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

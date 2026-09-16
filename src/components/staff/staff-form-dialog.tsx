'use client';

import * as React from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, Percent, Wand2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { groupDigits, parseMoneyInput } from '@/lib/money';
import { cn } from '@/lib/utils';
import { STAFF_COLORS, UserCreateSchema, UserUpdateSchema, type UserCreateInput } from '@/lib/staff/schemas';
import { defaultScheduleForm, scheduleToForm } from '@/lib/staff/schedule';
import { CLINIC_ROLE_VALUES, type ClinicRole, type StaffUserDTO } from '@/lib/staff/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorPicker } from './color-picker';
import { ScheduleEditor } from './schedule-editor';
import { useCreateStaff, useUpdateStaff } from './use-staff';

export type StaffFormValues = UserCreateInput;

export interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Berilsa — tahrirlash, aks holda — yaratish */
  user?: StaffUserDTO | null;
  /** Yaratishda standart rol */
  defaultRole?: ClinicRole;
  onSaved?: (user: StaffUserDTO) => void;
}

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[(bytes[i] ?? 0) % PASSWORD_ALPHABET.length];
  // Kamida bitta harf va bitta raqam kafolati
  if (!/\d/.test(out)) out = out.slice(0, -1) + '7';
  if (!/[A-Za-z]/.test(out)) out = 'k' + out.slice(1);
  return out;
}

function emptyValues(role: ClinicRole): StaffFormValues {
  return {
    fullName: '',
    login: '',
    password: '',
    role,
    phone: '',
    email: '',
    specialty: '',
    room: '',
    color: STAFF_COLORS[0],
    salaryType: role === 'DOCTOR' ? 'PERCENT' : 'FIXED',
    salaryValue: role === 'DOCTOR' ? 30 : 0,
    schedule: defaultScheduleForm(),
  };
}

function valuesFromUser(u: StaffUserDTO): StaffFormValues {
  return {
    fullName: u.fullName,
    login: u.login,
    password: '',
    role: u.role,
    phone: u.phone ?? '',
    email: u.email ?? '',
    specialty: u.specialty ?? '',
    room: u.room ?? '',
    color: u.color,
    salaryType: u.salaryType,
    salaryValue: u.salaryValue,
    schedule: scheduleToForm(u.schedule),
  };
}

const I18N_KEY_RE = /^[a-z]+(\.[A-Za-z0-9_]+)+$/;

/** Zod xabari i18n kaliti boʻlsa tarjima qilinadi, aks holda (kernel zMoney matni) `fallback` kaliti */
function FieldError({ message, fallback = 'common.validation.invalid' }: { message?: string; fallback?: string }) {
  const t = useT();
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-danger">
      {t(I18N_KEY_RE.test(message) ? message : fallback)}
    </p>
  );
}

/**
 * Xodim yaratish / tahrirlash oynasi — RHF + zod (bir sxema client va serverda).
 */
export function StaffFormDialog({ open, onOpenChange, user, defaultRole = 'DOCTOR', onSaved }: StaffFormDialogProps) {
  const t = useT();
  const isEdit = Boolean(user);
  const [showPassword, setShowPassword] = React.useState(false);
  const create = useCreateStaff();
  const update = useUpdateStaff();

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(isEdit ? UserUpdateSchema : UserCreateSchema),
    defaultValues: user ? valuesFromUser(user) : emptyValues(defaultRole),
    mode: 'onTouched',
  });
  const { register, control, handleSubmit, reset, setError, setFocus, watch, formState } = form;
  const { errors, isSubmitting } = formState;

  // Oyna ochilganda qiymatlarni yangilash (tahrirlash/yaratish almashishi)
  React.useEffect(() => {
    if (open) {
      reset(user ? valuesFromUser(user) : emptyValues(defaultRole));
      setShowPassword(false);
    }
  }, [open, user, defaultRole, reset]);

  const salaryType = watch('salaryType');
  const busy = isSubmitting || create.isPending || update.isPending;

  const onSubmit = async (raw: StaffFormValues) => {
    try {
      let saved: StaffUserDTO;
      if (isEdit && user) {
        const body = UserUpdateSchema.parse(raw);
        saved = await update.mutateAsync({ id: user.id, body });
        toast.success(t('staff.toasts.updated'));
      } else {
        const body = UserCreateSchema.parse(raw);
        saved = await create.mutateAsync(body);
        toast.success(t('staff.toasts.created'));
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.message === 'staff.errors.loginTaken') {
          setError('login', { type: 'server', message: err.message });
          setFocus('login');
          return;
        }
        if (err.message === 'staff.errors.emailTaken') {
          setError('email', { type: 'server', message: err.message });
          setFocus('email');
          return;
        }
        toast.error(t(err.message));
        return;
      }
      toast.error(t('common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent className="max-w-2xl p-0" hideClose={busy}>
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-h-[calc(100dvh-2rem)] flex-col" aria-busy={busy}>
            <DialogHeader className="border-b border-line px-6 pb-4 pt-6">
              <DialogTitle>{isEdit ? t('staff.form.editTitle') : t('staff.form.createTitle')}</DialogTitle>
              <DialogDescription>{isEdit ? t('staff.form.editDescription') : t('staff.form.createDescription')}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 scrollbar-thin">
              {/* ── Asosiy ── */}
              <section className="space-y-4" aria-labelledby="staff-sec-main">
                <h3 id="staff-sec-main" className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('staff.form.sectionMain')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="staff-fullName" required>
                      {t('staff.form.fullName')}
                    </Label>
                    <Input
                      id="staff-fullName"
                      autoComplete="off"
                      placeholder={t('staff.form.fullNamePlaceholder')}
                      aria-invalid={errors.fullName ? true : undefined}
                      disabled={busy}
                      {...register('fullName')}
                    />
                    <FieldError message={errors.fullName?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="staff-role" required>
                      {t('staff.form.role')}
                    </Label>
                    <Controller
                      control={control}
                      name="role"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={busy}>
                          <SelectTrigger id="staff-role" aria-invalid={errors.role ? true : undefined}>
                            <SelectValue placeholder={t('staff.form.rolePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {CLINIC_ROLE_VALUES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {t(`common.role.${r}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={errors.role?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="staff-specialty">{t('staff.form.specialty')}</Label>
                    <Input
                      id="staff-specialty"
                      placeholder={t('staff.form.specialtyPlaceholder')}
                      aria-invalid={errors.specialty ? true : undefined}
                      disabled={busy}
                      {...register('specialty')}
                    />
                    <FieldError message={errors.specialty?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="staff-room">{t('staff.form.room')}</Label>
                    <Input
                      id="staff-room"
                      placeholder={t('staff.form.roomPlaceholder')}
                      aria-invalid={errors.room ? true : undefined}
                      disabled={busy}
                      {...register('room')}
                    />
                    <FieldError message={errors.room?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="staff-phone">{t('staff.form.phone')}</Label>
                    <Input
                      id="staff-phone"
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder={t('staff.form.phonePlaceholder')}
                      aria-invalid={errors.phone ? true : undefined}
                      disabled={busy}
                      {...register('phone')}
                    />
                    <FieldError message={errors.phone?.message ? 'common.validation.phone' : undefined} />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="staff-color">{t('staff.form.color')}</Label>
                    <Controller
                      control={control}
                      name="color"
                      render={({ field }) => <ColorPicker id="staff-color" value={field.value} onChange={field.onChange} disabled={busy} />}
                    />
                    <FieldError message={errors.color?.message} />
                  </div>
                </div>
              </section>

              {/* ── Kirish ── */}
              <section className="space-y-4" aria-labelledby="staff-sec-access">
                <h3 id="staff-sec-access" className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('staff.form.sectionAccess')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-login" required>
                      {t('staff.form.login')}
                    </Label>
                    <Input
                      id="staff-login"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={errors.login ? true : undefined}
                      aria-describedby="staff-login-hint"
                      disabled={busy}
                      {...register('login')}
                    />
                    {errors.login?.message ? (
                      <FieldError message={errors.login.message} />
                    ) : (
                      <p id="staff-login-hint" className="text-xs text-text-muted">
                        {t('staff.form.loginHint')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="staff-email">{t('staff.form.email')}</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      placeholder={t('staff.form.emailPlaceholder')}
                      aria-invalid={errors.email ? true : undefined}
                      disabled={busy}
                      {...register('email')}
                    />
                    <FieldError message={errors.email?.message ? (errors.email.message.startsWith('staff.') ? errors.email.message : 'common.validation.email') : undefined} />
                  </div>

                  {isEdit ? null : (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="staff-password" required>
                        {t('staff.form.password')}
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="staff-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            className="pr-10"
                            aria-invalid={errors.password ? true : undefined}
                            aria-describedby="staff-password-hint"
                            disabled={busy}
                            {...register('password')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? t('staff.form.hidePassword') : t('staff.form.showPassword')}
                            aria-pressed={showPassword}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            form.setValue('password', generatePassword(), { shouldDirty: true, shouldValidate: true });
                            setShowPassword(true);
                          }}
                        >
                          <Wand2 aria-hidden="true" />
                          <span className="hidden sm:inline">{t('staff.form.generatePassword')}</span>
                        </Button>
                      </div>
                      {errors.password?.message ? (
                        <FieldError message={errors.password.message} />
                      ) : (
                        <p id="staff-password-hint" className="text-xs text-text-muted">
                          {t('staff.form.passwordHint')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Ish haqi ── */}
              <section className="space-y-4" aria-labelledby="staff-sec-salary">
                <h3 id="staff-sec-salary" className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('staff.form.sectionSalary')}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-salaryType">{t('staff.form.salaryType')}</Label>
                    <Controller
                      control={control}
                      name="salaryType"
                      render={({ field }) => (
                        <Segmented
                          value={field.value}
                          onChange={field.onChange}
                          ariaLabel={t('staff.form.salaryType')}
                          variant="accent"
                          fullWidth
                          disabled={busy}
                          options={[
                            { value: 'PERCENT', label: t('staff.form.percent'), icon: <Percent aria-hidden="true" /> },
                            { value: 'FIXED', label: t('staff.form.fixed') },
                          ]}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="staff-salaryValue" required>
                      {salaryType === 'PERCENT' ? t('staff.form.percentValue') : t('staff.form.fixedValue')}
                    </Label>
                    <Controller
                      control={control}
                      name="salaryValue"
                      render={({ field }) => {
                        const raw = field.value === undefined || field.value === null ? '' : String(field.value);
                        const display = salaryType === 'PERCENT' ? raw : groupDigits(raw);
                        return (
                          <div className="relative">
                            <Input
                              id="staff-salaryValue"
                              inputMode="numeric"
                              dir="ltr"
                              className={cn('pr-14 tabular', salaryType === 'PERCENT' ? 'pr-10' : 'pr-14')}
                              value={display}
                              onBlur={field.onBlur}
                              onChange={(e) => {
                                const digits = parseMoneyInput(e.target.value);
                                field.onChange(digits === '' ? '' : Number(digits));
                              }}
                              aria-invalid={errors.salaryValue ? true : undefined}
                              disabled={busy}
                            />
                            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                              {salaryType === 'PERCENT' ? t('staff.form.percentSuffix') : t('common.currency')}
                            </span>
                          </div>
                        );
                      }}
                    />
                    {errors.salaryValue?.message ? (
                      <FieldError message={errors.salaryValue.message} fallback="common.validation.number" />
                    ) : (
                      <p className="text-xs text-text-muted">
                        {salaryType === 'PERCENT' ? t('staff.form.salaryHintPercent') : t('staff.form.salaryHintFixed')}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Jadval ── */}
              <section className="space-y-3" aria-labelledby="staff-sec-schedule">
                <h3 id="staff-sec-schedule" className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t('staff.form.sectionSchedule')}
                </h3>
                <ScheduleEditor disabled={busy} />
              </section>
            </div>

            <DialogFooter className="border-t border-line px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="gradient" loading={busy}>
                {isEdit ? t('staff.form.save') : t('staff.form.create')}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

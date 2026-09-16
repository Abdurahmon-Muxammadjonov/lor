'use client';

import * as React from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiClientError } from '@/lib/api/client';
import {
  DURATION_MAX,
  DURATION_MIN,
  ORGANS,
  SERVICE_UNITS,
  ServiceSchema,
  type ServiceInput,
  type ServiceUnit,
} from '@/lib/services/schemas';
import type { CategoryDTO, ServiceDTO } from '@/lib/services/types';
import { CategoryIcon } from './category-icon';
import { MoneyInput } from './money-input';
import { serviceErrorMessage, useCreateService, usePatchService } from './use-services';

export interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryDTO[];
  /** Tahrirlash uchun; berilmasa — yangi xizmat */
  service?: ServiceDTO | null;
  /** Yangi xizmat uchun boshlangʻich kategoriya */
  defaultCategoryId?: string | null;
}

const NO_ORGAN = '__none__';

function defaultsFor(service: ServiceDTO | null | undefined, categoryId: string | null | undefined): ServiceInput {
  if (service) {
    return {
      categoryId: service.categoryId,
      code: service.code,
      name: service.name,
      nameRu: service.nameRu,
      unit: (SERVICE_UNITS as readonly string[]).includes(service.unit) ? (service.unit as ServiceUnit) : 'ta',
      priceAdultNoMed: service.priceAdultNoMed,
      priceAdultMed: service.priceAdultMed,
      priceChildNoMed: service.priceChildNoMed,
      priceChildMed: service.priceChildMed,
      allowHalf: service.allowHalf,
      medicineOptional: service.medicineOptional,
      durationMin: service.durationMin,
      defaultOrgan: service.defaultOrgan ?? null,
      isActive: service.isActive,
    };
  }
  return {
    categoryId: categoryId ?? '',
    code: '',
    name: '',
    nameRu: '',
    unit: 'ta',
    priceAdultNoMed: 0,
    priceAdultMed: 0,
    priceChildNoMed: 0,
    priceChildMed: 0,
    allowHalf: true,
    medicineOptional: true,
    durationMin: 20,
    defaultOrgan: null,
    isActive: true,
  };
}

/** Yangi xizmat / tahrirlash oynasi (RHF + zod, bir xil sxema server bilan) */
export function ServiceDialog({ open, onOpenChange, categories, service, defaultCategoryId }: ServiceDialogProps) {
  const { t, locale } = useLocale();
  const create = useCreateService();
  const patch = usePatchService();
  const isEdit = Boolean(service);

  const form = useForm<ServiceInput>({
    resolver: zodResolver(ServiceSchema),
    defaultValues: defaultsFor(service, defaultCategoryId),
    mode: 'onBlur',
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  React.useEffect(() => {
    if (open) reset(defaultsFor(service, defaultCategoryId));
  }, [open, service, defaultCategoryId, reset]);

  const err = (key: keyof ServiceInput) => {
    const m = errors[key]?.message;
    if (!m) return null;
    const raw = String(m);
    const translated = t(raw);
    // Kalit topilmagan (zod standart matni) → umumiy xabar
    return translated === raw && /\s/.test(raw) ? t('common.validation.invalid') : translated;
  };

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = ServiceSchema.safeParse(raw);
    if (!parsed.success) return;
    const values = parsed.data;
    try {
      if (service) {
        const row = await patch.mutateAsync({ id: service.id, patch: values });
        toast.success(t('services.dialog.updated', { code: row.code }));
      } else {
        const row = await create.mutateAsync(values);
        toast.success(t('services.dialog.created', { code: row.code }));
      }
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLICT') {
        setError('code', { type: 'server', message: 'services.errors.codeExists' });
        return;
      }
      if (e instanceof ApiClientError && e.code === 'VALIDATION') {
        const fe =
          e.details && typeof e.details === 'object' && 'fieldErrors' in e.details
            ? (e.details as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors
            : undefined;
        if (fe) {
          for (const [k, msgs] of Object.entries(fe)) {
            const first = msgs?.[0];
            if (first && k in raw) setError(k as keyof ServiceInput, { type: 'server', message: first });
          }
          return;
        }
      }
      toast.error(serviceErrorMessage(e, t));
    }
  });

  const unitOptions = SERVICE_UNITS.map((u) => ({ value: u, label: t(`services.units.${u}`) }));

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('services.dialog.editTitle') : t('services.dialog.createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('services.dialog.editDescription') : t('services.dialog.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {/* Asosiy */}
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem_9rem]">
            <div className="space-y-1.5">
              <Label htmlFor="svc-category" required>
                {t('services.fields.category')}
              </Label>
              <Controller
                control={control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="svc-category" aria-invalid={Boolean(errors.categoryId) || undefined}>
                      <SelectValue placeholder={t('common.select')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="inline-flex items-center gap-2">
                            <CategoryIcon name={c.icon} className="text-text-muted" />
                            {locale === 'ru' ? c.nameRu : c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError>{err('categoryId')}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-code" required>
                {t('services.fields.code')}
              </Label>
              <Input
                id="svc-code"
                placeholder="N-001"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={7}
                className="font-mono uppercase"
                aria-invalid={Boolean(errors.code) || undefined}
                aria-describedby="svc-code-hint"
                {...register('code')}
              />
              <FieldError>{err('code')}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-unit" required>
                {t('services.fields.unit')}
              </Label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value ?? 'ta'} onValueChange={field.onChange}>
                    <SelectTrigger id="svc-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <p id="svc-code-hint" className="-mt-3 text-xs text-text-muted">
            {t('services.fields.codeHint')}
          </p>

          {/* Nomlar */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name" required>
                {t('services.fields.name')}
              </Label>
              <Input id="svc-name" aria-invalid={Boolean(errors.name) || undefined} {...register('name')} />
              <FieldError>{err('name')}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-nameRu" required>
                {t('services.fields.nameRu')}
              </Label>
              <Input id="svc-nameRu" aria-invalid={Boolean(errors.nameRu) || undefined} {...register('nameRu')} />
              <FieldError>{err('nameRu')}</FieldError>
            </div>
          </div>

          {/* Narxlar 2×2 */}
          <fieldset className="rounded-xl border border-line bg-popover/60 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('services.dialog.pricesSection')}
            </legend>
            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
              <span aria-hidden="true" />
              <span className="text-xs font-semibold text-text-muted">{t('services.prices.noMed')}</span>
              <span className="text-xs font-semibold text-text-muted">{t('services.prices.med')}</span>

              <Label htmlFor="svc-priceAdultNoMed" className="text-text-muted">
                {t('services.prices.adult')}
              </Label>
              <PriceField control={control} name="priceAdultNoMed" id="svc-priceAdultNoMed" label={t('services.prices.adultNoMed')} error={err('priceAdultNoMed')} />
              <PriceField control={control} name="priceAdultMed" id="svc-priceAdultMed" label={t('services.prices.adultMed')} error={err('priceAdultMed')} />

              <Label htmlFor="svc-priceChildNoMed" className="text-text-muted">
                {t('services.prices.child')}
              </Label>
              <PriceField control={control} name="priceChildNoMed" id="svc-priceChildNoMed" label={t('services.prices.childNoMed')} error={err('priceChildNoMed')} />
              <PriceField control={control} name="priceChildMed" id="svc-priceChildMed" label={t('services.prices.childMed')} error={err('priceChildMed')} />
            </div>
          </fieldset>

          {/* Sozlamalar */}
          <fieldset className="space-y-4 rounded-xl border border-line bg-popover/60 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t('services.dialog.optionsSection')}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="svc-duration" required>
                  {t('services.fields.duration')}
                </Label>
                <Input
                  id="svc-duration"
                  type="number"
                  inputMode="numeric"
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={5}
                  aria-invalid={Boolean(errors.durationMin) || undefined}
                  aria-describedby="svc-duration-hint"
                  {...register('durationMin')}
                />
                <p id="svc-duration-hint" className="text-xs text-text-muted">
                  {t('services.fields.durationHint')}
                </p>
                <FieldError>{err('durationMin')}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-organ">{t('services.fields.defaultOrgan')}</Label>
                <Controller
                  control={control}
                  name="defaultOrgan"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NO_ORGAN}
                      onValueChange={(v) => field.onChange(v === NO_ORGAN ? null : v)}
                    >
                      <SelectTrigger id="svc-organ">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ORGAN}>{t('services.fields.noOrgan')}</SelectItem>
                        {ORGANS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {t(`common.organ.${o}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SwitchRow
                control={control}
                name="allowHalf"
                id="svc-allowHalf"
                label={t('services.fields.allowHalf')}
                hint={t('services.fields.allowHalfHint')}
              />
              <SwitchRow
                control={control}
                name="medicineOptional"
                id="svc-medicineOptional"
                label={t('services.fields.medicineOptional')}
                hint={t('services.fields.medicineOptionalHint')}
              />
              {isEdit ? (
                <SwitchRow
                  control={control}
                  name="isActive"
                  id="svc-isActive"
                  label={t('services.fields.isActive')}
                  hint={t('services.fields.isActiveHint')}
                />
              ) : null}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="gradient" loading={isSubmitting}>
              {isEdit ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-xs text-danger">
      {children}
    </p>
  );
}

interface PriceFieldProps {
  control: Control<ServiceInput>;
  name: 'priceAdultNoMed' | 'priceAdultMed' | 'priceChildNoMed' | 'priceChildMed';
  id: string;
  label: string;
  error: string | null;
}

function PriceField({ control, name, id, label, error }: PriceFieldProps) {
  return (
    <div className="space-y-1">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <MoneyInput
            id={id}
            aria-label={label}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            invalid={Boolean(error)}
            size="sm"
          />
        )}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}

interface SwitchRowProps {
  control: Control<ServiceInput>;
  name: 'allowHalf' | 'medicineOptional' | 'isActive';
  id: string;
  label: string;
  hint: string;
}

function SwitchRow({ control, name, id, label, hint }: SwitchRowProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor={id} className="cursor-pointer">
              {label}
            </Label>
            <p className="mt-1 text-xs text-text-muted">{hint}</p>
          </div>
          <Switch id={id} checked={field.value ?? true} onCheckedChange={field.onChange} />
        </div>
      )}
    />
  );
}

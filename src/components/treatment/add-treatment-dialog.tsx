'use client';

import * as React from 'react';
import type { Organ, Side } from '@prisma/client';
import { AlertCircle, Baby, Pill, PillBottle, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { quantityStep, snapQuantity, type DiscountType, type PatientType } from '@/lib/calc';
import { formatMoney } from '@/lib/money';
import { useLocale } from '@/i18n/client';
import { AddLineSchema, type AddLineInput } from '@/lib/visits/schemas';
import type { TreatmentServiceDTO } from '@/lib/visits/dto';
import type { TreatmentLineDTO } from '@/lib/visits/types';
import { useTreatmentDraft } from '@/stores/use-treatment-draft';
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
import { NumberStepper } from '@/components/ui/number-stepper';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Kbd } from '@/components/ui/kbd';
import { AnatomySelector } from './anatomy-selector';
import { MoneyField } from './money-field';
import { ServicePicker } from './service-picker';
import { TreatmentLineCalculator, useLineCalc } from './treatment-calculator';
import { patientAgeInfo } from './visit-utils';

export interface AddTreatmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  /** Tahrirlash rejimida mavjud qator */
  line?: TreatmentLineDTO | null;
  services: TreatmentServiceDTO[];
  visitId: string;
  patient: { birthDate: string };
  clinic: { childAgeLimit: number };
  /** Serverga yuborish (xato boʻlsa otadi — oyna ochiq qoladi) */
  onSubmit: (input: AddLineInput, keepOpen: boolean) => Promise<void>;
}

interface FormState {
  serviceId: string | null;
  patientType: PatientType;
  patientTypeManual: boolean;
  withMedicine: boolean;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  side: Side | null;
  organ: Organ | null;
  detail: string;
  note: string;
}

type FieldKey = 'serviceId' | 'quantity' | 'discountValue' | 'detail' | 'note';

const ORGANS: Organ[] = ['EAR', 'NOSE', 'THROAT', 'LARYNX', 'OTHER'];
const NONE = '__none__';

/**
 * Muolaja qoʻshish / tahrirlash oynasi (spec §5.6).
 * Har qanday oʻzgarish `useLineCalc` (calcLine) orqali darhol qayta hisoblanadi.
 */
export function AddTreatmentDialog({
  open,
  onOpenChange,
  mode,
  line,
  services,
  visitId,
  patient,
  clinic,
  onSubmit,
}: AddTreatmentDialogProps) {
  const { t } = useLocale();
  const setDraft = useTreatmentDraft((s) => s.setDraft);
  const draftFor = useTreatmentDraft((s) => s.draftFor);

  const auto = React.useMemo(
    () => patientAgeInfo(patient.birthDate, clinic.childAgeLimit),
    [patient.birthDate, clinic.childAgeLimit],
  );

  const initial = React.useCallback((): FormState => {
    if (mode === 'edit' && line) {
      return {
        serviceId: line.serviceId,
        patientType: line.patientType,
        patientTypeManual: line.patientType !== auto.type,
        withMedicine: line.withMedicine,
        quantity: line.quantity,
        discountType: line.discountType,
        discountValue: line.discountValue,
        side: line.side,
        organ: line.organ,
        detail: line.detail ?? '',
        note: line.note ?? '',
      };
    }
    // Qoralama: oxirgi tanlovlar (bemor turi, dori, miqdor, chegirma, tomon/organ) — xizmat har safar qaytadan tanlanadi
    const d = draftFor(visitId);
    return {
      serviceId: null,
      patientType: d?.patientType ?? auto.type,
      patientTypeManual:
        d?.patientType !== null && d?.patientType !== undefined && d.patientType !== auto.type,
      withMedicine: d?.withMedicine ?? true,
      quantity: d?.quantity ?? 1,
      discountType: d?.discountType ?? 'NONE',
      discountValue: d?.discountValue ?? 0,
      side: d?.side ?? null,
      organ: d?.organ ?? null,
      detail: '',
      note: '',
    };
  }, [mode, line, draftFor, visitId, auto.type]);

  const [form, setForm] = React.useState<FormState>(initial);
  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [autoOpenKey, setAutoOpenKey] = React.useState(0);

  // Har ochilishda holatni qayta yuklash (faqat ochilganda / boshqa qator tanlanganda — fon yangilanishlari formani buzmaydi)
  const initialRef = React.useRef(initial);
  initialRef.current = initial;
  const lineId = line?.id ?? null;
  React.useEffect(() => {
    if (open) {
      setForm(initialRef.current());
      setErrors({});
      setAttempted(false);
      setSubmitting(false);
    }
  }, [open, mode, lineId]);

  const service = React.useMemo(
    () => services.find((s) => s.id === form.serviceId) ?? null,
    [services, form.serviceId],
  );
  const medicineForced = !!service && !service.medicineOptional;
  const effectiveMed = medicineForced ? true : form.withMedicine;
  const allowHalf = service?.allowHalf ?? true;

  const calc = useLineCalc(service, {
    patientType: form.patientType,
    withMedicine: effectiveMed,
    quantity: form.quantity,
    discountType: form.discountType,
    discountValue: form.discountType === 'NONE' ? 0 : form.discountValue,
  });

  const patch = (p: Partial<FormState>) => setForm((s) => ({ ...s, ...p }));

  const onService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setForm((s) => {
      const organChanged = svc.defaultOrgan && svc.defaultOrgan !== s.organ && (mode === 'add' || !s.organ);
      return {
        ...s,
        serviceId: svc.id,
        withMedicine: svc.medicineOptional ? s.withMedicine : true,
        quantity: snapQuantity(s.quantity, svc.allowHalf),
        organ: organChanged ? svc.defaultOrgan : s.organ,
        side: organChanged ? null : s.side,
        detail: organChanged ? '' : s.detail,
      };
    });
    setErrors((e) => ({ ...e, serviceId: undefined }));
  };

  const percentInvalid = form.discountType === 'PERCENT' && form.discountValue > 100;

  const buildInput = (): AddLineInput | null => {
    if (!form.serviceId) return null;
    const raw = {
      serviceId: form.serviceId,
      patientType: form.patientType,
      withMedicine: effectiveMed,
      quantity: form.quantity,
      discountType: form.discountType,
      discountValue: form.discountType === 'NONE' ? 0 : form.discountValue,
      side: form.side,
      organ: form.organ,
      detail: form.detail.trim() || null,
      note: form.note.trim() || null,
    };
    const parsed = AddLineSchema.safeParse(raw);
    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'discountValue')
          next.discountValue = percentInvalid
            ? t('visits.dialog.percentMax')
            : t('visits.errors.INVALID_DISCOUNT');
        else if (key === 'quantity') next.quantity = t('visits.errors.INVALID_QUANTITY');
        else if (key === 'serviceId') next.serviceId = t('visits.dialog.selectService');
        else if (key === 'detail' || key === 'note')
          next[key] = t('common.validation.max', { n: key === 'detail' ? 200 : 500 });
      }
      setErrors(next);
      return null;
    }
    return parsed.data;
  };

  const submit = async (keepOpen: boolean) => {
    setAttempted(true);
    if (!form.serviceId) {
      setErrors({ serviceId: t('visits.dialog.selectService') });
      return;
    }
    if (calc.error && calc.error !== 'NO_SERVICE') return;
    const input = buildInput();
    if (!input) return;
    setSubmitting(true);
    try {
      try {
        await onSubmit(input, keepOpen);
      } catch {
        // Xato allaqachon toast orqali koʻrsatilgan — oyna ochiq qoladi
        return;
      }
      setDraft({
        visitId,
        serviceId: input.serviceId,
        patientType: form.patientTypeManual ? form.patientType : null,
        withMedicine: input.withMedicine,
        quantity: input.quantity,
        discountType: input.discountType,
        discountValue: input.discountValue,
        side: input.side ?? null,
        organ: input.organ ?? null,
      });
      if (keepOpen) {
        setForm((s) => ({ ...s, serviceId: null, detail: '', note: '' }));
        setErrors({});
        setAttempted(false);
      } else {
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = (pt: PatientType) => t(`common.patientType.${pt}`);
  const calcBlocked = !!calc.error && calc.error !== 'NO_SERVICE';
  const canSubmit = !!service && !calcBlocked && !percentInvalid && !submitting;

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent
        className="max-w-3xl p-0 sm:p-0"
        onOpenAutoFocus={(e) => {
          // Qoʻshish rejimida xizmat tanlagichni darhol ochamiz (fokus ham unda qoladi)
          if (mode === 'add' && !form.serviceId) {
            e.preventDefault();
            setAutoOpenKey((k) => k + 1);
          }
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
          className="flex max-h-[calc(100dvh-2rem)] flex-col"
        >
          <DialogHeader className="border-b border-line px-5 pb-4 pr-12 pt-5 text-left sm:px-6 sm:pr-12">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-accent" aria-hidden="true" />
              {mode === 'edit' ? t('visits.dialog.editTitle') : t('visits.dialog.addTitle')}
            </DialogTitle>
            <DialogDescription>{t('visits.dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_296px] md:grid-rows-[auto_auto]">
              {/* ── Asosiy maydonlar ── */}
              <div className="space-y-4 md:col-start-1 md:row-start-1">
                <div className="space-y-1.5">
                  <Label htmlFor="tl-service" required>
                    {t('visits.dialog.service')}
                  </Label>
                  <ServicePicker
                    id="tl-service"
                    services={services}
                    value={form.serviceId}
                    onChange={onService}
                    autoOpenKey={autoOpenKey}
                  />
                  {errors.serviceId ? <FieldError>{errors.serviceId}</FieldError> : null}
                  {service && !service.isActive ? (
                    <p className="text-xs text-warning">{t('visits.dialog.serviceInactive')}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t('visits.dialog.patientType')}</Label>
                    <Segmented<PatientType>
                      value={form.patientType}
                      onChange={(v) => patch({ patientType: v, patientTypeManual: v !== auto.type })}
                      variant="accent"
                      fullWidth
                      ariaLabel={t('visits.dialog.patientType')}
                      options={[
                        { value: 'ADULT', label: typeLabel('ADULT'), icon: <User aria-hidden="true" /> },
                        { value: 'CHILD', label: typeLabel('CHILD'), icon: <Baby aria-hidden="true" /> },
                      ]}
                    />
                    <p className="text-xs text-text-muted">
                      {form.patientType === auto.type
                        ? t('visits.dialog.autoType', { n: auto.age, type: typeLabel(auto.type) })
                        : t('visits.dialog.manualType', { type: typeLabel(auto.type) })}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t('visits.dialog.medicine')}</Label>
                    <Segmented<'MED' | 'NOMED'>
                      value={effectiveMed ? 'MED' : 'NOMED'}
                      onChange={(v) => patch({ withMedicine: v === 'MED' })}
                      variant="accent"
                      fullWidth
                      disabled={medicineForced}
                      ariaLabel={t('visits.dialog.medicine')}
                      options={[
                        { value: 'MED', label: t('common.withMedicine'), icon: <Pill aria-hidden="true" /> },
                        {
                          value: 'NOMED',
                          label: t('common.withoutMedicine'),
                          icon: <PillBottle aria-hidden="true" />,
                        },
                      ]}
                    />
                    <p className={cn('text-xs', medicineForced ? 'text-[#7C5CFF]' : 'text-text-muted')}>
                      {medicineForced
                        ? t('visits.dialog.medicineForced')
                        : service
                          ? `${t('visits.dialog.priceMed')} / ${t('visits.dialog.priceNoMed')}`
                          : ' '}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tl-qty">
                      {t('visits.dialog.quantity')}{' '}
                      <span className="font-normal text-text-muted">
                        {allowHalf ? t('visits.dialog.halfStep') : t('visits.dialog.wholeOnly')}
                      </span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <NumberStepper
                        id="tl-qty"
                        value={form.quantity}
                        onChange={(v) => patch({ quantity: v })}
                        step={quantityStep(allowHalf)}
                        allowHalf={allowHalf}
                        hideHint
                        ariaLabel={t('visits.dialog.quantity')}
                      />
                      <span className="text-sm text-text-muted">
                        {service?.unit ?? t('visits.dialog.unit')}
                      </span>
                    </div>
                    {errors.quantity ? <FieldError>{errors.quantity}</FieldError> : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tl-discount">{t('visits.dialog.discount')}</Label>
                    <div className="flex items-center gap-2">
                      <Segmented<DiscountType>
                        value={form.discountType}
                        onChange={(v) =>
                          patch({ discountType: v, discountValue: v === 'NONE' ? 0 : form.discountValue })
                        }
                        size="md"
                        ariaLabel={t('visits.dialog.discount')}
                        options={[
                          { value: 'NONE', label: t('visits.dialog.discountNone') },
                          { value: 'PERCENT', label: t('visits.dialog.discountPercent') },
                          { value: 'FIXED', label: t('visits.dialog.discountFixed') },
                        ]}
                      />
                      {form.discountType === 'PERCENT' ? (
                        <div className="relative min-w-0 flex-1">
                          <Input
                            id="tl-discount"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100}
                            step={1}
                            value={form.discountValue === 0 ? '' : String(form.discountValue)}
                            onChange={(e) =>
                              patch({ discountValue: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })
                            }
                            aria-label={t('visits.dialog.discountValue')}
                            aria-invalid={percentInvalid || undefined}
                            placeholder="0"
                            className="tabular pr-8 text-right"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
                          >
                            %
                          </span>
                        </div>
                      ) : form.discountType === 'FIXED' ? (
                        <MoneyField
                          id="tl-discount"
                          value={form.discountValue}
                          onChange={(v) => patch({ discountValue: v })}
                          aria-label={t('visits.dialog.discountValue')}
                          className="min-w-0 flex-1"
                        />
                      ) : null}
                    </div>
                    {percentInvalid ? (
                      <FieldError>{t('visits.dialog.percentMax')}</FieldError>
                    ) : errors.discountValue ? (
                      <FieldError>{errors.discountValue}</FieldError>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ── Jonli hisob ── */}
              <div className="md:col-start-2 md:row-span-2 md:row-start-1">
                <div className="space-y-3 md:sticky md:top-0">
                  <TreatmentLineCalculator
                    service={service}
                    patientType={form.patientType}
                    withMedicine={effectiveMed}
                    quantity={form.quantity}
                    discountType={form.discountType}
                    discountValue={form.discountType === 'NONE' ? 0 : form.discountValue}
                    unit={service?.unit}
                    hideError={!service}
                    className="glass-strong"
                  />
                  {!service && attempted ? <FieldError>{t('visits.dialog.selectService')}</FieldError> : null}
                  {service ? (
                    <dl className="tabular grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-line bg-bg-elevated px-3 py-2 text-[11px] text-text-muted">
                      <dt>
                        {t('visits.dialog.priceAdult')} · {t('visits.dialog.priceNoMed')}
                      </dt>
                      <dd className="text-right text-text">
                        {formatMoney(service.priceAdultNoMed, { suffix: '' })}
                      </dd>
                      <dt>
                        {t('visits.dialog.priceAdult')} · {t('visits.dialog.priceMed')}
                      </dt>
                      <dd className="text-right text-text">
                        {formatMoney(service.priceAdultMed, { suffix: '' })}
                      </dd>
                      <dt>
                        {t('visits.dialog.priceChild')} · {t('visits.dialog.priceNoMed')}
                      </dt>
                      <dd className="text-right text-text">
                        {formatMoney(service.priceChildNoMed, { suffix: '' })}
                      </dd>
                      <dt>
                        {t('visits.dialog.priceChild')} · {t('visits.dialog.priceMed')}
                      </dt>
                      <dd className="text-right text-text">
                        {formatMoney(service.priceChildMed, { suffix: '' })}
                      </dd>
                    </dl>
                  ) : null}
                </div>
              </div>

              {/* ── Anatomiya, aniqlik, izoh ── */}
              <div className="space-y-4 md:col-start-1 md:row-start-2">
                <div className="space-y-1.5">
                  <Label>{t('visits.dialog.anatomy')}</Label>
                  <AnatomySelector
                    value={{ organ: form.organ, side: form.side, detail: form.detail }}
                    onChange={(v) => patch({ organ: v.organ, side: v.side, detail: v.detail })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tl-organ">{t('visits.dialog.organ')}</Label>
                    <Select
                      value={form.organ ?? NONE}
                      onValueChange={(v) => patch({ organ: v === NONE ? null : (v as Organ) })}
                    >
                      <SelectTrigger id="tl-organ" aria-label={t('visits.dialog.organ')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('visits.dialog.organNone')}</SelectItem>
                        {ORGANS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {t(`common.organ.${o}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('visits.dialog.side')}</Label>
                    <Segmented<Side | 'NONE'>
                      value={form.side ?? 'NONE'}
                      onChange={(v) => patch({ side: v === 'NONE' ? null : v })}
                      fullWidth
                      ariaLabel={t('visits.dialog.side')}
                      options={[
                        { value: 'NONE', label: '—' },
                        { value: 'LEFT', label: t('common.side.LEFT') },
                        { value: 'RIGHT', label: t('common.side.RIGHT') },
                        { value: 'BOTH', label: t('common.side.BOTH') },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="tl-detail">{t('visits.dialog.detail')}</Label>
                    <Input
                      id="tl-detail"
                      value={form.detail}
                      maxLength={200}
                      onChange={(e) => patch({ detail: e.target.value })}
                      placeholder={t('visits.dialog.detailPlaceholder')}
                    />
                    {errors.detail ? <FieldError>{errors.detail}</FieldError> : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tl-note">{t('visits.dialog.note')}</Label>
                    <Input
                      id="tl-note"
                      value={form.note}
                      maxLength={500}
                      onChange={(e) => patch({ note: e.target.value })}
                      placeholder={t('visits.dialog.notePlaceholder')}
                    />
                    {errors.note ? <FieldError>{errors.note}</FieldError> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="items-center gap-2 border-t border-line px-5 py-4 sm:justify-between sm:px-6">
            <span className="hidden items-center gap-1.5 text-xs text-text-muted sm:inline-flex">
              <Kbd>Enter</Kbd> — {mode === 'edit' ? t('visits.dialog.save') : t('visits.dialog.add')}
            </span>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              {mode === 'add' ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void submit(true)}
                  disabled={!canSubmit}
                  loading={submitting}
                >
                  {t('visits.dialog.addMore')}
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="gradient"
                className="glow"
                disabled={!canSubmit}
                loading={submitting}
              >
                {mode === 'edit' ? t('visits.dialog.save') : t('visits.dialog.add')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

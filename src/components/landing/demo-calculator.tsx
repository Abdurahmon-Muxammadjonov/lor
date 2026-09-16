'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Eraser, ListPlus, Lock, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { formatMoney } from '@/lib/money';
import { formatQuantity, snapQuantity, type DiscountType, type PatientType } from '@/lib/calc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { DEMO_SERVICES, findDemoService, groupDemoServices, type DemoService } from '@/data/demo-services';
import {
  buildDefaultDemoLines,
  buildDemoLine,
  computeDemoTotals,
  DEFAULT_DEMO_SERVICE_CODE,
  isDiscountValid,
  parseDiscountInput,
  tryComputeDemoLine,
  type DemoLine,
} from './demo-calc';

type MedicineOption = 'MED' | 'NOMED';
type DiscountMode = Exclude<DiscountType, 'NONE'>;

const FALLBACK_SERVICE: DemoService | undefined = DEMO_SERVICES[0];

/**
 * Interaktiv demo kalkulyator — CRM dagi bilan bir xil formula (calcLine → calcVisit, Decimal).
 * Faqat brauzerda yuklanadi (dynamic, ssr:false).
 */
export function DemoCalculator() {
  const { t, locale } = useLocale();
  const uid = React.useId();
  const ids = {
    service: `${uid}-service`,
    patient: `${uid}-patient`,
    medicine: `${uid}-medicine`,
    quantity: `${uid}-quantity`,
    discount: `${uid}-discount`,
    discountHint: `${uid}-discount-hint`,
    quantityHint: `${uid}-quantity-hint`,
    medicineHint: `${uid}-medicine-hint`,
  };

  const [serviceCode, setServiceCode] = React.useState(DEFAULT_DEMO_SERVICE_CODE);
  const [patientType, setPatientType] = React.useState<PatientType>('ADULT');
  const [withMedicine, setWithMedicine] = React.useState(false);
  const [quantity, setQuantity] = React.useState(1.5);
  const [discountMode, setDiscountMode] = React.useState<DiscountMode>('PERCENT');
  const [discountRaw, setDiscountRaw] = React.useState('');
  const [lines, setLines] = React.useState<DemoLine[]>(() => buildDefaultDemoLines());

  const service = findDemoService(serviceCode) ?? FALLBACK_SERVICE;
  const name = (s: DemoService) => (locale === 'ru' ? s.nameRu : s.name);

  const discountValue = parseDiscountInput(discountRaw);
  const discountEmpty = discountRaw.trim() === '';
  const discountValid = discountEmpty || isDiscountValid(discountMode, discountValue);
  const discountType: DiscountType = discountEmpty || discountValue === 0 ? 'NONE' : discountMode;
  const effectiveWithMedicine = service ? (service.medicineOptional ? withMedicine : true) : withMedicine;

  const result = React.useMemo(
    () =>
      service && discountValid
        ? tryComputeDemoLine({
            serviceCode: service.code,
            patientType,
            withMedicine: effectiveWithMedicine,
            quantity,
            discountType,
            discountValue: discountType === 'NONE' ? 0 : discountValue,
          })
        : null,
    [service, discountValid, patientType, effectiveWithMedicine, quantity, discountType, discountValue],
  );
  const totals = React.useMemo(() => computeDemoTotals(lines), [lines]);

  const onServiceChange = (code: string) => {
    setServiceCode(code);
    const next = findDemoService(code);
    if (next && !next.allowHalf) setQuantity((q) => snapQuantity(q, false));
  };

  const add = () => {
    if (!service || !result || !discountValid) return;
    const line = buildDemoLine({
      serviceCode: service.code,
      patientType,
      withMedicine: effectiveWithMedicine,
      quantity,
      discountType,
      discountValue: discountType === 'NONE' ? 0 : discountValue,
    });
    setLines((prev) => [...prev, line]);
    toast.success(t('landing.demo.added'), {
      description: `${name(service)} · ${formatMoney(line.result.net, { suffix: t('common.currency') })}`,
    });
  };

  const remove = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    toast(t('landing.demo.removed'));
  };

  if (!service) return null;

  const medicineValue: MedicineOption = effectiveWithMedicine ? 'MED' : 'NOMED';
  const canAdd = Boolean(result) && discountValid;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      {/* ── Forma ── */}
      <form
        className="glass min-w-0 p-5 sm:p-6"
        aria-label={t('landing.demo.formLabel')}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={ids.service}>{t('landing.demo.service')}</Label>
            <Select value={serviceCode} onValueChange={onServiceChange}>
              <SelectTrigger id={ids.service} aria-label={t('landing.demo.service')} className="h-11">
                <SelectValue placeholder={t('landing.demo.servicePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {groupDemoServices().map((g) => (
                  <SelectGroup key={g.category.key}>
                    <SelectLabel>{locale === 'ru' ? g.category.nameRu : g.category.name}</SelectLabel>
                    {g.services.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        <span className="tabular mr-2 font-mono text-xs text-text-muted">{s.code}</span>
                        {name(s)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <span id={ids.patient} className="block text-sm font-medium leading-none text-text">
                {t('landing.demo.patientType')}
              </span>
              <Segmented<PatientType>
                value={patientType}
                onChange={setPatientType}
                variant="accent"
                fullWidth
                ariaLabel={t('landing.demo.patientType')}
                options={[
                  { value: 'ADULT', label: t('common.patientType.ADULT') },
                  { value: 'CHILD', label: t('common.patientType.CHILD') },
                ]}
              />
            </div>
            <div className="space-y-2">
              <span id={ids.medicine} className="block text-sm font-medium leading-none text-text">
                {t('landing.demo.medicine')}
              </span>
              <Segmented<MedicineOption>
                value={medicineValue}
                onChange={(v) => setWithMedicine(v === 'MED')}
                variant="accent"
                fullWidth
                disabled={!service.medicineOptional}
                ariaLabel={t('landing.demo.medicine')}
                options={[
                  { value: 'MED', label: t('common.withMedicine') },
                  { value: 'NOMED', label: t('common.withoutMedicine') },
                ]}
              />
              {!service.medicineOptional ? (
                <p id={ids.medicineHint} className="flex items-center gap-1.5 text-xs text-warning">
                  <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                  {t('landing.demo.medicineLocked')}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={ids.quantity}>
                {t('landing.demo.quantity')}{' '}
                <span className="font-normal text-text-muted">
                  ({t(`landing.demo.unit.${service.unit}`)})
                </span>
              </Label>
              <NumberStepper
                id={ids.quantity}
                value={quantity}
                onChange={setQuantity}
                allowHalf={service.allowHalf}
                min={service.allowHalf ? 0.5 : 1}
                max={99}
                size="md"
                hideHint
                ariaLabel={t('landing.demo.quantity')}
              />
              <p
                id={ids.quantityHint}
                className={cn('text-xs', service.allowHalf ? 'text-text-muted' : 'text-warning')}
              >
                {service.allowHalf ? t('landing.demo.quantityHalf') : t('landing.demo.quantityWhole')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={ids.discount}>{t('landing.demo.discount')}</Label>
              <div className="flex gap-2">
                <Input
                  id={ids.discount}
                  value={discountRaw}
                  onChange={(e) => setDiscountRaw(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  aria-invalid={!discountValid}
                  aria-describedby={!discountValid ? ids.discountHint : undefined}
                  className="tabular h-10 flex-1"
                />
                <Segmented<DiscountMode>
                  value={discountMode}
                  onChange={setDiscountMode}
                  ariaLabel={t('landing.demo.discountType')}
                  options={[
                    { value: 'PERCENT', label: t('landing.demo.percent') },
                    { value: 'FIXED', label: t('landing.demo.fixed') },
                  ]}
                />
              </div>
              {!discountValid ? (
                <p id={ids.discountHint} role="alert" className="text-xs text-danger">
                  {t('landing.demo.discountInvalid')}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </form>

      {/* ── Natija ── */}
      <aside
        className="glass-strong flex min-w-0 flex-col p-5 sm:p-6"
        aria-label={t('landing.demo.summaryLabel')}
        aria-live="polite"
      >
        <dl className="space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-text-muted">{t('landing.demo.unitPrice')}</dt>
            <dd>
              <Money value={result?.unitPrice ?? null} className="font-semibold text-text" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-text-muted">
              {t('landing.demo.gross')}
              {result ? (
                <span className="tabular ml-1 text-xs text-text-muted">
                  (
                  {t('landing.demo.grossFormula', {
                    qty: formatQuantity(result.quantity),
                    price: formatMoney(result.unitPrice, { suffix: '' }),
                  })}
                  )
                </span>
              ) : null}
            </dt>
            <dd>
              <Money value={result?.gross ?? null} className="font-semibold text-text" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-text-muted">{t('landing.demo.discountAmount')}</dt>
            <dd>
              {result && result.discount > 0 ? (
                <span className="tabular text-danger">
                  −<Money value={result.discount} />
                </span>
              ) : (
                <Money value={0} muted />
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('landing.demo.total')}
            </dt>
            <dd>
              <Money
                value={result?.net ?? null}
                className="text-gradient font-heading text-3xl font-extrabold sm:text-4xl"
              />
            </dd>
          </div>
        </dl>
        <Button
          type="button"
          variant="gradient"
          size="lg"
          className="mt-6 w-full"
          onClick={add}
          disabled={!canAdd}
        >
          <Plus aria-hidden="true" />
          {t('landing.demo.add')}
        </Button>
      </aside>

      {/* ── Qatorlar ── */}
      <div className="glass min-w-0 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-bold text-text">{t('landing.demo.linesTitle')}</h3>
            <Badge variant="accent">{t('landing.demo.linesCount', { n: lines.length })}</Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLines([])}
            disabled={lines.length === 0}
          >
            <Eraser aria-hidden="true" />
            {t('landing.demo.clear')}
          </Button>
        </div>

        {lines.length === 0 ? (
          <EmptyState icon={ListPlus} title={t('landing.demo.empty')} compact className="py-12" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('landing.demo.colService')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('landing.demo.colType')}</TableHead>
                <TableHead className="text-right">{t('landing.demo.colQty')}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t('landing.demo.colUnit')}</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  {t('landing.demo.colDiscount')}
                </TableHead>
                <TableHead className="text-right">{t('landing.demo.colTotal')}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t('common.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium text-text">{name(l.service)}</div>
                    <div className="tabular text-xs text-text-muted">
                      {l.service.code}
                      <span className="md:hidden">
                        {' '}
                        · {t(`common.patientType.${l.patientType}`)} ·{' '}
                        {l.result.effectiveWithMedicine
                          ? t('common.withMedicine')
                          : t('common.withoutMedicine')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-text-muted md:table-cell">
                    {t(`common.patientType.${l.patientType}`)} ·{' '}
                    {l.result.effectiveWithMedicine ? t('common.withMedicine') : t('common.withoutMedicine')}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {formatQuantity(l.result.quantity)}{' '}
                    <span className="text-xs text-text-muted">
                      {t(`landing.demo.unit.${l.service.unit}`)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <Money value={l.result.unitPrice} muted />
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {l.result.discount > 0 ? (
                      <span className="tabular text-danger">
                        −<Money value={l.result.discount} />
                        {l.discountType === 'PERCENT' ? (
                          <span className="ml-1 text-xs text-text-muted">({l.discountValue}%)</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={l.result.net} className="font-semibold text-text" />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-text-muted hover:text-danger"
                      onClick={() => remove(l.id)}
                      aria-label={`${t('landing.demo.remove')}: ${name(l.service)}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col items-end gap-1.5 border-t border-line px-5 py-4 text-sm">
          <div className="flex w-full max-w-xs items-baseline justify-between gap-4">
            <span className="text-text-muted">{t('landing.demo.subtotal')}</span>
            <Money value={totals.subtotal} className="text-text" />
          </div>
          {totals.rounding !== 0 ? (
            <div className="flex w-full max-w-xs items-baseline justify-between gap-4">
              <span className="text-text-muted">{t('landing.demo.rounding')}</span>
              <Money value={totals.rounding} signed className="text-text-muted" />
            </div>
          ) : null}
          <div className="mt-1 flex w-full max-w-xs items-baseline justify-between gap-4 border-t border-line pt-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('landing.demo.grandTotal')}
            </span>
            <Money value={totals.total} className="text-gradient font-heading text-2xl font-extrabold" />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { ArrowLeft, ArrowRight, Eye, Sparkles, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { useLocale } from '@/i18n/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConfirm } from '@/components/shared/confirm-dialog';
import {
  BulkSchema,
  PRICE_FIELDS,
  type BulkInput,
  type BulkMode,
  type BulkRound,
  type PriceField,
} from '@/lib/services/schemas';
import type { BulkResultDTO, CategoryDTO } from '@/lib/services/types';
import { CategoryIcon } from './category-icon';
import { MoneyInput } from './money-input';
import { serviceErrorMessage, useBulkServices } from './use-services';

type Scope = 'ALL' | 'CATEGORY' | 'SELECTED';

export interface BulkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryDTO[];
  /** Jadvalda tanlangan xizmatlar */
  selectedIds: string[];
  /** Joriy kategoriya (boshlangʻich qiymat) */
  defaultCategoryId?: string | null;
  onApplied?: () => void;
}

const FIELD_LABEL_KEY: Record<PriceField, string> = {
  priceAdultNoMed: 'services.prices.adultNoMed',
  priceAdultMed: 'services.prices.adultMed',
  priceChildNoMed: 'services.prices.childNoMed',
  priceChildMed: 'services.prices.childMed',
};

/** Ommaviy narx oʻzgartirish: sozlash → oldindan koʻrish (old → new) → qoʻllash */
export function BulkDialog({ open, onOpenChange, categories, selectedIds, defaultCategoryId, onApplied }: BulkDialogProps) {
  const { t, locale } = useLocale();
  const bulk = useBulkServices();
  const [confirm, confirmElement] = useConfirm();

  const [step, setStep] = React.useState<'form' | 'preview'>('form');
  const [scope, setScope] = React.useState<Scope>('ALL');
  const [categoryId, setCategoryId] = React.useState<string>('');
  const [mode, setMode] = React.useState<BulkMode>('PERCENT');
  const [value, setValue] = React.useState<number>(10);
  const [fields, setFields] = React.useState<Set<PriceField>>(() => new Set(PRICE_FIELDS));
  const [roundTo, setRoundTo] = React.useState<BulkRound>(100);
  const [result, setResult] = React.useState<BulkResultDTO | null>(null);
  const [showUnchanged, setShowUnchanged] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const hasSelection = selectedIds.length > 0;

  React.useEffect(() => {
    if (!open) return;
    setStep('form');
    setResult(null);
    setFormError(null);
    setShowUnchanged(false);
    setScope(hasSelection ? 'SELECTED' : defaultCategoryId ? 'CATEGORY' : 'ALL');
    setCategoryId(defaultCategoryId ?? categories[0]?.id ?? '');
  }, [open, hasSelection, defaultCategoryId, categories]);

  const buildInput = (preview: boolean): BulkInput | null => {
    const input: BulkInput = {
      mode,
      value,
      fields: Array.from(fields),
      roundTo,
      preview,
      ...(scope === 'CATEGORY' ? { categoryId } : {}),
      ...(scope === 'SELECTED' ? { serviceIds: selectedIds } : {}),
    };
    const parsed = BulkSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setFormError(first ? t(first.message) : t('common.validation.invalid'));
      return null;
    }
    if (scope === 'CATEGORY' && !categoryId) {
      setFormError(t('services.bulk.selectCategory'));
      return null;
    }
    setFormError(null);
    return input;
  };

  const runPreview = async () => {
    const input = buildInput(true);
    if (!input) return;
    try {
      const res = await bulk.mutateAsync(input);
      setResult(res);
      setStep('preview');
    } catch (e) {
      toast.error(serviceErrorMessage(e, t));
    }
  };

  const apply = async () => {
    const input = buildInput(false);
    if (!input || !result) return;
    const okConfirm = await confirm({
      title: t('services.bulk.confirmTitle'),
      description: t('services.bulk.confirmDescription', { n: result.updated }),
      confirmText: t('services.bulk.apply'),
    });
    if (!okConfirm) return;
    try {
      const res = await bulk.mutateAsync(input);
      toast.success(t('services.bulk.applied', { n: res.updated }));
      onApplied?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(serviceErrorMessage(e, t));
    }
  };

  const toggleField = (f: PriceField, on: boolean) => {
    setFields((prev) => {
      const next = new Set(prev);
      if (on) next.add(f);
      else next.delete(f);
      return next;
    });
  };

  const valueHint =
    mode === 'PERCENT'
      ? t('services.bulk.valuePercentHint')
      : mode === 'FIXED'
        ? t('services.bulk.valueFixedHint')
        : t('services.bulk.valueSetHint');

  const rows = result ? (showUnchanged ? result.rows : result.rows.filter((r) => r.changes.length > 0)) : [];
  const selectedFields = PRICE_FIELDS.filter((f) => fields.has(f));
  const busy = bulk.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            {t('services.bulk.title')}
          </DialogTitle>
          <DialogDescription>{t('services.bulk.description')}</DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-5">
            {/* Qamrov */}
            <div className="space-y-2">
              <Label>{t('services.bulk.scope')}</Label>
              <Segmented<Scope>
                value={scope}
                onChange={setScope}
                ariaLabel={t('services.bulk.scope')}
                fullWidth
                options={[
                  { value: 'ALL', label: t('services.bulk.scopeAll') },
                  { value: 'CATEGORY', label: t('services.bulk.scopeCategory') },
                  {
                    value: 'SELECTED',
                    label: t('services.bulk.scopeSelected', { n: selectedIds.length }),
                    disabled: !hasSelection,
                  },
                ]}
              />
              {scope === 'CATEGORY' ? (
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger aria-label={t('services.bulk.category')}>
                    <SelectValue placeholder={t('services.bulk.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2">
                          <CategoryIcon name={c.icon} className="text-text-muted" />
                          {locale === 'ru' ? c.nameRu : c.name}
                          <span className="text-xs text-text-muted">· {c.servicesCount}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {scope === 'ALL' ? (
                <Alert variant="warning" className="py-3">
                  <TriangleAlert aria-hidden="true" />
                  <AlertDescription>{t('services.bulk.warningAll')}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            {/* Usul + qiymat */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('services.bulk.mode')}</Label>
                <Segmented<BulkMode>
                  value={mode}
                  onChange={setMode}
                  ariaLabel={t('services.bulk.mode')}
                  variant="accent"
                  fullWidth
                  options={[
                    { value: 'PERCENT', label: t('services.bulk.modePercent') },
                    { value: 'FIXED', label: t('services.bulk.modeFixed') },
                    { value: 'SET', label: t('services.bulk.modeSet') },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-value">{t('services.bulk.value')}</Label>
                <MoneyInput
                  id="bulk-value"
                  value={value}
                  onChange={setValue}
                  signed={mode !== 'SET'}
                  suffix={mode === 'PERCENT' ? '%' : undefined}
                  aria-describedby="bulk-value-hint"
                />
                <p id="bulk-value-hint" className="text-xs text-text-muted">
                  {valueHint}
                </p>
              </div>
            </div>

            {/* Maydonlar + yaxlitlash */}
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-text">{t('services.bulk.fields')}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {PRICE_FIELDS.map((f) => (
                    <label
                      key={f}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        fields.has(f) ? 'border-primary/40 bg-primary/10 text-text' : 'border-line bg-surface text-text-muted',
                      )}
                    >
                      <Checkbox checked={fields.has(f)} onCheckedChange={(v) => toggleField(f, v === true)} />
                      <span>{t(FIELD_LABEL_KEY[f])}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label>{t('services.bulk.roundTo')}</Label>
                <Segmented<'100' | '1000'>
                  value={String(roundTo) as '100' | '1000'}
                  onChange={(v) => setRoundTo(v === '1000' ? 1000 : 100)}
                  ariaLabel={t('services.bulk.roundTo')}
                  fullWidth
                  options={[
                    { value: '100', label: '100' },
                    { value: '1000', label: '1 000' },
                  ]}
                />
                <p className="text-xs text-text-muted">{t('services.bulk.roundHint')}</p>
              </div>
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={() => void runPreview()} loading={busy}>
                <Eye aria-hidden="true" />
                {t('services.bulk.preview')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-heading text-base font-semibold text-text">{t('services.bulk.previewTitle')}</p>
                <p className="text-sm text-text-muted">
                  {t('services.bulk.previewSummary', { updated: result?.updated ?? 0, total: result?.total ?? 0 })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">
                  {mode === 'PERCENT'
                    ? `${value > 0 ? '+' : ''}${value} %`
                    : mode === 'FIXED'
                      ? formatMoney(value, { signed: true, suffix: t('common.currency') })
                      : `= ${formatMoney(value, { suffix: t('common.currency') })}`}
                </Badge>
                <Badge variant="outline">
                  {t('services.bulk.roundTo')}: {roundTo === 1000 ? '1 000' : '100'}
                </Badge>
                <label className="inline-flex items-center gap-2 text-xs text-text-muted">
                  <Switch checked={showUnchanged} onCheckedChange={setShowUnchanged} aria-label={t('services.bulk.showUnchanged')} />
                  {t('services.bulk.showUnchanged')}
                </label>
              </div>
            </div>

            {rows.length === 0 ? (
              <Alert variant="info">
                <Eye aria-hidden="true" />
                <AlertDescription>{t('services.bulk.previewEmpty')}</AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-[50vh] overflow-auto rounded-xl border border-line bg-surface scrollbar-thin">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 z-10 bg-bg-elevated">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 px-3">{t('services.bulk.service')}</TableHead>
                      {selectedFields.map((f) => (
                        <TableHead key={f} className="h-9 px-3 text-right">
                          {t(FIELD_LABEL_KEY[f])}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const byField = new Map(r.changes.map((c) => [c.field, c]));
                      return (
                        <TableRow key={r.id} className={cn(r.changes.length === 0 && 'opacity-50')}>
                          <TableCell className="px-3 py-2">
                            <span className="mr-2 font-mono text-[11px] font-semibold text-accent">{r.code}</span>
                            <span className="text-text">{locale === 'ru' ? r.nameRu : r.name}</span>
                          </TableCell>
                          {selectedFields.map((f) => {
                            const c = byField.get(f);
                            return (
                              <TableCell key={f} className="px-3 py-2 text-right tabular">
                                {c ? (
                                  <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                                    <span className="text-text-muted line-through decoration-line">
                                      {formatMoney(c.from, { suffix: '' })}
                                    </span>
                                    <ArrowRight className="size-3 text-text-muted" aria-hidden="true" />
                                    <span className={cn('font-semibold', c.to > c.from ? 'text-[#00FFB2]' : 'text-warning')}>
                                      {formatMoney(c.to, { suffix: '' })}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-text-muted">{t('services.bulk.noChange')}</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs text-text-muted">{t('services.bulk.previewNote')}</p>

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep('form')} disabled={busy}>
                <ArrowLeft aria-hidden="true" />
                {t('services.bulk.back')}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  onClick={() => void apply()}
                  loading={busy}
                  disabled={!result || result.updated === 0}
                >
                  {t('services.bulk.apply')}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
        {confirmElement}
      </DialogContent>
    </Dialog>
  );
}

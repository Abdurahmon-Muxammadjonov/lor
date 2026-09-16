'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Cable, Globe, MonitorSmartphone, Printer, RefreshCw, Trash2, Usb, Wifi } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/date';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrinter, usePrinterLastStatus } from '@/lib/printer/use-printer-settings';
import { WebUsbTransport } from '@/lib/printer/transports/webusb';
import { PrinterFormSchema, type PrinterFormValues, type PrinterPatch, type PrinterTransport } from '@/lib/settings/schemas';
import { Field, FormCard, InputWithUnit, SectionHeading, SwitchRow, fieldAria } from './form-field';
import { SaveBar } from './save-bar';
import { settingsErrorMessage, usePrinterSection, useUpdatePrinterSection } from './use-settings';

export interface PrinterFormProps {
  canWrite: boolean;
  clinicName?: string;
}

const FORM_ID = 'settings-printer-form';
const TRANSPORTS: PrinterTransport[] = ['WEBUSB', 'QZ', 'NETWORK', 'BROWSER'];
const CODEPAGES = ['CP866', 'CP1251', 'ASCII'] as const;

const TRANSPORT_ICON: Record<PrinterTransport, React.ReactNode> = {
  WEBUSB: <Usb aria-hidden="true" />,
  QZ: <MonitorSmartphone aria-hidden="true" />,
  NETWORK: <Wifi aria-hidden="true" />,
  BROWSER: <Globe aria-hidden="true" />,
};

function toPatch(values: PrinterFormValues, base: PrinterFormValues): PrinterPatch {
  const patch: PrinterPatch = {};
  for (const key of Object.keys(values) as (keyof PrinterFormValues)[]) {
    if (values[key] !== base[key]) (patch as Record<string, unknown>)[key] = values[key];
  }
  return patch;
}

export function PrinterForm({ canWrite, clinicName }: PrinterFormProps) {
  const { t, locale } = useLocale();
  const query = usePrinterSection();
  const update = useUpdatePrinterSection();

  const form = useForm<PrinterFormValues>({
    resolver: zodResolver(PrinterFormSchema),
    mode: 'onTouched',
    defaultValues: query.data,
  });
  const { register, control, handleSubmit, reset, watch, setValue, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;

  React.useEffect(() => {
    if (query.data && !isDirty) reset(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  React.useEffect(() => {
    if (query.isError) toast.error(settingsErrorMessage(query.error, t, locale), { id: 'settings-printer-load' });
  }, [query.isError, query.error, t, locale]);

  const values = watch();
  const transport = values.transport;

  // Test chop etish — saqlanmagan qiymatlar bilan
  const overrideParsed = React.useMemo(() => {
    const r = PrinterFormSchema.safeParse(values);
    return r.success ? r.data : null;
  }, [values]);
  const printer = usePrinter({ settingsOverride: overrideParsed ?? query.data ?? null, enabled: false });
  const last = usePrinterLastStatus();
  const [qzPrinters, setQzPrinters] = React.useState<string[]>([]);
  const [qzLoading, setQzLoading] = React.useState(false);
  const [usbBusy, setUsbBusy] = React.useState(false);

  const onSubmit = handleSubmit(async (vals) => {
    if (!query.data) return;
    const patch = toPatch(vals, query.data);
    if (Object.keys(patch).length === 0) {
      reset(vals);
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      reset(saved);
      toast.success(t('settings.toast.saved'));
    } catch (e) {
      toast.error(settingsErrorMessage(e, t, locale));
    }
  });

  const pickUsb = async (any: boolean) => {
    setUsbBusy(true);
    try {
      const name = await printer.requestUsbDevice(any);
      if (name) toast.success(t('settings.printer.usb.picked', { name }));
    } finally {
      setUsbBusy(false);
    }
  };

  const forgetUsb = async () => {
    setUsbBusy(true);
    try {
      await WebUsbTransport.shared().forget();
    } finally {
      setUsbBusy(false);
    }
  };

  const loadQz = async () => {
    setQzLoading(true);
    try {
      const list = await printer.listQzPrinters();
      setQzPrinters(list);
      if (list.length === 0) toast.info(t('settings.printer.qzListEmpty'));
    } finally {
      setQzLoading(false);
    }
  };

  const disabled = !canWrite || update.isPending;
  const hasErrors = Object.keys(errors).length > 0;

  if (query.isPending) return <PrinterFormSkeleton />;
  if (!query.data) return null;

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <FormCard title={t('settings.printer.title')} description={t('settings.printer.description')}>
          <div className="grid gap-5 md:grid-cols-2">
            <SectionHeading>
              <Cable className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.printer.transport')}
            </SectionHeading>
            <div className="space-y-2 md:col-span-2">
              <Controller
                control={control}
                name="transport"
                render={({ field }) => (
                  <Segmented<PrinterTransport>
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                    fullWidth
                    ariaLabel={t('settings.printer.transport')}
                    className="max-w-full overflow-x-auto scrollbar-none"
                    options={TRANSPORTS.map((v) => ({ value: v, label: t(`settings.printer.transports.${v}`), icon: TRANSPORT_ICON[v] }))}
                  />
                )}
              />
              <p className="text-xs text-text-muted">{t(`settings.printer.transportHint.${transport}`)}</p>
            </div>

            {transport === 'NETWORK' ? (
              <>
                <Field id="printer-host" label={t('settings.printer.host')} required error={errors.host?.message}>
                  <Input id="printer-host" inputMode="url" placeholder={t('settings.printer.hostPlaceholder')} className="font-mono" {...register('host')} {...fieldAria('printer-host', errors.host?.message)} />
                </Field>
                <Field id="printer-port" label={t('settings.printer.port')} error={errors.port?.message}>
                  <Input id="printer-port" type="number" inputMode="numeric" min={1} max={65535} className="tabular" {...register('port', { valueAsNumber: true })} {...fieldAria('printer-port', errors.port?.message)} />
                </Field>
              </>
            ) : null}

            {transport === 'QZ' ? (
              <div className="space-y-3 md:col-span-2">
                <Field id="printer-qz" label={t('settings.printer.qzPrinterName')} error={errors.qzPrinterName?.message} hint={t('settings.printer.qzHint')}>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input id="printer-qz" maxLength={120} className="flex-1" {...register('qzPrinterName')} {...fieldAria('printer-qz', errors.qzPrinterName?.message, true)} />
                    <Button type="button" variant="outline" onClick={loadQz} loading={qzLoading} className="sm:w-auto">
                      {qzLoading ? null : <RefreshCw aria-hidden="true" />}
                      {t('settings.printer.qzPick')}
                    </Button>
                  </div>
                </Field>
                {qzPrinters.length > 0 ? (
                  <ul className="flex flex-wrap gap-2" aria-label={t('settings.printer.qzPick')}>
                    {qzPrinters.map((p) => (
                      <li key={p}>
                        <button
                          type="button"
                          onClick={() => setValue('qzPrinterName', p, { shouldDirty: true, shouldValidate: true })}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            values.qzPrinterName === p ? 'border-primary/40 bg-primary/10 text-accent' : 'border-line bg-bg-elevated text-text-muted hover:text-text',
                          )}
                          aria-pressed={values.qzPrinterName === p}
                        >
                          {p}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {transport === 'WEBUSB' ? (
              <div className="space-y-3 rounded-lg border border-line bg-bg-elevated/60 p-4 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{t('settings.printer.usb.title')}</div>
                    <div className="text-xs text-text-muted">
                      {t('settings.printer.usb.current')}:{' '}
                      <span className={cn('font-mono', last.webUsbDeviceName ? 'text-text' : 'text-text-muted')}>{last.webUsbDeviceName ?? t('settings.printer.usb.none')}</span>
                    </div>
                  </div>
                  {last.webUsbDeviceName ? (
                    <Button type="button" variant="ghost" size="sm" onClick={forgetUsb} disabled={usbBusy}>
                      <Trash2 aria-hidden="true" />
                      {t('settings.printer.usb.forget')}
                    </Button>
                  ) : null}
                </div>
                {printer.webUsbSupported ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => pickUsb(false)} loading={usbBusy}>
                      {usbBusy ? null : <Usb aria-hidden="true" />}
                      {t('settings.printer.usb.pick')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => pickUsb(true)} disabled={usbBusy}>
                      {t('settings.printer.usb.pickAny')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-warning">{t('settings.printer.usb.unsupported')}</p>
                )}
              </div>
            ) : null}

            <SectionHeading>
              <Printer className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.printer.paperWidth')}
            </SectionHeading>
            <Field id="printer-paper" label={t('settings.printer.paperWidth')} error={errors.paperWidth?.message}>
              <Controller
                control={control}
                name="paperWidth"
                render={({ field }) => (
                  <Segmented<'58' | '80'>
                    value={String(field.value) as '58' | '80'}
                    onChange={(v) => field.onChange(Number(v))}
                    disabled={disabled}
                    variant="accent"
                    ariaLabel={t('settings.printer.paperWidth')}
                    options={[
                      { value: '58', label: `58 ${t('settings.printer.paperUnit')}` },
                      { value: '80', label: `80 ${t('settings.printer.paperUnit')}` },
                    ]}
                  />
                )}
              />
            </Field>
            <Field id="printer-codepage" label={t('settings.printer.codepage')} error={errors.codepage?.message} hint={t('settings.printer.codepageHint')}>
              <Controller
                control={control}
                name="codepage"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger id="printer-codepage" {...fieldAria('printer-codepage', errors.codepage?.message, true)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODEPAGES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="printer-avg" label={t('settings.printer.avgServiceMinutes')} error={errors.avgServiceMinutes?.message} hint={t('settings.printer.avgHint')}>
              <InputWithUnit unit={t('common.minutes')}>
                <Input id="printer-avg" type="number" inputMode="numeric" min={1} max={120} className="tabular" {...register('avgServiceMinutes', { valueAsNumber: true })} {...fieldAria('printer-avg', errors.avgServiceMinutes?.message, true)} />
              </InputWithUnit>
            </Field>
            <Field id="printer-footer" label={t('settings.printer.receiptFooter')} error={errors.receiptFooter?.message}>
              <Input id="printer-footer" maxLength={200} {...register('receiptFooter')} {...fieldAria('printer-footer', errors.receiptFooter?.message)} />
            </Field>

            <SectionHeading>{t('common.print')}</SectionHeading>
            <Controller
              control={control}
              name="autoPrintTicket"
              render={({ field }) => (
                <SwitchRow id="printer-auto-ticket" label={t('settings.printer.autoPrintTicket')} hint={t('settings.printer.autoPrintTicketHint')} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
              )}
            />
            <Controller
              control={control}
              name="autoPrintReceipt"
              render={({ field }) => (
                <SwitchRow id="printer-auto-receipt" label={t('settings.printer.autoPrintReceipt')} hint={t('settings.printer.autoPrintReceiptHint')} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
              )}
            />
            <Controller
              control={control}
              name="receiptQr"
              render={({ field }) => (
                <SwitchRow id="printer-qr" label={t('settings.printer.receiptQr')} hint={t('settings.printer.receiptQrHint')} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
              )}
            />
            <Controller
              control={control}
              name="cut"
              render={({ field }) => <SwitchRow id="printer-cut" label={t('settings.printer.cut')} hint={t('settings.printer.cutHint')} checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />}
            />
          </div>
        </FormCard>
      </fieldset>

      <FormCard
        title={t('settings.printer.test.title')}
        description={transport === 'BROWSER' ? t('settings.printer.test.browserHint') : t('settings.printer.test.hint')}
        actions={
          <Button
            type="button"
            variant="gradient"
            onClick={() => printer.testPrint({ locale, clinicName })}
            loading={printer.isPrinting}
            disabled={transport === 'BROWSER' || !overrideParsed}
          >
            {printer.isPrinting ? null : <Printer aria-hidden="true" />}
            {t('settings.printer.test.button')}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">{t('settings.printer.last.title')}:</span>
          {last.lastError ? (
            <Badge variant="danger" className="max-w-full whitespace-normal">
              {t('settings.printer.last.error', { error: last.lastError })}
            </Badge>
          ) : last.lastTransportOk ? (
            <Badge variant="success">{t('settings.printer.last.ok', { transport: t(`settings.printer.transports.${last.lastTransportOk}`) })}</Badge>
          ) : (
            <Badge variant="outline">{t('settings.printer.last.none')}</Badge>
          )}
          {last.lastPrintAt ? <span className="tabular text-xs text-text-muted">{fmtDateTime(last.lastPrintAt, locale)}</span> : null}
        </div>
      </FormCard>

      {canWrite ? <SaveBar dirty={isDirty} saving={isSubmitting || update.isPending} hasErrors={hasErrors} onDiscard={() => reset()} formId={FORM_ID} /> : null}
    </form>
  );
}

export function PrinterFormSkeleton() {
  return (
    <div className="card-surface space-y-5 p-6" aria-busy="true" aria-hidden="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

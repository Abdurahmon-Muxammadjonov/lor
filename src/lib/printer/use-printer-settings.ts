'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, qs } from '@/lib/api/client';
import { PrinterSettingsSchema, type PrinterSettings } from '@/lib/settings/types';
import { useLocale } from '@/i18n/client';
import { hydratePrinterStore, usePrinterStore } from '@/stores/use-printer-store';
import { isPrinterError } from './errors';
import { pm, printerErrorText } from './messages';
import { printReceipt, printTicket, testPrint, type TestPrintOptions } from './print';
import { QzTransport } from './transports/qz';
import { WebUsbTransport, isWebUsbSupported } from './transports/webusb';
import type { PrintResult, PrinterStatus, ReceiptData, TicketData } from './types';

/**
 * Printer sozlamalari va chop etish hooklari (client).
 *
 *  usePrinterSettings({ key?, enabled? }) → { settings, isLoading, isError, refetch }
 *    GET /api/settings/printer ([settings] moduli; kiosk uchun `?key=<kioskKey>`), kalit ['settings','printer'].
 *    Xato/yoʻq boʻlsa — `PrinterSettingsSchema` defaultlari (BROWSER, 58 mm, CP866 …).
 *
 *  usePrinter(opts?) → { printTicket, printReceipt, testPrint, requestUsbDevice, listQzPrinters, status, isPrinting, settings, isLoading }
 *    print.ts ni oʻrab, natijani sonner toast bilan koʻrsatadi (ikki tilli, `messages.ts`).
 */

export const PRINTER_SETTINGS_KEY = ['settings', 'printer'] as const;
export const PRINTER_SETTINGS_URL = '/api/settings/printer';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = PrinterSettingsSchema.parse({});

/** Har qanday javobni toʻliq PrinterSettings ga keltiradi (yetishmagan maydonlar — default) */
export function normalizePrinterSettings(input: unknown): PrinterSettings {
  const r = PrinterSettingsSchema.safeParse(input ?? {});
  return r.success ? r.data : DEFAULT_PRINTER_SETTINGS;
}

export interface UsePrinterSettingsOptions {
  /** Kiosk/ekran (sessiyasiz) — `?key=<clinic.kioskKey>` */
  key?: string | null;
  enabled?: boolean;
}

export function usePrinterSettings(opts: UsePrinterSettingsOptions = {}) {
  const key = opts.key ?? null;
  const query = useQuery({
    queryKey: key ? ([...PRINTER_SETTINGS_KEY, key] as const) : PRINTER_SETTINGS_KEY,
    queryFn: async () => normalizePrinterSettings(await api.get<unknown>(PRINTER_SETTINGS_URL + qs({ key }))),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: opts.enabled ?? true,
  });
  const settings = useMemo(() => query.data ?? DEFAULT_PRINTER_SETTINGS, [query.data]);
  return {
    settings,
    isLoading: query.isLoading,
    isError: query.isError,
    /** Sozlamalar serverdan olinganmi (aks holda defaultlar) */
    isReady: query.isSuccess,
    refetch: query.refetch,
  };
}

export interface UsePrinterOptions extends UsePrinterSettingsOptions {
  /** Muvaffaqiyat toastlarini oʻchirish (kiosk ekrani oʻzi koʻrsatadi) */
  silentSuccess?: boolean;
  /** Barcha toastlarni oʻchirish */
  silent?: boolean;
  /** Sozlamalar tashqaridan (masalan sozlamalar formasi — saqlanmagan qiymatlar bilan test) */
  settingsOverride?: PrinterSettings | null;
}

export interface UsePrinterResult {
  settings: PrinterSettings;
  isLoading: boolean;
  status: PrinterStatus;
  isPrinting: boolean;
  /** Oxirgi natija */
  lastResult: PrintResult | null;
  printTicket: (data: TicketData, fallbackUrl: string) => Promise<PrintResult>;
  printReceipt: (data: ReceiptData, fallbackUrl: string) => Promise<PrintResult>;
  testPrint: (opts?: TestPrintOptions) => Promise<PrintResult>;
  /** WebUSB: brauzer qurilma tanlash oynasi (faqat click ichida). Natija — qurilma nomi */
  requestUsbDevice: (any?: boolean) => Promise<string | null>;
  /** QZ Tray: ulanib printerlar roʻyxatini olish */
  listQzPrinters: () => Promise<string[]>;
  webUsbSupported: boolean;
  /** Xato kodini joriy tilga oʻgirish (UI uchun) */
  errorText: (result: PrintResult | null) => string;
}

export function usePrinter(opts: UsePrinterOptions = {}): UsePrinterResult {
  const { locale } = useLocale();
  const { settings: fetched, isLoading } = usePrinterSettings(opts);
  const settings = opts.settingsOverride ?? fetched;
  const [status, setStatus] = useState<PrinterStatus>('idle');
  const [lastResult, setLastResult] = useState<PrintResult | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    hydratePrinterStore();
    return () => {
      mounted.current = false;
    };
  }, []);

  const d = pm(locale);
  const silent = opts.silent ?? false;
  const silentSuccess = silent || (opts.silentSuccess ?? false);

  const errorText = useCallback(
    (result: PrintResult | null): string => {
      if (!result || result.ok) return '';
      return printerErrorText(locale, result.errorCode);
    },
    [locale],
  );

  const report = useCallback(
    (result: PrintResult, successText: string): PrintResult => {
      if (mounted.current) {
        setLastResult(result);
        setStatus(result.ok ? (result.fallback ? 'fallback' : 'ok') : 'error');
      }
      if (result.ok) {
        if (result.fallback) {
          if (!silent) toast.warning(d.toast.fallbackUsed, { description: printerErrorText(locale, result.errorCode) });
        } else if (!silentSuccess) {
          toast.success(successText);
        }
      } else if (!silent) {
        const desc = printerErrorText(locale, result.errorCode);
        toast.error(d.toast.failed, { description: result.error && result.error !== desc ? `${desc} (${result.error})` : desc });
      }
      return result;
    },
    [d, locale, silent, silentSuccess],
  );

  const run = useCallback(
    async (job: () => Promise<PrintResult>, successText: string): Promise<PrintResult> => {
      if (mounted.current) setStatus('printing');
      const result = await job();
      return report(result, successText);
    },
    [report],
  );

  const doPrintTicket = useCallback(
    (data: TicketData, fallbackUrl: string) =>
      run(() => printTicket({ ...data, locale: data.locale ?? locale }, settings, fallbackUrl), d.toast.ticketPrinted),
    [run, settings, locale, d],
  );

  const doPrintReceipt = useCallback(
    (data: ReceiptData, fallbackUrl: string) => run(() => printReceipt(data, settings, fallbackUrl), d.toast.receiptPrinted),
    [run, settings, d],
  );

  const doTestPrint = useCallback(
    async (testOpts: TestPrintOptions = {}): Promise<PrintResult> => {
      if (settings.transport === 'BROWSER') {
        const result: PrintResult = {
          ok: false,
          transport: 'BROWSER',
          error: 'NO_RAW_TRANSPORT',
          errorCode: 'NO_RAW_TRANSPORT',
        };
        if (mounted.current) {
          setLastResult(result);
          setStatus('idle');
        }
        if (!silent) toast.info(d.toast.browserTestHint);
        return result;
      }
      return run(() => testPrint(settings, { ...testOpts, locale: testOpts.locale ?? locale }), d.toast.testPrinted);
    },
    [run, settings, locale, d, silent],
  );

  const requestUsbDevice = useCallback(
    async (any = false): Promise<string | null> => {
      try {
        const device = await WebUsbTransport.shared().requestDevice({ any });
        const transport = WebUsbTransport.shared();
        await transport.open(device);
        const name = transport.deviceName;
        if (mounted.current) setStatus('ok');
        return name;
      } catch (e) {
        const text = printerErrorText(locale, isPrinterError(e) ? e.code : 'NO_DEVICE');
        if (mounted.current) setStatus('error');
        if (!silent) toast.error(text);
        return null;
      }
    },
    [locale, silent],
  );

  const listQzPrinters = useCallback(async (): Promise<string[]> => {
    try {
      return await QzTransport.shared().listPrinters();
    } catch (e) {
      if (!silent) toast.error(printerErrorText(locale, isPrinterError(e) ? e.code : 'QZ_CONNECT_FAILED'));
      return [];
    }
  }, [locale, silent]);

  return {
    settings,
    isLoading,
    status,
    isPrinting: status === 'printing',
    lastResult,
    printTicket: doPrintTicket,
    printReceipt: doPrintReceipt,
    testPrint: doTestPrint,
    requestUsbDevice,
    listQzPrinters,
    webUsbSupported: isWebUsbSupported(),
    errorText,
  };
}

/** Sozlamalar oʻzgarganda (settings sahifasi saqlagach) keshni yangilash uchun */
export function useInvalidatePrinterSettings(): () => Promise<void> {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: PRINTER_SETTINGS_KEY }), [qc]);
}

/** Store dagi oxirgi transport holati (koʻrsatish uchun) */
export function usePrinterLastStatus() {
  const lastTransportOk = usePrinterStore((s) => s.lastTransportOk);
  const lastPrintAt = usePrinterStore((s) => s.lastPrintAt);
  const lastError = usePrinterStore((s) => s.lastError);
  const webUsbDeviceName = usePrinterStore((s) => s.webUsbDeviceName);
  const qzConnected = usePrinterStore((s) => s.qzConnected);
  useEffect(() => {
    hydratePrinterStore();
  }, []);
  return { lastTransportOk, lastPrintAt, lastError, webUsbDeviceName, qzConnected };
}

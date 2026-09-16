'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/client';
import { usePrinter } from '@/lib/printer/use-printer-settings';
import type { PrintResult, TicketData } from '@/lib/printer/types';
import { ticketPrintUrl } from '@/lib/queue/ticket';
import { usePrintTicketData } from '@/lib/queue/queries';

/**
 * Dashboard uchun talon chop etish: `POST /api/queue/[id]/print` (printedAt + TicketData) → printer kutubxonasi.
 * Tayyor TicketData boʻlsa (yangi talon javobi) `printData` bilan toʻgʻridan-toʻgʻri.
 */
export function useTicketPrinter() {
  const { locale, t } = useLocale();
  const printer = usePrinter({ silentSuccess: false });
  const fetchData = usePrintTicketData();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const printData = React.useCallback(
    async (queueId: string, data: TicketData): Promise<PrintResult> => {
      setBusyId(queueId);
      try {
        return await printer.printTicket({ ...data, locale: data.locale ?? locale }, ticketPrintUrl(queueId));
      } finally {
        setBusyId(null);
      }
    },
    [printer, locale],
  );

  const printById = React.useCallback(
    async (queueId: string): Promise<PrintResult | null> => {
      setBusyId(queueId);
      try {
        const res = await fetchData.mutateAsync({ id: queueId, locale });
        return await printer.printTicket(res.ticketData, ticketPrintUrl(queueId));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('queue.errors.generic'));
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [fetchData, printer, locale, t],
  );

  return {
    printData,
    printById,
    busyId,
    isPrinting: printer.isPrinting || fetchData.isPending,
    settings: printer.settings,
    status: printer.status,
  };
}

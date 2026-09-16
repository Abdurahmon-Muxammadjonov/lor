'use client';

import * as React from 'react';
import { Printer } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ticketDataFor } from '@/lib/queue/ticket';
import type { QueueRowDTO } from '@/lib/queue/types';
import { TicketPreview } from './ticket-preview';
import { useTicketPrinter } from './use-ticket-printer';

export interface ReprintDialogProps {
  row: QueueRowDTO | null;
  onOpenChange: (open: boolean) => void;
  clinic: { name: string; phone: string; ticketFooter: string };
}

/** Talonni qayta chop etish: HTML koʻrinish + printerga yuborish (POST /api/queue/[id]/print → printTicket) */
export function ReprintDialog({ row, onOpenChange, clinic }: ReprintDialogProps) {
  const { t, locale } = useLocale();
  const printer = useTicketPrinter();
  const open = row !== null;

  // Koʻrinish uchun mahalliy TicketData (oldindagilar soni serverdan chop etishda aniqlanadi)
  const preview = React.useMemo(() => (row ? ticketDataFor({ ...row, ahead: 0, waitMin: 0 }, clinic, locale) : null), [row, clinic, locale]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{t('queue.dialog.reprint.title')}</DialogTitle>
          <DialogDescription>{t('queue.dialog.reprint.description')}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-line bg-white/95 p-2 shadow-card" aria-label={t('queue.dialog.reprint.preview')}>
          {preview ? <TicketPreview data={preview} paperWidth={printer.settings.paperWidth} /> : <Skeleton className="mx-auto h-64 w-[58mm]" />}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button
            type="button"
            onClick={async () => {
              if (!row) return;
              const r = await printer.printById(row.id);
              if (r?.ok) onOpenChange(false);
            }}
            loading={row ? printer.busyId === row.id : false}
          >
            <Printer aria-hidden="true" />
            {t('queue.actions.print')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

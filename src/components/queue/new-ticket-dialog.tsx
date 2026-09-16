'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Printer, Ticket } from 'lucide-react';
import type { QueueType } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import type { QueueSettings } from '@/lib/settings/types';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCreateTicket } from '@/lib/queue/queries';
import { QUEUE_TYPES, type CreatedTicketDTO } from '@/lib/queue/types';
import { queueNumberFor } from '@/lib/queue/ticket';
import { ANY_DOCTOR, DoctorSelect } from './doctor-select';
import { PatientPicker, type PatientLite } from './patient-picker';
import { QUEUE_TYPE_META, QueueTypeIcon } from './queue-type-meta';
import { TicketPreview } from './ticket-preview';
import { useTicketPrinter } from './use-ticket-printer';

export interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: QueueSettings;
  /** Standart: printer sozlamasidagi autoPrintTicket */
  defaultType?: QueueType;
  onCreated?: (ticket: CreatedTicketDTO) => void;
}

const VISIT_TYPES = new Set<QueueType>(['DOCTOR', 'RECHECK']);

/** "Yangi talon" — tur, ixtiyoriy bemor va shifokor, chop etish; natija: raqam + talon koʻrinishi */
export function NewTicketDialog({ open, onOpenChange, settings, defaultType = 'DOCTOR', onCreated }: NewTicketDialogProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const ids = React.useId();
  const create = useCreateTicket();
  const printer = useTicketPrinter();
  const [type, setType] = React.useState<QueueType>(defaultType);
  const [patient, setPatient] = React.useState<PatientLite | null>(null);
  const [doctorId, setDoctorId] = React.useState(ANY_DOCTOR);
  const [print, setPrint] = React.useState(true);
  const [result, setResult] = React.useState<CreatedTicketDTO | null>(null);

  const types = React.useMemo(() => {
    const enabled = QUEUE_TYPES.filter((x) => settings.enabledTypes.includes(x));
    return enabled.length ? enabled : [...QUEUE_TYPES];
  }, [settings.enabledTypes]);

  React.useEffect(() => {
    if (open) {
      setType(types.includes(defaultType) ? defaultType : (types[0] ?? 'DOCTOR'));
      setPatient(null);
      setDoctorId(ANY_DOCTOR);
      setResult(null);
      setPrint(printer.settings.autoPrintTicket);
    }
    // printer.settings faqat boshlangʻich qiymat uchun
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultType, types]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await create.mutateAsync({
        type,
        patientId: patient?.id ?? null,
        doctorId: VISIT_TYPES.has(type) && doctorId !== ANY_DOCTOR ? doctorId : null,
        locale,
      });
      setResult(created);
      onCreated?.(created);
      toast.success(t('queue.toast.created', { number: created.number }));
      if (print) void printer.printData(created.id, created.ticketData);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t('queue.errors.generic'));
    }
  };

  const busy = create.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading">{t('queue.dialog.new.result')}</DialogTitle>
              <DialogDescription>{t('queue.dialog.new.created')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4">
              <motion.div
                initial={reduced ? false : { scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="text-center"
              >
                <div className={cn('tabular font-heading text-6xl font-extrabold tracking-tight', QUEUE_TYPE_META[result.type].text)}>{result.number}</div>
                <div className="mt-1 text-sm text-text-muted">
                  {t('queue.ticket.ahead', { n: result.ahead })} · {t('queue.ticket.wait', { n: result.waitMin })}
                </div>
              </motion.div>
              <div className="max-h-[42vh] overflow-auto rounded-lg border border-line bg-white/95 p-2 shadow-card">
                <TicketPreview data={result.ticketData} paperWidth={printer.settings.paperWidth} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => void printer.printData(result.id, result.ticketData)} loading={printer.busyId === result.id}>
                <Printer aria-hidden="true" />
                {t('queue.actions.printAgain')}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setResult(null)}>
                  {t('queue.dialog.new.another')}
                </Button>
                <Button type="button" onClick={() => onOpenChange(false)}>
                  {t('queue.dialog.new.close')}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle className="font-heading">{t('queue.dialog.new.title')}</DialogTitle>
              <DialogDescription>{t('queue.dialog.new.description')}</DialogDescription>
            </DialogHeader>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-text">{t('queue.dialog.new.type')}</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('queue.dialog.new.type')}>
                {types.map((x) => {
                  const meta = QUEUE_TYPE_META[x];
                  const selected = x === type;
                  return (
                    <button
                      key={x}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setType(x)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected ? cn(meta.border, meta.soft) : 'border-line bg-bg-elevated hover:border-[#2B3A57]',
                      )}
                    >
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', meta.soft, meta.text)}>
                        <QueueTypeIcon type={x} className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text">{t(`common.queueType.${x}`)}</span>
                        <span className="tabular block text-xs text-text-muted">{queueNumberFor(x, 1, settings).replace(/\d+$/, '···')}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor={`${ids}-patient`}>{t('queue.dialog.new.patientOptional')}</Label>
              <PatientPicker id={`${ids}-patient`} value={patient} onChange={setPatient} disabled={busy} />
            </div>

            {VISIT_TYPES.has(type) ? (
              <div className="space-y-2">
                <Label htmlFor={`${ids}-doctor`}>{t('queue.dialog.new.doctor')}</Label>
                <DoctorSelect id={`${ids}-doctor`} value={doctorId} onChange={setDoctorId} disabled={busy} enabled={open} />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Checkbox id={`${ids}-print`} checked={print} onCheckedChange={(v) => setPrint(v === true)} disabled={busy} />
              <Label htmlFor={`${ids}-print`} className="cursor-pointer font-normal">
                {t('queue.dialog.new.printTicket')}
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="gradient" loading={busy}>
                <Ticket aria-hidden="true" />
                {t('queue.dialog.new.create')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

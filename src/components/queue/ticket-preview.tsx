import { cn } from '@/lib/utils';
import { fill, pm } from '@/lib/printer/messages';
import type { TicketData } from '@/lib/printer/types';

export interface TicketPreviewProps {
  data: TicketData;
  /** 58 (default) yoki 80 mm */
  paperWidth?: 58 | 80;
  className?: string;
  id?: string;
}

/**
 * Talonning HTML koʻrinishi — ESC/POS shabloni (`buildTicket`) bilan bir xil tartib.
 * Server-safe: chop etish sahifasi (/print/ticket/[id]) va dashboard dialoglarida ishlatiladi.
 * Oq "qogʻoz" ustida qora matn — ekranda ham, chop etishda ham.
 */
export function TicketPreview({ data, paperWidth = 58, className, id }: TicketPreviewProps) {
  const L = pm(data.locale ?? 'uz').ticket;
  const rows: [string, string][] = [
    [L.service, data.service],
    ...(data.room ? ([[L.room, data.room]] as [string, string][]) : []),
    [L.date, data.date],
    [L.time, data.time],
    [L.ahead, fill(L.aheadUnit, { n: Math.max(0, Math.round(data.ahead)) })],
    [L.wait, fill(L.waitUnit, { n: Math.max(0, Math.round(data.waitMin)) })],
  ];
  return (
    <div
      id={id}
      data-ticket-preview
      className={cn(
        'mx-auto bg-white px-3 py-4 font-mono text-[11px] leading-snug text-black',
        paperWidth === 80 ? 'w-[80mm]' : 'w-[58mm]',
        className,
      )}
      style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace' }}
    >
      <div className="text-center">
        {data.logoText ? <div className="text-xl font-bold uppercase tracking-widest">{data.logoText}</div> : null}
        <div className="text-[13px] font-bold uppercase leading-tight">{data.clinicName}</div>
        <div className="mt-2 text-[10px] uppercase tracking-wide">{L.title}</div>
        <div className="my-1 text-[44px] font-black leading-none tracking-tight">{data.number}</div>
      </div>
      <div className="my-2 border-t border-dashed border-black" aria-hidden="true" />
      <dl className="space-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="shrink-0">{k}:</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="my-2 border-t border-dashed border-black" aria-hidden="true" />
      <div className="text-center text-[10px]">
        {data.phone ? (
          <div>
            {L.phone}: {data.phone}
          </div>
        ) : null}
        {data.footer ? <div className="mt-1 whitespace-pre-line">{data.footer}</div> : null}
      </div>
    </div>
  );
}

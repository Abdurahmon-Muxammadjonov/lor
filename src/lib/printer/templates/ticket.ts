import type { PrinterSettings } from '@/lib/settings/types';
import { EscPos } from '../escpos';
import { fill, pm } from '../messages';
import type { TicketData } from '../types';

/**
 * Navbat taloni (58/80 mm):
 *
 *        [LOGO]                 ← logoText (ixtiyoriy, 2×2)
 *     LOR KLINIKA               ← clinicName (1×2, qalin)
 *    NAVBAT RAQAMI / НОМЕР ОЧЕРЕДИ
 *        A-012                  ← 3×3 qalin
 *  --------------------------------
 *  Xizmat:          Shifokor qabuli
 *  Xona:                        101
 *  Sana:                 15.09.2026
 *  Vaqt:                      14:32
 *  Oldingizda:              3 kishi
 *  Taxminiy kutish:     ~24 daqiqa
 *  --------------------------------
 *        Tel: +998 71 200 00 00
 *        Tashrifingiz uchun rahmat!
 */
export function buildTicket(data: TicketData, settings: PrinterSettings): Uint8Array {
  const L = pm(data.locale ?? 'uz').ticket;
  const p = new EscPos({ paperWidth: settings.paperWidth, codepage: settings.codepage });

  p.init().align('center');

  if (data.logoText?.trim()) {
    p.bold(true).size(2, 2).line(data.logoText.trim()).size(1, 1).bold(false);
  }

  p.bold(true).size(1, 2).paragraph(data.clinicName).size(1, 1).bold(false);
  p.feed(1);
  p.line(L.title);
  p.feed(1);
  p.bold(true).size(3, 3).line(data.number).size(1, 1).bold(false);
  p.feed(1);

  p.hr();
  p.align('left');
  p.row(`${L.service}:`, data.service);
  if (data.room?.trim()) p.row(`${L.room}:`, data.room.trim());
  p.row(`${L.date}:`, data.date);
  p.row(`${L.time}:`, data.time);
  p.row(`${L.ahead}:`, fill(L.aheadUnit, { n: Math.max(0, Math.round(data.ahead)) }));
  p.row(`${L.wait}:`, fill(L.waitUnit, { n: Math.max(0, Math.round(data.waitMin)) }));
  p.hr();

  p.align('center');
  if (data.phone?.trim()) p.line(`${L.phone}: ${data.phone.trim()}`);
  if (data.footer?.trim()) p.paragraph(data.footer.trim());

  p.feed(3);
  if (settings.cut) p.cut(true);
  return p.build();
}

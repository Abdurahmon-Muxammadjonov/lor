import { describe, expect, it } from 'vitest';
import type { QueueType } from '@prisma/client';
import { queue as queueMessages } from '@/i18n/messages/queue';
import type { Tree } from '@/i18n/types';
import { QueueSettingsSchema, parseClinicSettings } from '@/lib/settings/types';
import { queueNumberFor, queuePrefix, queueTypeLabel, ticketDataFor, ticketPrintUrl, tzDate, tzTime } from '@/lib/queue/ticket';
import { aheadOf, boardRows, computeStats, currentTicketFor, displayCalled, groupBoard, waitedMinutes, waitingByType } from '@/lib/queue/board';
import { checkRateLimit, resetRateLimits } from '@/lib/queue/rate-limit';
import { CreateTicketSchema, DateKeySchema, KioskTicketSchema, NextTicketSchema, RecallSchema } from '@/lib/queue/schemas';
import type { QueueRowDTO } from '@/lib/queue/types';
import { classifyRowEvent, publishQueueEvent, queueEventFromRow, queueListenerCount, subscribeQueueEvents } from '@/lib/realtime/queue-events';
import { formatSseMessage, makeSse } from '@/lib/realtime/stream';
import { queueEventFromSupabase, stateUrlFor } from '@/lib/realtime/use-queue-realtime';
import { spellNumber, toUzCyrillic } from '@/lib/queue/display-audio';

const settings = QueueSettingsSchema.parse({});

function row(partial: Partial<QueueRowDTO> & { id: string }): QueueRowDTO {
  const createdAt = partial.createdAt ?? '2026-09-15T05:00:00.000Z';
  return {
    id: partial.id,
    clinicId: 'c1',
    date: '2026-09-15T00:00:00.000Z',
    number: partial.number ?? 'A-001',
    prefix: partial.prefix ?? 'A',
    seq: partial.seq ?? 1,
    type: partial.type ?? 'DOCTOR',
    patientId: partial.patientId ?? null,
    doctorId: partial.doctorId ?? null,
    room: partial.room ?? null,
    status: partial.status ?? 'WAITING',
    calledAt: partial.calledAt ?? null,
    servedAt: partial.servedAt ?? null,
    doneAt: partial.doneAt ?? null,
    printedAt: partial.printedAt ?? null,
    createdAt,
    updatedAt: partial.updatedAt ?? createdAt,
    patient: partial.patient ?? null,
    doctor: partial.doctor ?? null,
    visit: partial.visit ?? null,
  };
}

function keysOf(tree: Tree, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(path);
    else out.push(...keysOf(v, path));
  }
  return out.sort();
}

describe('i18n queue', () => {
  it('uz va ru kalitlari bir xil, apostrof toʻgʻri', () => {
    expect(keysOf(queueMessages.uz as Tree)).toEqual(keysOf(queueMessages.ru as Tree));
    const all = JSON.stringify(queueMessages.uz);
    expect(all).not.toMatch(/[a-zA-Z]'[a-zA-Z]/); // o' / g' oʻrniga ʻ
    expect(queueMessages.uz.kiosk.welcome).toBe('Xush kelibsiz!');
    expect(queueMessages.ru.kiosk.welcome).toBe('Добро пожаловать!');
  });
});

describe('ticketDataFor', () => {
  const clinic = { name: 'Shifo LOR', phone: '+998712000000', ticketFooter: 'Sogʻ boʻling!' };

  it('Toshkent vaqti boʻyicha sana/vaqt va tarjima qilingan xizmat nomi', () => {
    // 2026-09-15 05:04 UTC = 10:04 Toshkent
    const data = ticketDataFor({ number: 'A-012', type: 'DOCTOR', createdAt: '2026-09-15T05:04:00.000Z', ahead: 3, waitMin: 24 }, clinic, 'uz');
    expect(data).toMatchObject({
      clinicName: 'Shifo LOR',
      phone: '+998 71 200 00 00',
      number: 'A-012',
      service: 'Shifokor qabuli',
      date: '15.09.2026',
      time: '10:04',
      ahead: 3,
      waitMin: 24,
      footer: 'Sogʻ boʻling!',
      locale: 'uz',
    });
    expect(data.room).toBeUndefined();
  });

  it('ru tilida xizmat nomi, xona shifokordan olinadi, ahead/waitMin default 0', () => {
    const data = ticketDataFor({ number: 'B-003', type: 'RECHECK', createdAt: new Date('2026-09-15T18:59:30.000Z'), doctor: { room: '3' } }, clinic, 'ru');
    expect(data.service).toBe('Повторный осмотр');
    expect(data.room).toBe('3');
    expect(data.time).toBe('23:59');
    expect(data.ahead).toBe(0);
    expect(data.waitMin).toBe(0);
    expect(data.locale).toBe('ru');
  });

  it('kun chegarasi: 19:00 UTC = ertasi kun 00:00 Toshkent', () => {
    expect(tzDate('2026-09-15T19:00:00.000Z')).toBe('16.09.2026');
    expect(tzTime('2026-09-15T19:00:00.000Z')).toBe('00:00');
  });

  it('talonning oʻz xonasi shifokor xonasidan ustun', () => {
    const data = ticketDataFor({ number: 'A-001', type: 'DOCTOR', createdAt: new Date(), room: '7', doctor: { room: '3' } }, clinic, 'uz');
    expect(data.room).toBe('7');
  });

  it('chop etish sahifasi havolasi (kiosk kaliti bilan va usiz)', () => {
    expect(ticketPrintUrl('abc')).toBe('/print/ticket/abc');
    expect(ticketPrintUrl('abc', 'k 1')).toBe('/print/ticket/abc?key=k%201');
  });
});

describe('prefix mapping', () => {
  it('standart prefikslar A/B/C/D va raqam formati', () => {
    expect(queuePrefix('DOCTOR', settings)).toBe('A');
    expect(queuePrefix('RECHECK', settings)).toBe('B');
    expect(queuePrefix('LAB', settings)).toBe('C');
    expect(queuePrefix('CASHIER', settings)).toBe('D');
    expect(queueNumberFor('LAB', 7, settings)).toBe('C-007');
    expect(queueNumberFor('DOCTOR', 1234, settings)).toBe('A-1234');
  });

  it('klinika sozlamalaridagi maxsus prefikslar', () => {
    const custom = parseClinicSettings({ queue: { prefixes: { DOCTOR: 'S', CASHIER: 'K' } } }).queue;
    expect(queuePrefix('DOCTOR', custom)).toBe('S');
    expect(queuePrefix('CASHIER', custom)).toBe('K');
    expect(queuePrefix('LAB', custom)).toBe('C');
  });

  it('xizmat nomi ikki tilda', () => {
    expect(queueTypeLabel('CASHIER', 'uz')).toBe('Kassa');
    expect(queueTypeLabel('LAB', 'ru')).toBe('Лаборатория');
  });
});

describe('board grouping', () => {
  const rows: QueueRowDTO[] = [
    row({ id: 'w2', number: 'A-003', seq: 3, createdAt: '2026-09-15T05:10:00.000Z' }),
    row({ id: 'w1', number: 'A-002', seq: 2, createdAt: '2026-09-15T05:05:00.000Z' }),
    row({ id: 'c1', number: 'A-001', seq: 1, status: 'CALLED', createdAt: '2026-09-15T05:00:00.000Z', calledAt: '2026-09-15T05:12:00.000Z', doctorId: 'd1', room: '3' }),
    row({ id: 's1', number: 'B-001', prefix: 'B', type: 'RECHECK', status: 'SERVING', createdAt: '2026-09-15T04:50:00.000Z', calledAt: '2026-09-15T04:58:00.000Z', servedAt: '2026-09-15T05:00:00.000Z', doctorId: 'd1' }),
    row({ id: 'd1', number: 'C-001', prefix: 'C', type: 'LAB', status: 'DONE', createdAt: '2026-09-15T04:00:00.000Z', calledAt: '2026-09-15T04:04:00.000Z', servedAt: '2026-09-15T04:05:00.000Z', doneAt: '2026-09-15T04:15:00.000Z' }),
    row({ id: 'k1', number: 'A-000', seq: 0, status: 'SKIPPED', createdAt: '2026-09-15T04:30:00.000Z', updatedAt: '2026-09-15T04:40:00.000Z' }),
    row({ id: 'w3', number: 'D-001', prefix: 'D', type: 'CASHIER', createdAt: '2026-09-15T05:07:00.000Z' }),
  ];

  it('ustunlarga ajratadi va tartiblaydi', () => {
    const board = groupBoard(rows, '2026-09-15', new Date('2026-09-15T05:20:00.000Z'));
    expect(board.dateKey).toBe('2026-09-15');
    expect(board.waiting.map((r) => r.id)).toEqual(['w1', 'w3', 'w2']);
    expect(board.called.map((r) => r.id)).toEqual(['c1']);
    expect(board.serving.map((r) => r.id)).toEqual(['s1']);
    expect(board.done.map((r) => r.id)).toEqual(['d1']);
    expect(board.skipped.map((r) => r.id)).toEqual(['k1']);
    expect(boardRows(board)).toHaveLength(rows.length);
  });

  it('statistika: hisoblar, oʻrtacha kutish va qabul', () => {
    const stats = computeStats(rows);
    expect(stats).toMatchObject({ waiting: 3, called: 1, serving: 1, done: 1, skipped: 1, total: 7 });
    // kutish: c1 12 daqiqa, s1 8 daqiqa, d1 4 daqiqa → 8
    expect(stats.avgWaitMin).toBe(8);
    // qabul: faqat d1 (10 daqiqa)
    expect(stats.avgServiceMin).toBe(10);
    expect(stats.byType.DOCTOR).toEqual({ waiting: 2, active: 1, done: 0, total: 4 });
    expect(stats.byType.RECHECK.active).toBe(1);
    expect(stats.byType.LAB.done).toBe(1);
    expect(stats.byType.CASHIER.waiting).toBe(1);
  });

  it('boʻsh taxta: oʻrtacha qiymatlar null', () => {
    const stats = computeStats([]);
    expect(stats.avgWaitMin).toBeNull();
    expect(stats.avgServiceMin).toBeNull();
    expect(stats.total).toBe(0);
  });

  it('aheadOf: shu turdagi oldingi WAITING lar', () => {
    const w2 = rows.find((r) => r.id === 'w2')!;
    expect(aheadOf(rows, w2)).toBe(1); // faqat w1 (A-002); c1 CALLED, w3 boshqa tur
    const w1 = rows.find((r) => r.id === 'w1')!;
    expect(aheadOf(rows, w1)).toBe(0);
  });

  it('tablo: oxirgi chaqiruvlar va kutayotganlar', () => {
    const called = displayCalled(rows, 5);
    expect(called.map((c) => c.id)).toEqual(['c1', 's1']);
    expect(called[0]).toMatchObject({ number: 'A-001', room: '3', status: 'CALLED' });
    expect(waitingByType(rows)).toEqual({ DOCTOR: 2, RECHECK: 0, LAB: 0, CASHIER: 1 });
  });

  it('shifokorning joriy taloni va kutish daqiqalari', () => {
    const board = groupBoard(rows, '2026-09-15');
    expect(currentTicketFor(board, 'd1')?.id).toBe('s1');
    expect(currentTicketFor(board, 'd2')).toBeNull();
    expect(waitedMinutes(row({ id: 'x', createdAt: '2026-09-15T05:00:00.000Z' }), '2026-09-15T05:31:30.000Z')).toBe(31);
  });
});

describe('schemas', () => {
  it('CreateTicketSchema / KioskTicketSchema / NextTicketSchema', () => {
    expect(CreateTicketSchema.parse({ type: 'DOCTOR' })).toEqual({ type: 'DOCTOR' });
    expect(CreateTicketSchema.safeParse({ type: 'XRAY' }).success).toBe(false);
    expect(KioskTicketSchema.safeParse({ type: 'DOCTOR' }).success).toBe(false);
    expect(KioskTicketSchema.parse({ key: ' demo-kiosk-key-2026 ', type: 'LAB', locale: 'ru' })).toEqual({ key: 'demo-kiosk-key-2026', type: 'LAB', locale: 'ru' });
    expect(NextTicketSchema.parse({})).toEqual({ type: 'DOCTOR' });
    expect(RecallSchema.parse({ requeue: true })).toEqual({ requeue: true });
  });

  it('DateKeySchema', () => {
    expect(DateKeySchema.safeParse('2026-09-15').success).toBe(true);
    expect(DateKeySchema.safeParse('15.09.2026').success).toBe(false);
    expect(DateKeySchema.safeParse('2026-13-45').success).toBe(false);
  });
});

describe('rate limit', () => {
  it('30 soʻrov / daqiqa, keyin rad', () => {
    resetRateLimits();
    const now = 1_000_000;
    for (let i = 0; i < 30; i++) expect(checkRateLimit('kiosk|1.1.1.1', 30, 60_000, now + i).ok).toBe(true);
    const blocked = checkRateLimit('kiosk|1.1.1.1', 30, 60_000, now + 31);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(checkRateLimit('kiosk|2.2.2.2', 30, 60_000, now + 31).ok).toBe(true);
    // oyna oʻtgach yana ruxsat
    expect(checkRateLimit('kiosk|1.1.1.1', 30, 60_000, now + 61_000).ok).toBe(true);
  });
});

describe('realtime events', () => {
  const base = {
    id: 'q1',
    number: 'A-001',
    status: 'CALLED' as const,
    type: 'DOCTOR' as QueueType,
    room: '3',
    doctorId: 'd1',
    createdAt: new Date('2026-09-15T05:00:00.000Z'),
    calledAt: new Date('2026-09-15T05:10:00.000Z'),
    updatedAt: new Date('2026-09-15T05:10:00.500Z'),
  };

  it('qator → hodisa turi', () => {
    expect(classifyRowEvent(base, new Date('2026-09-15T05:09:00.000Z'))).toBe('called');
    expect(classifyRowEvent(base, new Date('2026-09-15T04:59:00.000Z'))).toBe('created');
    expect(classifyRowEvent({ ...base, status: 'SERVING' }, new Date('2026-09-15T05:09:00.000Z'))).toBe('updated');
    expect(classifyRowEvent({ ...base, status: 'WAITING', calledAt: null }, null)).toBe('updated');
    const ev = queueEventFromRow(base, null, 'called');
    expect(ev).toEqual({ type: 'called', queueId: 'q1', number: 'A-001', status: 'CALLED', queueType: 'DOCTOR', room: '3', doctorId: 'd1', at: '2026-09-15T05:10:00.500Z' });
  });

  it('emitter: klinika boʻyicha obuna va eʼlon', () => {
    const got: string[] = [];
    const off = subscribeQueueEvents('clinicA', (e) => got.push(e.queueId));
    expect(queueListenerCount('clinicA')).toBe(1);
    publishQueueEvent('clinicA', { type: 'created', queueId: 'x', number: 'A-001', status: 'WAITING', queueType: 'DOCTOR', room: null, doctorId: null });
    publishQueueEvent('clinicB', { type: 'created', queueId: 'y', number: 'A-001', status: 'WAITING', queueType: 'DOCTOR', room: null, doctorId: null });
    expect(got).toEqual(['x']);
    off();
    expect(queueListenerCount('clinicA')).toBe(0);
  });

  it('SSE xabar formati', () => {
    expect(formatSseMessage('queue', { a: 1 }, 'id1')).toBe('event: queue\nid: id1\ndata: {"a":1}\n\n');
    expect(formatSseMessage('snapshot', null)).toBe('event: snapshot\ndata: null\n\n');
  });

  it('makeSse: sarlavhalar, snapshot va hodisa, abort da yopiladi', async () => {
    const ac = new AbortController();
    const req = new Request('http://localhost/api/queue/stream', { signal: ac.signal });
    let polls = 0;
    const res = makeSse(req, {
      clinicId: 'clinicS',
      snapshot: async () => ({ hello: 'world' }),
      poll: async () => {
        polls += 1;
        return polls === 1
          ? [{ type: 'called', queueId: 'q9', number: 'A-009', status: 'CALLED', queueType: 'DOCTOR', room: '1', doctorId: null, at: new Date().toISOString() }]
          : [];
      },
      intervalMs: 20,
      heartbeatMs: 10_000,
    });
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && !text.includes('event: queue')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('retry: 2000');
    expect(text).toContain('event: snapshot\ndata: {"hello":"world"}');
    expect(text).toContain('event: queue');
    expect(text).toContain('"queueId":"q9"');
    ac.abort();
    const tail = await reader.read();
    // yopilgach oqim tugaydi (done) yoki oxirgi bufer keladi
    if (!tail.done) {
      const after = await reader.read();
      expect(after.done).toBe(true);
    }
  });

  it('Supabase payload → hodisa; state URL', () => {
    const ev = queueEventFromSupabase('UPDATE', { id: 'q1', number: 'A-001', status: 'CALLED', type: 'DOCTOR', room: '3', doctorId: 'd1', calledAt: '2026-09-15T05:10:00Z', updatedAt: '2026-09-15T05:10:00Z' }, { calledAt: null });
    expect(ev?.type).toBe('called');
    expect(queueEventFromSupabase('INSERT', { id: 'q2', number: 'A-002', status: 'WAITING', type: 'DOCTOR', updatedAt: 'x' })?.type).toBe('created');
    expect(queueEventFromSupabase('UPDATE', { id: 'q1', status: 'CALLED', calledAt: 't', updatedAt: 't' }, { calledAt: 't' })?.type).toBe('updated');
    expect(queueEventFromSupabase('UPDATE', null)).toBeNull();
    expect(stateUrlFor('/api/display/stream?key=abc')).toBe('/api/display/state?key=abc');
    expect(stateUrlFor('/api/queue/stream')).toBe('/api/queue/state');
  });
});

describe('display audio helpers', () => {
  it('raqamni harflab oʻqish va kirillcha transliteratsiya', () => {
    expect(spellNumber('A-012')).toBe('A 0 1 2');
    expect(toUzCyrillic('A-012 raqam, 3-xona')).toBe('А-012 рақам, 3-хона');
    expect(toUzCyrillic('Shifokor qabuli')).toBe('Шифокор қабули');
    expect(toUzCyrillic('gʻisht oʻn')).toBe('ғишт ўн');
  });
});

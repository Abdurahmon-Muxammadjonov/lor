import { describe, expect, it } from 'vitest';
import { parseWeeklySchedule } from '@/lib/settings/types';
import {
  addDaysKey,
  atTz,
  buildSlots,
  canTransition,
  checkSchedule,
  durationMinutes,
  findConflict,
  isLockedForMove,
  isValidDateKey,
  keyToLocalDate,
  layoutLanes,
  localDateToKey,
  nonWorkingRanges,
  overlaps,
  renderAppointmentSms,
  renderTemplate,
  shortName,
  snapToSlot,
  tzDateKey,
  tzDayOfWeek,
  tzMinutesOfDay,
  tzTime,
  weekKeys,
  weekStartKey,
  type BusyInterval,
} from '@/lib/appointments/availability';
import {
  dayColumns,
  gridMetrics,
  groupByDate,
  minuteFromOffset,
  placeAppointments,
  rangeForView,
  weekColumns,
} from '@/lib/appointments/calendar';
import {
  AppointmentFormSchema,
  AppointmentStatusSchema,
  CreateAppointmentSchema,
  RangeQuerySchema,
  SlotsQuerySchema,
  UpdateAppointmentSchema,
} from '@/lib/appointments/schemas';
import type { AppointmentDTO, DoctorOption } from '@/lib/appointments/types';
import { appointments as messages } from '@/i18n/messages/appointments';
import type { Tree } from '@/i18n/types';
import { appointmentErrorMessage, durationOptions, withAlpha } from '@/components/appointments/constants';
import { columnKeyFromDropId, dropIdFor } from '@/components/appointments/dnd-keyboard';

// Dush–Jum 09:00–18:00 (tanaffus 13–14), Shanba 09:00–14:00, Yakshanba dam
const STANDARD = parseWeeklySchedule({
  0: { enabled: false },
  1: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  2: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  3: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  4: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  5: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  6: { enabled: true, start: '09:00', end: '14:00' },
});

const MONDAY = '2030-09-16';
const SUNDAY = '2030-09-15';
const SATURDAY = '2030-09-21';
const NOW = new Date('2030-09-10T05:00:00.000Z'); // 10:00 Toshkent, chorshanba

function appt(
  id: string,
  dateKey: string,
  hm: string,
  dur: number,
  extra: Partial<AppointmentDTO> = {},
): AppointmentDTO {
  const startAt = atTz(dateKey, hm);
  const endAt = new Date(startAt.getTime() + dur * 60000);
  return {
    id,
    clinicId: 'c1',
    patientId: 'p1',
    doctorId: 'd1',
    createdById: 'u1',
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    status: 'SCHEDULED',
    note: null,
    reminderSentAt: null,
    confirmSentAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    patient: {
      id: 'p1',
      fullName: 'Karimova Dilnoza Baxtiyorovna',
      cardNumber: '2026-00001',
      phone: '+998901234567',
      birthDate: '1990-01-01',
      gender: 'FEMALE',
      smsConsent: true,
    },
    doctor: { id: 'd1', fullName: 'Rahimov Jasur Anvarovich', room: '3', color: '#00D4FF', specialty: 'LOR' },
    createdBy: { id: 'u1', fullName: 'Nazarova Gulnora' },
    visit: null,
    ...extra,
  };
}

// ───────────────────────── Toshkent vaqti ─────────────────────────

describe('appointments: Toshkent vaqti yordamchilari', () => {
  it('atTz / tzTime / tzMinutesOfDay / tzDateKey bir-biriga mos', () => {
    const d = atTz(MONDAY, '09:30');
    expect(d.toISOString()).toBe('2030-09-16T04:30:00.000Z');
    expect(tzTime(d)).toBe('09:30');
    expect(tzMinutesOfDay(d)).toBe(9 * 60 + 30);
    expect(tzDateKey(d)).toBe(MONDAY);
    // yarim tundan keyin UTC boʻyicha oldingi kun, Toshkentda esa keyingi kun
    expect(tzDateKey(new Date('2030-09-15T20:30:00.000Z'))).toBe('2030-09-16');
    expect(tzTime('2030-09-15T20:30:00.000Z')).toBe('01:30');
  });

  it('hafta kalitlari dushanbadan boshlanadi', () => {
    expect(tzDayOfWeek(MONDAY)).toBe(1);
    expect(tzDayOfWeek(SUNDAY)).toBe(0);
    expect(weekStartKey('2030-09-19')).toBe(MONDAY);
    expect(weekStartKey(SUNDAY)).toBe('2030-09-09');
    expect(weekKeys(MONDAY)).toEqual([
      '2030-09-16',
      '2030-09-17',
      '2030-09-18',
      '2030-09-19',
      '2030-09-20',
      '2030-09-21',
      '2030-09-22',
    ]);
    expect(addDaysKey('2030-09-30', 1)).toBe('2030-10-01');
    expect(addDaysKey('2030-01-01', -1)).toBe('2029-12-31');
  });

  it('isValidDateKey va mahalliy Date konvertatsiyasi', () => {
    expect(isValidDateKey(MONDAY)).toBe(true);
    expect(isValidDateKey('2030-02-30')).toBe(false);
    expect(isValidDateKey('16.09.2030')).toBe(false);
    expect(isValidDateKey(undefined)).toBe(false);
    expect(localDateToKey(keyToLocalDate(MONDAY))).toBe(MONDAY);
  });

  it('durationMinutes', () => {
    expect(durationMinutes('2030-09-16T04:00:00.000Z', '2030-09-16T04:20:00.000Z')).toBe(20);
  });
});

// ───────────────────────── Kesishuv ─────────────────────────

describe('appointments: overlap', () => {
  const s = (hm: string) => atTz(MONDAY, hm);

  it('chegara tegishi kesishuv emas, qisman va toʻliq qoplash — kesishuv', () => {
    expect(overlaps(s('09:00'), s('09:20'), s('09:20'), s('09:40'))).toBe(false);
    expect(overlaps(s('09:00'), s('09:20'), s('09:10'), s('09:40'))).toBe(true);
    expect(overlaps(s('09:00'), s('10:00'), s('09:10'), s('09:20'))).toBe(true);
    expect(overlaps(s('09:10'), s('09:20'), s('09:00'), s('10:00'))).toBe(true);
    expect(overlaps(s('08:00'), s('09:00'), s('09:00'), s('10:00'))).toBe(false);
  });

  it('findConflict: CANCELLED/NO_SHOW band qilmaydi, excludeId eʼtiborga olinadi', () => {
    const busy: BusyInterval[] = [
      { id: 'a', startAt: s('09:00'), endAt: s('09:20'), status: 'SCHEDULED' },
      { id: 'b', startAt: s('09:20'), endAt: s('09:40'), status: 'CANCELLED' },
      { id: 'c', startAt: s('10:00'), endAt: s('10:30'), status: 'NO_SHOW' },
      { id: 'd', startAt: s('11:00'), endAt: s('11:30'), status: 'ARRIVED' },
    ];
    expect(findConflict(busy, s('09:10'), s('09:30'))?.id).toBe('a');
    expect(findConflict(busy, s('09:20'), s('09:40'))).toBeNull();
    expect(findConflict(busy, s('10:00'), s('10:30'))).toBeNull();
    expect(findConflict(busy, s('11:15'), s('11:45'))?.id).toBe('d');
    expect(findConflict(busy, s('09:00'), s('09:20'), 'a')).toBeNull();
  });
});

// ───────────────────────── Jadval ─────────────────────────

describe('appointments: shifokor jadvali', () => {
  it('checkSchedule: dam olish kuni, ish vaqtidan tashqari, tanaffus, ok', () => {
    expect(checkSchedule(STANDARD, atTz(SUNDAY, '10:00'), atTz(SUNDAY, '10:20'))).toBe('DAY_OFF');
    expect(checkSchedule(STANDARD, atTz(MONDAY, '08:40'), atTz(MONDAY, '09:00'))).toBe('OUTSIDE_HOURS');
    expect(checkSchedule(STANDARD, atTz(MONDAY, '17:50'), atTz(MONDAY, '18:10'))).toBe('OUTSIDE_HOURS');
    expect(checkSchedule(STANDARD, atTz(MONDAY, '12:50'), atTz(MONDAY, '13:10'))).toBe('BREAK');
    expect(checkSchedule(STANDARD, atTz(MONDAY, '13:00'), atTz(MONDAY, '14:00'))).toBe('BREAK');
    expect(checkSchedule(STANDARD, atTz(MONDAY, '12:40'), atTz(MONDAY, '13:00'))).toBeNull();
    expect(checkSchedule(STANDARD, atTz(MONDAY, '14:00'), atTz(MONDAY, '14:20'))).toBeNull();
    expect(checkSchedule(STANDARD, atTz(SATURDAY, '13:40'), atTz(SATURDAY, '14:00'))).toBeNull();
    expect(checkSchedule(STANDARD, atTz(SATURDAY, '14:00'), atTz(SATURDAY, '14:20'))).toBe('OUTSIDE_HOURS');
  });

  it('nonWorkingRanges: klinika ish vaqti ichidagi ishlanmaydigan oraliqlar', () => {
    expect(nonWorkingRanges(STANDARD, SUNDAY, '08:00', '20:00')).toEqual([
      { from: 480, to: 1200, reason: 'DAY_OFF' },
    ]);
    expect(nonWorkingRanges(STANDARD, MONDAY, '08:00', '20:00')).toEqual([
      { from: 480, to: 540, reason: 'OUTSIDE_HOURS' },
      { from: 780, to: 840, reason: 'BREAK' },
      { from: 1080, to: 1200, reason: 'OUTSIDE_HOURS' },
    ]);
    expect(nonWorkingRanges(null, MONDAY, '08:00', '20:00')).toEqual([]);
  });
});

// ───────────────────────── Slotlar ─────────────────────────

describe('appointments: buildSlots', () => {
  it('klinika ish vaqti boʻyicha slotlar; band, tanaffus, dam olish va ish vaqtidan tashqari sabablari', () => {
    const busy: BusyInterval[] = [
      { id: 'x', startAt: atTz(MONDAY, '10:00'), endAt: atTz(MONDAY, '10:20'), status: 'CONFIRMED' },
    ];
    const slots = buildSlots({
      dateKey: MONDAY,
      workStart: '08:00',
      workEnd: '20:00',
      slotMinutes: 20,
      durationMin: 20,
      schedule: STANDARD,
      busy,
      now: NOW,
    });
    expect(slots).toHaveLength(36);
    const by = new Map(slots.map((s) => [s.time, s]));
    expect(by.get('08:00')?.reason).toBe('OUTSIDE_HOURS');
    expect(by.get('09:00')?.available).toBe(true);
    expect(by.get('09:40')?.available).toBe(true);
    expect(by.get('10:00')?.reason).toBe('TAKEN');
    expect(by.get('10:20')?.available).toBe(true);
    expect(by.get('13:00')?.reason).toBe('BREAK');
    expect(by.get('13:40')?.reason).toBe('BREAK');
    expect(by.get('14:00')?.available).toBe(true);
    expect(by.get('17:40')?.available).toBe(true);
    expect(by.get('18:00')?.reason).toBe('OUTSIDE_HOURS');
    expect(by.get('19:40')?.startAt).toBe(atTz(MONDAY, '19:40').toISOString());
  });

  it('uzun davomiylik oxirgi slotlarni chiqarib tashlaydi, kesishuvni hisobga oladi', () => {
    const busy: BusyInterval[] = [
      { id: 'x', startAt: atTz(MONDAY, '10:00'), endAt: atTz(MONDAY, '10:20'), status: 'SCHEDULED' },
    ];
    const slots = buildSlots({
      dateKey: MONDAY,
      workStart: '08:00',
      workEnd: '20:00',
      slotMinutes: 20,
      durationMin: 40,
      schedule: STANDARD,
      busy,
      now: NOW,
    });
    expect(slots[slots.length - 1]?.time).toBe('19:20');
    const by = new Map(slots.map((s) => [s.time, s]));
    expect(by.get('09:40')?.reason).toBe('TAKEN');
    expect(by.get('10:20')?.available).toBe(true);
    expect(by.get('12:40')?.reason).toBe('BREAK');
  });

  it('oʻtgan vaqt PAST, excludeId oʻz vaqtini band hisoblamaydi, dam olish kuni hammasi DAY_OFF', () => {
    const today = tzDateKey(NOW);
    const busy: BusyInterval[] = [
      { id: 'self', startAt: atTz(today, '11:00'), endAt: atTz(today, '11:20'), status: 'SCHEDULED' },
    ];
    const slots = buildSlots({
      dateKey: today,
      workStart: '08:00',
      workEnd: '20:00',
      slotMinutes: 20,
      durationMin: 20,
      schedule: STANDARD,
      busy,
      excludeId: 'self',
      now: NOW,
    });
    const by = new Map(slots.map((s) => [s.time, s]));
    expect(by.get('09:00')?.reason).toBe('PAST');
    expect(by.get('09:40')?.reason).toBe('PAST');
    expect(by.get('10:00')?.available).toBe(true);
    expect(by.get('11:00')?.available).toBe(true);
    const sunday = buildSlots({
      dateKey: SUNDAY,
      workStart: '08:00',
      workEnd: '20:00',
      slotMinutes: 20,
      durationMin: 20,
      schedule: STANDARD,
      busy: [],
      now: NOW,
    });
    expect(sunday.every((s) => s.reason === 'DAY_OFF')).toBe(true);
  });

  it('snapToSlot toʻrga yaxlitlaydi va chegaralaydi', () => {
    expect(snapToSlot(489, 20, 480, 1180)).toBe(480);
    expect(snapToSlot(491, 20, 480, 1180)).toBe(500);
    expect(snapToSlot(100, 20, 480, 1180)).toBe(480);
    expect(snapToSlot(5000, 20, 480, 1180)).toBe(1180);
    expect(snapToSlot(497, 3, 480, 1180)).toBe(495);
  });
});

// ───────────────────────── Holatlar ─────────────────────────

describe('appointments: holat oʻtishlari', () => {
  it('canTransition / isLockedForMove', () => {
    expect(canTransition('SCHEDULED', 'CONFIRMED')).toBe(true);
    expect(canTransition('SCHEDULED', 'ARRIVED')).toBe(true);
    expect(canTransition('CONFIRMED', 'ARRIVED')).toBe(true);
    expect(canTransition('ARRIVED', 'DONE')).toBe(true);
    expect(canTransition('DONE', 'CANCELLED')).toBe(false);
    expect(canTransition('SCHEDULED', 'DONE')).toBe(false);
    expect(canTransition('CANCELLED', 'SCHEDULED')).toBe(true);
    expect(canTransition('NO_SHOW', 'ARRIVED')).toBe(true);
    expect(isLockedForMove('SCHEDULED')).toBe(false);
    expect(isLockedForMove('CONFIRMED')).toBe(false);
    expect(isLockedForMove('ARRIVED')).toBe(true);
    expect(isLockedForMove('DONE')).toBe(true);
    expect(isLockedForMove('CANCELLED')).toBe(true);
  });
});

// ───────────────────────── Joylashuv ─────────────────────────

describe('appointments: layoutLanes / placeAppointments', () => {
  it('kesishuvchi kartalar yonma-yon, kesishmaydiganlar toʻliq kenglikda', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 540, end: 600 },
      { id: 'b', start: 560, end: 620 },
      { id: 'c', start: 600, end: 660 },
      { id: 'd', start: 700, end: 720 },
    ]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('c')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 });
  });

  it('placeAppointments: top/height px va ish vaqtiga qisish', () => {
    const items = [
      appt('a', MONDAY, '09:00', 20),
      appt('b', MONDAY, '07:30', 60),
      appt('c', MONDAY, '19:50', 30),
    ];
    const placed = placeAppointments(items, {
      workStartMin: 480,
      workEndMin: 1200,
      pxPerMin: 2,
      minHeightPx: 22,
    });
    const by = new Map(placed.map((p) => [p.appointment.id, p]));
    expect(by.get('a')).toMatchObject({
      startMin: 540,
      endMin: 560,
      top: 120,
      height: 38,
      lane: 0,
      lanes: 1,
    });
    expect(by.get('b')).toMatchObject({ startMin: 480, endMin: 510, top: 0 });
    expect(by.get('c')).toMatchObject({ startMin: 1190, endMin: 1200, top: 1420, height: 22 });
  });

  it('gridMetrics / minuteFromOffset', () => {
    const m = gridMetrics('08:00', '20:00', 20, 56);
    expect(m).toMatchObject({ workStartMin: 480, workEndMin: 1200, step: 20, pxPerMin: 2.8, totalPx: 2016 });
    expect(m.rows).toHaveLength(36);
    expect(minuteFromOffset(0, m)).toBe(480);
    expect(minuteFromOffset(57, m)).toBe(500);
    expect(minuteFromOffset(999999, m)).toBe(1180);
    // ish vaqti notoʻgʻri boʻlsa ham kamida 1 soat
    expect(gridMetrics('10:00', '09:00', 20, 56).workEndMin).toBe(660);
  });
});

// ───────────────────────── Ustunlar ─────────────────────────

describe('appointments: ustunlar va oraliq', () => {
  const doctors: DoctorOption[] = [
    { id: 'd1', fullName: 'Rahimov', room: '3', color: '#00D4FF', specialty: null, schedule: STANDARD },
    { id: 'd2', fullName: 'Yusupova', room: '5', color: '#7C5CFF', specialty: null, schedule: STANDARD },
  ];
  const items = [
    appt('a', MONDAY, '09:00', 20),
    appt('b', MONDAY, '10:00', 20, { doctorId: 'd2' }),
    appt('c', '2030-09-18', '10:00', 20),
  ];

  it('rangeForView: kun va hafta oraligʻi Toshkent kuni chegaralarida', () => {
    const day = rangeForView('day', MONDAY);
    expect(day.keys).toEqual([MONDAY]);
    expect(day.from).toBe('2030-09-15T19:00:00.000Z');
    expect(day.to).toBe('2030-09-16T18:59:59.999Z');
    const week = rangeForView('week', '2030-09-19');
    expect(week.keys[0]).toBe(MONDAY);
    expect(week.keys[6]).toBe('2030-09-22');
    expect(week.from).toBe('2030-09-15T19:00:00.000Z');
    expect(week.to).toBe('2030-09-22T18:59:59.999Z');
  });

  it('dayColumns: shifokor boʻyicha, weekColumns: kun boʻyicha (bitta shifokor → doctorId, aks holda null)', () => {
    const cols = dayColumns(MONDAY, doctors, items);
    expect(cols.map((c) => c.key)).toEqual(['d:d1', 'd:d2']);
    expect(cols[0]?.items.map((a) => a.id)).toEqual(['a']);
    expect(cols[1]?.items.map((a) => a.id)).toEqual(['b']);

    const week = weekColumns(weekKeys(MONDAY), doctors, items);
    expect(week).toHaveLength(7);
    expect(week[0]?.doctorId).toBeNull();
    expect(week[0]?.items.map((a) => a.id)).toEqual(['a', 'b']);
    expect(week[2]?.items.map((a) => a.id)).toEqual(['c']);

    const single = weekColumns(weekKeys(MONDAY), doctors.slice(0, 1), items);
    expect(single[0]?.doctorId).toBe('d1');
    expect(single[0]?.items.map((a) => a.id)).toEqual(['a']);
  });

  it('groupByDate tartiblangan', () => {
    const g = groupByDate([
      appt('z', '2030-09-18', '09:00', 20),
      appt('y', MONDAY, '12:00', 20),
      appt('x', MONDAY, '09:00', 20),
    ]);
    expect([...g.keys()]).toEqual([MONDAY, '2030-09-18']);
    expect(g.get(MONDAY)?.map((a) => a.id)).toEqual(['x', 'y']);
  });
});

// ───────────────────────── SMS ─────────────────────────

describe('appointments: SMS shablon', () => {
  it('renderTemplate nomaʼlum kalitni oʻzgartirmaydi', () => {
    expect(renderTemplate('{clinic}: {name} — {x}', { clinic: 'Shifo', name: 'Dilnoza' })).toBe(
      'Shifo: Dilnoza — {x}',
    );
  });

  it('shortName ismni oladi', () => {
    expect(shortName('Karimova Dilnoza Baxtiyorovna')).toBe('Dilnoza');
    expect(shortName('Dilnoza')).toBe('Dilnoza');
  });

  it('renderAppointmentSms sana/vaqtni Toshkent vaqtida qoʻyadi', () => {
    const text = renderAppointmentSms(
      '{clinic}: {name}, siz {date} soat {time} ga {doctor} qabuliga yozildingiz. Tel: {phone}',
      {
        clinic: 'Shifo LOR',
        phone: '+998712001122',
        patientName: 'Karimova Dilnoza Baxtiyorovna',
        doctorName: 'Rahimov Jasur',
        startAt: atTz(MONDAY, '09:30'),
      },
    );
    expect(text).toBe(
      'Shifo LOR: Dilnoza, siz 16.09.2030 soat 09:30 ga Rahimov Jasur qabuliga yozildingiz. Tel: +998712001122',
    );
  });
});

// ───────────────────────── Sxemalar ─────────────────────────

describe('appointments: zod sxemalar', () => {
  it('CreateAppointmentSchema: ISO sana, davomiylik 5–240, izoh tozalanadi', () => {
    const ok = CreateAppointmentSchema.safeParse({
      patientId: 'p',
      doctorId: 'd',
      startAt: '2030-09-16T04:00:00.000Z',
      durationMin: 30,
      note: ' <b>izoh</b> ',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.note).toBe('izoh');
    expect(
      CreateAppointmentSchema.safeParse({
        patientId: 'p',
        doctorId: 'd',
        startAt: '2030-09-16T09:00:00+05:00',
      }).success,
    ).toBe(true);
    expect(
      CreateAppointmentSchema.safeParse({ patientId: 'p', doctorId: 'd', startAt: '16.09.2030' }).success,
    ).toBe(false);
    expect(
      CreateAppointmentSchema.safeParse({
        patientId: 'p',
        doctorId: 'd',
        startAt: '2030-09-16T04:00:00.000Z',
        durationMin: 3,
      }).success,
    ).toBe(false);
    expect(
      CreateAppointmentSchema.safeParse({
        patientId: 'p',
        doctorId: 'd',
        startAt: '2030-09-16T04:00:00.000Z',
        durationMin: 241,
      }).success,
    ).toBe(false);
    expect(
      CreateAppointmentSchema.safeParse({
        patientId: 'p',
        doctorId: 'd',
        startAt: '2030-09-16T04:00:00.000Z',
        durationMin: 12.5,
      }).success,
    ).toBe(false);
  });

  it('UpdateAppointmentSchema kamida bitta maydon talab qiladi', () => {
    expect(UpdateAppointmentSchema.safeParse({}).success).toBe(false);
    expect(UpdateAppointmentSchema.safeParse({ note: null }).success).toBe(true);
    expect(
      UpdateAppointmentSchema.safeParse({ startAt: '2030-09-16T04:00:00.000Z', doctorId: 'd2' }).success,
    ).toBe(true);
  });

  it('AppointmentStatusSchema / RangeQuerySchema / SlotsQuerySchema', () => {
    expect(AppointmentStatusSchema.safeParse({ status: 'ARRIVED' }).success).toBe(true);
    expect(AppointmentStatusSchema.safeParse({ status: 'LATE' }).success).toBe(false);
    expect(
      RangeQuerySchema.safeParse({ from: '2030-09-16T00:00:00.000Z', to: '2030-09-17T00:00:00.000Z' })
        .success,
    ).toBe(true);
    expect(
      RangeQuerySchema.safeParse({ from: '2030-09-17T00:00:00.000Z', to: '2030-09-16T00:00:00.000Z' })
        .success,
    ).toBe(false);
    expect(
      RangeQuerySchema.safeParse({ from: '2030-01-01T00:00:00.000Z', to: '2030-06-01T00:00:00.000Z' })
        .success,
    ).toBe(false);
    expect(SlotsQuerySchema.safeParse({ doctorId: 'd', date: '2030-09-16' }).success).toBe(true);
    expect(SlotsQuerySchema.safeParse({ doctorId: 'd', date: '2030-9-16' }).success).toBe(false);
  });

  it('RangeQuerySchema: "YYYY-MM-DD" kalit Toshkent kuni chegaralariga kengayadi', () => {
    const parsed = RangeQuerySchema.safeParse({ from: '2030-09-16', to: '2030-09-23' });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // Toshkent = UTC+5 → kun boshi 19:00Z (oldingi kun), kun oxiri 18:59:59.999Z
    expect(parsed.data.from).toBe('2030-09-15T19:00:00.000Z');
    expect(parsed.data.to).toBe('2030-09-23T18:59:59.999Z');
    // aralash shakl ham ishlaydi
    expect(RangeQuerySchema.safeParse({ from: '2030-09-16', to: '2030-09-17T00:00:00.000Z' }).success).toBe(
      true,
    );
    // notoʻgʻri kalit — VALIDATION (istisno emas)
    expect(RangeQuerySchema.safeParse({ from: '2030-13-45', to: '2030-09-17' }).success).toBe(false);
    // teskari tartib kalitlar bilan ham rad etiladi
    expect(RangeQuerySchema.safeParse({ from: '2030-09-23', to: '2030-09-16' }).success).toBe(false);
  });

  it('AppointmentFormSchema (dialog): vaqt HH:mm, xato matnlari i18n kalitlari', () => {
    const bad = AppointmentFormSchema.safeParse({
      patientId: '',
      doctorId: 'd',
      date: MONDAY,
      time: '',
      durationMin: 20,
      note: '',
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const msgs = bad.error.issues.map((i) => i.message);
      expect(msgs).toContain('common.validation.required');
      expect(msgs).toContain('appointments.validation.time');
    }
    expect(
      AppointmentFormSchema.safeParse({
        patientId: 'p',
        doctorId: 'd',
        date: MONDAY,
        time: '09:20',
        durationMin: 20,
        note: '',
      }).success,
    ).toBe(true);
  });
});

// ───────────────────────── UI yordamchilari ─────────────────────────

describe('appointments: UI yordamchilari', () => {
  it('durationOptions klinika slotini qoʻshadi va tartiblaydi', () => {
    const opts = durationOptions(25);
    expect(opts).toContain(25);
    expect(opts).toContain(50);
    expect([...opts].sort((a, b) => a - b)).toEqual(opts);
    expect(opts.every((n) => n >= 5 && n <= 240)).toBe(true);
  });

  it('withAlpha hex → hex8', () => {
    expect(withAlpha('#00D4FF', 0.5)).toBe('#00D4FF80');
    expect(withAlpha('red', 0.5)).toBe('red');
  });

  it('appointmentErrorMessage sababni tarjima qiladi', () => {
    const t = (k: string) =>
      k === 'appointments.errors.OVERLAP'
        ? 'Band'
        : k === 'appointments.errors.NOT_FOUND'
          ? 'Topilmadi'
          : k === 'common.error'
            ? 'Xatolik'
            : k;
    expect(
      appointmentErrorMessage(t, {
        message: 'x',
        code: 'CONFLICT',
        details: { reason: 'OVERLAP', conflictId: '1' },
      }),
    ).toBe('Band');
    expect(appointmentErrorMessage(t, { message: 'x', code: 'NOT_FOUND' })).toBe('Topilmadi');
    expect(appointmentErrorMessage(t, { message: 'Server xatosi', code: 'INTERNAL' })).toBe('Server xatosi');
    expect(appointmentErrorMessage(t, null)).toBe('Xatolik');
  });

  it('droppable identifikatorlari', () => {
    expect(dropIdFor('d:abc')).toBe('col:d:abc');
    expect(columnKeyFromDropId('col:w:2030-09-16')).toBe('w:2030-09-16');
    expect(columnKeyFromDropId('appt:1')).toBeNull();
    expect(columnKeyFromDropId(undefined)).toBeNull();
  });
});

// ───────────────────────── i18n ─────────────────────────

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keyPaths(v, `${prefix}${k}.`),
  );
}
function leaves(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : leaves(v)));
}

describe('appointments: i18n lugʻati', () => {
  it('uz va ru kalitlari bir xil, boʻsh qiymat yoʻq', () => {
    expect(keyPaths(messages.ru).sort()).toEqual(keyPaths(messages.uz).sort());
    expect(leaves(messages.uz).every((s) => s.trim().length > 0)).toBe(true);
    expect(leaves(messages.ru).every((s) => s.trim().length > 0)).toBe(true);
  });

  it("oʻzbek matnida oddiy apostrof (') ishlatilmagan", () => {
    const bad = leaves(messages.uz).filter((s) => /[og]'/i.test(s) || s.includes("'"));
    expect(bad).toEqual([]);
  });

  it('kerakli kalitlar mavjud', () => {
    const keys = new Set(keyPaths(messages.uz));
    for (const k of [
      'title',
      'new',
      'view.day',
      'view.week',
      'actions.arrived',
      'toast.queueCreated',
      'errors.OVERLAP',
      'dnd.instructions',
      'confirmCancel.title',
      'dialog.selectedTime',
    ]) {
      expect(keys.has(k), k).toBe(true);
    }
  });
});

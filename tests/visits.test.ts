/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  AddLineSchema,
  CreateVisitSchema,
  GlobalDiscountSchema,
  ListVisitsQuerySchema,
  UpdateLineSchema,
  UpdateVisitSchema,
} from '@/lib/visits/schemas';
import {
  computeLine,
  useLineCalc,
  type LineCalcInput,
  type LineCalcService,
} from '@/components/treatment/line-calc';
import { ICD10_LOR, findIcd10, icd10Label, searchIcd10 } from '@/data/icd10-lor';
import { ANATOMY_REGIONS, findRegion, matchRegionByDetail, regionsForOrgan } from '@/data/anatomy';
import {
  globalDiscountAmount,
  isMeaningfulText,
  patientAgeInfo,
  paymentStateOf,
  sumLines,
  totalBeforeRounding,
} from '@/components/treatment/visit-utils';
import { EMPTY_DRAFT, useTreatmentDraft } from '@/stores/use-treatment-draft';
import { priceHint } from '@/components/treatment/service-picker';
import type { TreatmentServiceDTO } from '@/lib/visits/dto';

/** N-001 «Burun yuvish»: 120 000 / 150 000 (kattalar), 90 000 / 110 000 (bolalar) */
const SERVICE: LineCalcService = {
  priceAdultNoMed: 120_000,
  priceAdultMed: 150_000,
  priceChildNoMed: 90_000,
  priceChildMed: 110_000,
  allowHalf: true,
  medicineOptional: true,
};

const base: LineCalcInput = {
  patientType: 'ADULT',
  withMedicine: false,
  quantity: 1.5,
  discountType: 'NONE',
  discountValue: 0,
};

const validLine = {
  serviceId: 'svc_1',
  patientType: 'ADULT',
  withMedicine: true,
  quantity: 1.5,
  discountType: 'NONE',
  discountValue: 0,
};

describe('visits schemas', () => {
  it('AddLineSchema rejects 1.3 and accepts 1.5 (0.5 step)', () => {
    expect(AddLineSchema.safeParse({ ...validLine, quantity: 1.3 }).success).toBe(false);
    expect(AddLineSchema.safeParse({ ...validLine, quantity: 1.5 }).success).toBe(true);
    expect(AddLineSchema.safeParse({ ...validLine, quantity: 2 }).success).toBe(true);
    expect(AddLineSchema.safeParse({ ...validLine, quantity: '0.5' }).success).toBe(true);
    expect(AddLineSchema.safeParse({ ...validLine, quantity: 0 }).success).toBe(false);
    expect(AddLineSchema.safeParse({ ...validLine, quantity: -1 }).success).toBe(false);
    expect(AddLineSchema.safeParse({ ...validLine, quantity: 99.5 }).success).toBe(false);
  });

  it('AddLineSchema defaults and discount rules', () => {
    const r = AddLineSchema.safeParse({
      serviceId: 'svc',
      patientType: 'CHILD',
      withMedicine: false,
      quantity: 1,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.discountType).toBe('NONE');
      expect(r.data.discountValue).toBe(0);
      expect(r.data.side).toBeUndefined();
    }
    expect(
      AddLineSchema.safeParse({ ...validLine, discountType: 'PERCENT', discountValue: 120 }).success,
    ).toBe(false);
    expect(
      AddLineSchema.safeParse({ ...validLine, discountType: 'PERCENT', discountValue: 100 }).success,
    ).toBe(true);
    expect(
      AddLineSchema.safeParse({ ...validLine, discountType: 'FIXED', discountValue: '25 000' }).success,
    ).toBe(true);
    expect(AddLineSchema.safeParse({ ...validLine, discountType: 'FIXED', discountValue: -5 }).success).toBe(
      false,
    );
    expect(
      AddLineSchema.safeParse({ ...validLine, discountType: 'FIXED', discountValue: 10.5 }).success,
    ).toBe(false);
    expect(AddLineSchema.safeParse({ ...validLine, side: 'UP' }).success).toBe(false);
    expect(
      AddLineSchema.safeParse({ ...validLine, side: 'LEFT', organ: 'EAR', detail: '<b>Tashqi</b> quloq' })
        .success,
    ).toBe(true);
  });

  it('AddLineSchema sanitizes free text', () => {
    const r = AddLineSchema.safeParse({
      ...validLine,
      detail: '  <script>x</script>Gaymor sinusi ',
      note: 'a'.repeat(501),
    });
    expect(r.success).toBe(false);
    const ok = AddLineSchema.safeParse({ ...validLine, detail: '  <script>x</script>Gaymor sinusi ' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.detail).toBe('xGaymor sinusi');
  });

  it('UpdateLineSchema is partial but keeps quantity/discount rules', () => {
    expect(UpdateLineSchema.safeParse({}).success).toBe(true);
    expect(UpdateLineSchema.safeParse({ quantity: 2.25 }).success).toBe(false);
    expect(
      UpdateLineSchema.safeParse({ quantity: 2.5, discountType: 'PERCENT', discountValue: 101 }).success,
    ).toBe(false);
    expect(UpdateLineSchema.safeParse({ discountType: 'PERCENT', discountValue: 15 }).success).toBe(true);
  });

  it('GlobalDiscountSchema / CreateVisitSchema / UpdateVisitSchema', () => {
    expect(GlobalDiscountSchema.safeParse({ type: 'PERCENT', value: 101 }).success).toBe(false);
    expect(GlobalDiscountSchema.safeParse({ type: 'PERCENT', value: 10 }).success).toBe(true);
    expect(GlobalDiscountSchema.safeParse({ type: 'NONE' }).success).toBe(true);
    expect(CreateVisitSchema.safeParse({ patientId: 'p1' }).success).toBe(true);
    expect(CreateVisitSchema.safeParse({}).success).toBe(false);
    expect(UpdateVisitSchema.safeParse({ icd10: 'h66.0' }).success).toBe(true);
    const icd = UpdateVisitSchema.safeParse({ icd10: 'h66.0' });
    if (icd.success) expect(icd.data.icd10).toBe('H66.0');
    expect(UpdateVisitSchema.safeParse({ icd10: 'XYZ' }).success).toBe(false);
    expect(UpdateVisitSchema.safeParse({ icd10: '' }).success).toBe(true);
    expect(UpdateVisitSchema.safeParse({ unknownField: 1 }).success).toBe(false);
    expect(UpdateVisitSchema.safeParse({ complaint: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('ListVisitsQuerySchema validates dates and status', () => {
    const ok = ListVisitsQuerySchema.safeParse({
      from: '2026-09-15',
      to: '2026-09-15',
      status: 'OPEN',
      page: '2',
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.page).toBe(2);
      expect(ok.data.pageSize).toBe(20);
    }
    expect(ListVisitsQuerySchema.safeParse({ from: '15.09.2026' }).success).toBe(false);
    expect(ListVisitsQuerySchema.safeParse({ status: 'DONE' }).success).toBe(false);
  });
});

describe('useLineCalc / computeLine (pure calcLine)', () => {
  it('1.5 × 120 000 = 180 000 (criterion 1)', () => {
    const r = computeLine(SERVICE, base);
    expect(r.error).toBeNull();
    expect(r.values).toEqual({
      unitPrice: 120_000,
      gross: 180_000,
      discount: 0,
      net: 180_000,
      quantity: 1.5,
    });
  });

  it('switching patient type changes the price immediately (criterion 2)', () => {
    const r = computeLine(SERVICE, { ...base, patientType: 'CHILD' });
    expect(r.values?.unitPrice).toBe(90_000);
    expect(r.values?.net).toBe(135_000);
  });

  it('switching medicine changes the price immediately (criterion 3)', () => {
    expect(computeLine(SERVICE, { ...base, withMedicine: true }).values?.net).toBe(225_000);
    expect(computeLine(SERVICE, { ...base, withMedicine: true, patientType: 'CHILD' }).values?.net).toBe(
      165_000,
    );
  });

  it('medicineOptional=false always uses the "with medicine" price', () => {
    const forced = { ...SERVICE, medicineOptional: false };
    expect(computeLine(forced, { ...base, withMedicine: false }).values?.unitPrice).toBe(150_000);
    expect(
      computeLine(forced, { ...base, withMedicine: false, patientType: 'CHILD' }).values?.unitPrice,
    ).toBe(110_000);
  });

  it('percent and fixed discounts (criterion 6)', () => {
    const pct = computeLine(SERVICE, { ...base, discountType: 'PERCENT', discountValue: 10 });
    expect(pct.values).toEqual({
      unitPrice: 120_000,
      gross: 180_000,
      discount: 18_000,
      net: 162_000,
      quantity: 1.5,
    });
    const fixed = computeLine(SERVICE, { ...base, discountType: 'FIXED', discountValue: 25_000 });
    expect(fixed.values?.discount).toBe(25_000);
    expect(fixed.values?.net).toBe(155_000);
    // Chegirma summadan katta boʻlsa — summa bilan cheklanadi, net 0
    const capped = computeLine(SERVICE, { ...base, discountType: 'FIXED', discountValue: 999_999 });
    expect(capped.values?.discount).toBe(180_000);
    expect(capped.values?.net).toBe(0);
    // 12.5 % → 22 500 (yaxlitlash ROUND_HALF_UP)
    const half = computeLine(SERVICE, { ...base, discountType: 'PERCENT', discountValue: 12.5 });
    expect(half.values?.discount).toBe(22_500);
  });

  it('error codes: HALF_NOT_ALLOWED, INVALID_QUANTITY, INVALID_DISCOUNT, NO_SERVICE (criterion 4)', () => {
    expect(computeLine({ ...SERVICE, allowHalf: false }, { ...base, quantity: 0.5 }).error).toBe(
      'HALF_NOT_ALLOWED',
    );
    expect(computeLine({ ...SERVICE, allowHalf: false }, { ...base, quantity: 2 }).values?.net).toBe(240_000);
    expect(computeLine(SERVICE, { ...base, quantity: 1.3 }).error).toBe('INVALID_QUANTITY');
    expect(computeLine(SERVICE, { ...base, quantity: 0 }).error).toBe('INVALID_QUANTITY');
    expect(computeLine(SERVICE, { ...base, discountType: 'PERCENT', discountValue: 150 }).error).toBe(
      'INVALID_DISCOUNT',
    );
    expect(computeLine(SERVICE, { ...base, discountType: 'FIXED', discountValue: -1 }).error).toBe(
      'INVALID_DISCOUNT',
    );
    expect(computeLine(null, base).error).toBe('NO_SERVICE');
    expect(computeLine(SERVICE, { ...base, discountType: 'FIXED', discountValue: Number.NaN }).error).toBe(
      'INVALID_MONEY',
    );
  });

  it('useLineCalc recomputes on every prop change (hook)', () => {
    const { result, rerender } = renderHook(
      ({ service, input }: { service: LineCalcService; input: LineCalcInput }) => useLineCalc(service, input),
      {
        initialProps: { service: SERVICE, input: base },
      },
    );
    expect(result.current.values?.net).toBe(180_000);
    rerender({ service: SERVICE, input: { ...base, patientType: 'CHILD' } });
    expect(result.current.values?.net).toBe(135_000);
    rerender({ service: SERVICE, input: { ...base, patientType: 'CHILD', withMedicine: true } });
    expect(result.current.values?.net).toBe(165_000);
    rerender({
      service: SERVICE,
      input: { ...base, quantity: 2, discountType: 'PERCENT', discountValue: 25 },
    });
    expect(result.current.values).toEqual({
      unitPrice: 120_000,
      gross: 240_000,
      discount: 60_000,
      net: 180_000,
      quantity: 2,
    });
    rerender({ service: { ...SERVICE, allowHalf: false }, input: { ...base, quantity: 1.5 } });
    expect(result.current.error).toBe('HALF_NOT_ALLOWED');
    expect(result.current.values).toBeNull();
  });
});

describe('ICD-10 LOR data', () => {
  it('has ≥ 130 unique, well-formed ENT codes in both languages', () => {
    expect(ICD10_LOR.length).toBeGreaterThanOrEqual(130);
    const codes = new Set(ICD10_LOR.map((e) => e.code));
    expect(codes.size).toBe(ICD10_LOR.length);
    for (const e of ICD10_LOR) {
      expect(e.code).toMatch(/^[A-Z]\d{2}(\.\d{1,2})?$/);
      expect(e.uz.trim().length).toBeGreaterThan(2);
      expect(e.ru.trim().length).toBeGreaterThan(2);
      expect(e.uz).not.toMatch(/'/);
    }
    const ear = ICD10_LOR.filter((e) => /^H[6-9]\d/.test(e.code)).length;
    const resp = ICD10_LOR.filter((e) => /^J[0-3]\d/.test(e.code)).length;
    expect(ear).toBeGreaterThanOrEqual(45);
    expect(resp).toBeGreaterThanOrEqual(45);
  });

  it('searchIcd10 ranks code prefix, then title matches; respects limit and locale', () => {
    const byCode = searchIcd10('H66', 'uz', 10);
    expect(byCode.length).toBeGreaterThan(0);
    expect(byCode[0]?.code.startsWith('H66')).toBe(true);
    expect(byCode.every((e) => e.code.startsWith('H66'))).toBe(true);

    const exact = searchIcd10('j01.0', 'uz', 5);
    expect(exact[0]?.code).toBe('J01.0');

    const uz = searchIcd10('otit', 'uz', 50);
    expect(uz.length).toBeGreaterThan(5);
    expect(uz.every((e) => /otit/i.test(e.uz) || /отит/i.test(e.ru))).toBe(true);

    const ru = searchIcd10('гайморит', 'ru', 5);
    expect(ru.length).toBeGreaterThan(0);

    expect(searchIcd10('', 'uz', 7)).toHaveLength(7);
    expect(searchIcd10('zzzz-nothing', 'uz', 7)).toHaveLength(0);
    expect(searchIcd10('oʻrta otit', 'uz', 5)[0]?.uz.toLowerCase()).toContain('oʻrta otit');
  });

  it('findIcd10 / icd10Label', () => {
    const e = findIcd10(' h66.0 ');
    expect(e?.code).toBe('H66.0');
    expect(icd10Label(e!, 'ru')).toBe('H66.0 — Острый гнойный средний отит');
    expect(findIcd10('Z99')).toBeUndefined();
  });
});

describe('anatomy regions', () => {
  it('covers ear (L/R × outer/middle/inner), nose (passages, septum, sinuses L/R) and throat', () => {
    const ids = ANATOMY_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'ear_outer_L',
      'ear_middle_L',
      'ear_inner_L',
      'ear_outer_R',
      'ear_middle_R',
      'ear_inner_R',
    ])
      expect(ids).toContain(id);
    for (const id of [
      'nose_passage_L',
      'nose_passage_R',
      'nose_septum',
      'sinus_maxillary_L',
      'sinus_maxillary_R',
      'sinus_frontal_L',
      'sinus_frontal_R',
      'sinus_ethmoid_L',
      'sinus_ethmoid_R',
    ])
      expect(ids).toContain(id);
    for (const id of ['tonsil_L', 'tonsil_R', 'pharynx', 'larynx', 'vocal_cords']) expect(ids).toContain(id);
    expect(regionsForOrgan('EAR')).toHaveLength(6);
    expect(regionsForOrgan('LARYNX').map((r) => r.id)).toEqual(['larynx', 'vocal_cords']);
    expect(findRegion('nose_septum')?.side).toBeNull();
    expect(findRegion('ear_inner_L')?.side).toBe('LEFT');
  });

  it('matchRegionByDetail finds a region from stored detail text in either language', () => {
    const r = matchRegionByDetail('Gaymor (yuqori jagʻ) sinusi (oʻng)');
    expect(r?.id).toBe('sinus_maxillary_R');
    expect(r?.organ).toBe('NOSE');
    expect(r?.side).toBe('RIGHT');
    expect(matchRegionByDetail('Левая миндалина')?.id).toBe('tonsil_L');
    expect(matchRegionByDetail('boshqa matn')).toBeUndefined();
    expect(matchRegionByDetail(null)).toBeUndefined();
  });
});

describe('visit-utils', () => {
  const lines = [
    { grossTotal: 180_000, discountTotal: 18_000, lineTotal: 162_000 },
    { grossTotal: 90_000, discountTotal: 0, lineTotal: 90_000 },
    { grossTotal: 55_000, discountTotal: 5_000, lineTotal: 50_000 },
  ];

  it('sumLines / globalDiscountAmount / totalBeforeRounding use Decimal sums', () => {
    expect(sumLines(lines)).toEqual({ gross: 325_000, discount: 23_000, net: 302_000 });
    expect(globalDiscountAmount({ discount: 53_200 }, lines)).toBe(30_200);
    expect(globalDiscountAmount({ discount: 23_000 }, lines)).toBe(0);
    expect(totalBeforeRounding({ discount: 53_200 }, lines)).toBe(271_800);
    expect(sumLines([])).toEqual({ gross: 0, discount: 0, net: 0 });
  });

  it('patientAgeInfo respects the clinic child age limit', () => {
    const at = new Date('2026-09-15T10:00:00+05:00');
    expect(patientAgeInfo('2014-09-16', 14, at)).toEqual({ age: 11, type: 'CHILD' });
    expect(patientAgeInfo('2012-09-15', 14, at)).toEqual({ age: 14, type: 'ADULT' });
    expect(patientAgeInfo('2012-09-15', 16, at)).toEqual({ age: 14, type: 'CHILD' });
    expect(patientAgeInfo('1990-01-01', 14, at).type).toBe('ADULT');
  });

  it('paymentStateOf / isMeaningfulText', () => {
    expect(paymentStateOf({ totalNet: 100_000, paidAmount: 0 })).toBe('UNPAID');
    expect(paymentStateOf({ totalNet: 100_000, paidAmount: 40_000 })).toBe('PARTIAL');
    expect(paymentStateOf({ totalNet: 100_000, paidAmount: 100_000 })).toBe('PAID');
    expect(paymentStateOf({ totalNet: 100_000, paidAmount: 120_000 })).toBe('OVERPAID');
    expect(paymentStateOf({ totalNet: 0, paidAmount: 0 })).toBe('PAID');
    expect(isMeaningfulText('Penitsillin')).toBe(true);
    expect(isMeaningfulText('Yoʻq')).toBe(false);
    expect(isMeaningfulText("Yo'q")).toBe(false);
    expect(isMeaningfulText('Нет')).toBe(false);
    expect(isMeaningfulText('  ')).toBe(false);
    expect(isMeaningfulText(null)).toBe(false);
  });

  it('priceHint shows 4 prices for optional-medicine services and 2 for forced', () => {
    const svc = {
      priceAdultNoMed: 120_000,
      priceAdultMed: 150_000,
      priceChildNoMed: 90_000,
      priceChildMed: 110_000,
      medicineOptional: true,
    } as TreatmentServiceDTO;
    expect(priceHint(svc, { adult: 'K', child: 'B' })).toBe('K 120 000 / 150 000 · B 90 000 / 110 000');
    expect(priceHint({ ...svc, medicineOptional: false }, { adult: 'K', child: 'B' })).toBe(
      'K 150 000 · B 110 000',
    );
  });
});

describe('treatment draft store', () => {
  it('keeps last choices per visit and resets for another visit', () => {
    const store = useTreatmentDraft.getState();
    store.reset();
    expect(useTreatmentDraft.getState().draft).toEqual(EMPTY_DRAFT);
    store.setDraft({
      visitId: 'v1',
      serviceId: 's1',
      quantity: 1.5,
      patientType: 'CHILD',
      discountType: 'PERCENT',
      discountValue: 10,
    });
    expect(useTreatmentDraft.getState().draftFor('v1')?.quantity).toBe(1.5);
    expect(useTreatmentDraft.getState().draftFor('v2')).toBeNull();
    store.setDraft({ withMedicine: false });
    expect(useTreatmentDraft.getState().draftFor('v1')).toMatchObject({
      serviceId: 's1',
      withMedicine: false,
      patientType: 'CHILD',
    });
    store.reset();
    expect(useTreatmentDraft.getState().draftFor('v1')).toBeNull();
  });
});

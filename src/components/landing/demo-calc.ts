import { calcLine, calcVisit, CalcError, type DiscountType, type PatientType } from '@/lib/calc';
import { DEMO_SERVICES, findDemoService, type DemoService } from '@/data/demo-services';

/**
 * Landing demo kalkulyatori uchun sof (React siz) yordamchilar.
 * Formula CRM bilan bir xil: calcLine → calcVisit (src/lib/calc.ts), Decimal arifmetika.
 */

export interface DemoLineInput {
  serviceCode: string;
  patientType: PatientType;
  withMedicine: boolean;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface DemoLineResult {
  unitPrice: number;
  gross: number;
  discount: number;
  net: number;
  quantity: number;
  /** Amalda qoʻllangan "dori bilan" (medicineOptional=false boʻlsa doim true) */
  effectiveWithMedicine: boolean;
}

export interface DemoLine extends DemoLineInput {
  id: string;
  service: DemoService;
  result: DemoLineResult;
}

export interface DemoTotals {
  subtotal: number;
  totalRaw: number;
  total: number;
  /** total − totalRaw (yaxlitlash farqi, manfiy boʻlishi mumkin) */
  rounding: number;
  linesCount: number;
}

export type DemoCalcErrorCode = CalcError['code'] | 'SERVICE_NOT_FOUND';

export class DemoCalcError extends Error {
  constructor(public code: DemoCalcErrorCode) {
    super(code);
    this.name = 'DemoCalcError';
  }
}

export const DEMO_ROUND_TO = 100;

/** Bitta qatorni hisoblash — CalcError larni DemoCalcError ga oʻraydi */
export function computeDemoLine(input: DemoLineInput): DemoLineResult {
  const service = findDemoService(input.serviceCode);
  if (!service) throw new DemoCalcError('SERVICE_NOT_FOUND');
  try {
    const r = calcLine(
      {
        patientType: input.patientType,
        withMedicine: input.withMedicine,
        quantity: input.quantity,
        discountType: input.discountType,
        discountValue: input.discountValue,
      },
      service,
    );
    return {
      unitPrice: r.unitPrice.toNumber(),
      gross: r.gross.toNumber(),
      discount: r.discount.toNumber(),
      net: r.net.toNumber(),
      quantity: r.quantity.toNumber(),
      effectiveWithMedicine: service.medicineOptional ? input.withMedicine : true,
    };
  } catch (e) {
    if (e instanceof CalcError) throw new DemoCalcError(e.code);
    throw e;
  }
}

/** Xatosiz variant: notoʻgʻri kiritishda null */
export function tryComputeDemoLine(input: DemoLineInput): DemoLineResult | null {
  try {
    return computeDemoLine(input);
  } catch {
    return null;
  }
}

/** Butun qabul jamlari (calcVisit, 100 soʻmgacha yaxlitlash) */
export function computeDemoTotals(
  lines: Array<Pick<DemoLine, 'result'>>,
  roundTo = DEMO_ROUND_TO,
): DemoTotals {
  const totals = calcVisit(
    lines.map((l) => l.result.net),
    { type: 'NONE', value: 0 },
    [],
    roundTo,
  );
  return {
    subtotal: totals.subtotal.toNumber(),
    totalRaw: totals.totalRaw.toNumber(),
    total: totals.total.toNumber(),
    rounding: totals.total.minus(totals.totalRaw).toNumber(),
    linesCount: lines.length,
  };
}

let seq = 0;
export function nextDemoLineId(): string {
  seq += 1;
  return `demo-line-${seq}`;
}

/** Kiritishdan toʻliq qator yasash (xato boʻlsa tashlaydi) */
export function buildDemoLine(input: DemoLineInput, id = nextDemoLineId()): DemoLine {
  const service = findDemoService(input.serviceCode);
  if (!service) throw new DemoCalcError('SERVICE_NOT_FOUND');
  return { ...input, id, service, result: computeDemoLine(input) };
}

/** Sahifa ochilganda koʻrsatiladigan 5 ta namunaviy qator (5 xil xizmat, alohida hisob) */
export const DEFAULT_DEMO_LINE_INPUTS: DemoLineInput[] = [
  {
    serviceCode: 'N-001',
    patientType: 'ADULT',
    withMedicine: false,
    quantity: 1.5,
    discountType: 'NONE',
    discountValue: 0,
  },
  {
    serviceCode: 'D-001',
    patientType: 'ADULT',
    withMedicine: false,
    quantity: 1,
    discountType: 'NONE',
    discountValue: 0,
  },
  {
    serviceCode: 'E-001',
    patientType: 'CHILD',
    withMedicine: false,
    quantity: 1,
    discountType: 'NONE',
    discountValue: 0,
  },
  {
    serviceCode: 'N-005',
    patientType: 'ADULT',
    withMedicine: true,
    quantity: 2,
    discountType: 'NONE',
    discountValue: 0,
  },
  {
    serviceCode: 'F-002',
    patientType: 'ADULT',
    withMedicine: false,
    quantity: 5,
    discountType: 'PERCENT',
    discountValue: 10,
  },
];

export function buildDefaultDemoLines(): DemoLine[] {
  return DEFAULT_DEMO_LINE_INPUTS.map((input, i) => buildDemoLine(input, `demo-default-${i + 1}`));
}

/** Select uchun boshlangʻich xizmat kodi */
export const DEFAULT_DEMO_SERVICE_CODE = DEMO_SERVICES[0]?.code ?? 'N-001';

/** Chegirma matnini raqamga: "12,5" → 12.5; boʻsh → 0; notoʻgʻri → NaN */
export function parseDiscountInput(raw: string): number {
  const s = raw.replace(/\s/g, '').replace(',', '.');
  if (s === '') return 0;
  if (!/^\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Number(s);
}

/** Chegirma qiymati toʻgʻrimi (foiz ≤ 100, manfiy emas, son) */
export function isDiscountValid(type: DiscountType, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  if (type === 'PERCENT' && value > 100) return false;
  return true;
}

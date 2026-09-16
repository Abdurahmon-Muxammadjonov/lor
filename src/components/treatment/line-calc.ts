import { useMemo } from 'react';
import {
  CalcError,
  calcLine,
  lineResultToJson,
  type CalcErrorCode,
  type DiscountType,
  type PatientType,
  type ServicePricing,
} from '@/lib/calc';
import { MoneyError } from '@/lib/money';

/**
 * Sof (pure) qator kalkulyatori — `calcLine` ustidan yupqa qatlam.
 * UI har qanday oʻzgarishda `useLineCalc` orqali darhol qayta hisoblaydi (qabul mezonlari 1–3, 6).
 */

export type LineCalcErrorCode = CalcErrorCode | 'INVALID_MONEY' | 'NO_SERVICE';

export interface LineCalcInput {
  patientType: PatientType;
  withMedicine: boolean;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
}

/** Butun soʻm (number) koʻrinishidagi natija */
export interface LineCalcValues {
  unitPrice: number;
  gross: number;
  discount: number;
  net: number;
  quantity: number;
}

export interface LineCalcState {
  values: LineCalcValues | null;
  error: LineCalcErrorCode | null;
}

/** Xizmat narxlari (API dan number) → calcLine uchun */
export type LineCalcService = ServicePricing;

export function computeLine(
  service: LineCalcService | null | undefined,
  input: LineCalcInput,
): LineCalcState {
  if (!service) return { values: null, error: 'NO_SERVICE' };
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
    return { values: lineResultToJson(r), error: null };
  } catch (e) {
    if (e instanceof CalcError) return { values: null, error: e.code };
    if (e instanceof MoneyError) return { values: null, error: 'INVALID_MONEY' };
    throw e;
  }
}

/**
 * React hook: har bir kirish qiymati oʻzgarganda `useMemo` orqali qayta hisoblaydi.
 *
 *   const { values, error } = useLineCalc(service, { patientType, withMedicine, quantity, discountType, discountValue });
 */
export function useLineCalc(
  service: LineCalcService | null | undefined,
  input: LineCalcInput,
): LineCalcState {
  const { patientType, withMedicine, quantity, discountType, discountValue } = input;
  const priceAdultNoMed = service?.priceAdultNoMed;
  const priceAdultMed = service?.priceAdultMed;
  const priceChildNoMed = service?.priceChildNoMed;
  const priceChildMed = service?.priceChildMed;
  const allowHalf = service?.allowHalf;
  const medicineOptional = service?.medicineOptional;
  const hasService = service !== null && service !== undefined;

  return useMemo(
    () =>
      computeLine(
        hasService
          ? {
              priceAdultNoMed: priceAdultNoMed ?? 0,
              priceAdultMed: priceAdultMed ?? 0,
              priceChildNoMed: priceChildNoMed ?? 0,
              priceChildMed: priceChildMed ?? 0,
              allowHalf: allowHalf ?? true,
              medicineOptional: medicineOptional ?? true,
            }
          : null,
        { patientType, withMedicine, quantity, discountType, discountValue },
      ),
    // Narx maydonlari alohida sanab oʻtilgan — xizmat obyekti qayta yaratilsa ham keraksiz hisob boʻlmaydi
    [
      hasService,
      priceAdultNoMed,
      priceAdultMed,
      priceChildNoMed,
      priceChildMed,
      allowHalf,
      medicineOptional,
      patientType,
      withMedicine,
      quantity,
      discountType,
      discountValue,
    ],
  );
}

'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatQuantity, type DiscountType, type PatientType } from '@/lib/calc';
import { useT } from '@/i18n/client';
import { Money } from '@/components/shared/money';
import { useLineCalc, type LineCalcService, type LineCalcState } from './line-calc';

export { useLineCalc, computeLine } from './line-calc';
export type {
  LineCalcInput,
  LineCalcValues,
  LineCalcState,
  LineCalcErrorCode,
  LineCalcService,
} from './line-calc';

export interface TreatmentLineCalculatorProps {
  /** Xizmat narxlari (null — xizmat tanlanmagan) */
  service: LineCalcService | null | undefined;
  patientType: PatientType;
  withMedicine: boolean;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  /** Birlik nomi ("ta", "seans") — "1.5 × 120 000" qatorida koʻrsatiladi */
  unit?: string;
  /** Har bir qayta hisobda chaqiriladi (natija yoki xato) */
  onChange?: (state: LineCalcState) => void;
  /** Xatolarni tashqarida koʻrsatish uchun yashirish */
  hideError?: boolean;
  className?: string;
}

/**
 * Sof, qayta ishlatiladigan jonli hisob bloki:
 *   Birlik narx · Summa (miqdor × birlik) · Chegirma (−) · JAMI
 * Har qanday prop oʻzgarishida `useMemo(calcLine)` orqali darhol yangilanadi.
 */
export function TreatmentLineCalculator({
  service,
  patientType,
  withMedicine,
  quantity,
  discountType,
  discountValue,
  unit,
  onChange,
  hideError = false,
  className,
}: TreatmentLineCalculatorProps) {
  const t = useT();
  const state = useLineCalc(service, { patientType, withMedicine, quantity, discountType, discountValue });
  const { values, error } = state;

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(() => {
    onChangeRef.current?.(state);
  }, [state]);

  const discountHint =
    values && discountType === 'PERCENT' && discountValue > 0
      ? `${discountValue} %`
      : values && discountType === 'FIXED' && discountValue > 0
        ? t('common.discountType.FIXED')
        : null;

  const errorText = error && error !== 'NO_SERVICE' ? t(`visits.errors.${error}`) : null;

  return (
    <div
      className={cn('glass rounded-xl p-4', className)}
      role="status"
      aria-live="polite"
      aria-label={t('visits.dialog.calcTitle')}
      data-testid="line-calculator"
    >
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">{t('common.unitPrice')}</dt>
          <dd className="tabular font-medium text-text">
            {values ? <Money value={values.unitPrice} /> : <span className="text-text-muted">—</span>}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">
            {t('common.sum')}
            {values ? (
              <span className="ml-1.5 text-xs text-muted-foreground/80">
                ({formatQuantity(values.quantity)}
                {unit ? ` ${unit}` : ''} × <Money value={values.unitPrice} suffix={null} />)
              </span>
            ) : null}
          </dt>
          <dd className="tabular font-medium text-text">
            {values ? <Money value={values.gross} /> : <span className="text-text-muted">—</span>}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-muted">
            {t('common.discount')}
            {discountHint ? (
              <span className="ml-1.5 text-xs text-muted-foreground/80">({discountHint})</span>
            ) : null}
          </dt>
          <dd
            className={cn(
              'tabular font-medium',
              values && values.discount > 0 ? 'text-warning' : 'text-text-muted',
            )}
          >
            {values ? (
              values.discount > 0 ? (
                <>
                  − <Money value={values.discount} />
                </>
              ) : (
                <Money value={0} />
              )
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="my-1 h-px bg-line" aria-hidden="true" />
        <div className="flex items-end justify-between gap-3">
          <dt className="font-heading text-sm font-semibold uppercase tracking-wider text-text">
            {t('common.total')}
          </dt>
          <dd className="tabular font-heading text-2xl font-bold leading-none" data-testid="line-total">
            {values ? (
              <Money value={values.net} className="text-gradient" />
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </dd>
        </div>
      </dl>
      {!hideError && errorText ? (
        <p
          className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-danger"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{errorText}</span>
        </p>
      ) : null}
    </div>
  );
}

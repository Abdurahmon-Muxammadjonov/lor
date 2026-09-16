'use client';

import * as React from 'react';
import { AlertCircle, Check, CloudUpload, FileText, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import type { UpdateVisitInput } from '@/lib/visits/schemas';
import type { VisitDetailDTO } from '@/lib/visits/dto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Icd10Select } from './icd10-select';

export type ClinicalField =
  'complaint' | 'anamnesis' | 'examination' | 'diagnosis' | 'icd10' | 'plan' | 'recommendations';
export type ClinicalValues = Record<ClinicalField, string>;

export interface DiagnosisFormProps {
  visit: Pick<
    VisitDetailDTO,
    'id' | 'complaint' | 'anamnesis' | 'examination' | 'diagnosis' | 'icd10' | 'plan' | 'recommendations'
  >;
  readOnly: boolean;
  /** Oʻzgargan maydonlarni serverga yuborish (xato boʻlsa otadi) */
  onSave: (patch: UpdateVisitInput) => Promise<void>;
  className?: string;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 800;
const MAX = 2000;

const TEXTAREAS: Array<{ key: Exclude<ClinicalField, 'icd10' | 'diagnosis'>; rows: number }> = [
  { key: 'complaint', rows: 3 },
  { key: 'anamnesis', rows: 3 },
  { key: 'examination', rows: 3 },
  { key: 'plan', rows: 3 },
  { key: 'recommendations', rows: 3 },
];

export function pickClinical(v: DiagnosisFormProps['visit']): ClinicalValues {
  return {
    complaint: v.complaint ?? '',
    anamnesis: v.anamnesis ?? '',
    examination: v.examination ?? '',
    diagnosis: v.diagnosis ?? '',
    icd10: v.icd10 ?? '',
    plan: v.plan ?? '',
    recommendations: v.recommendations ?? '',
  };
}

/**
 * Klinik maydonlar: shikoyat, anamnez, koʻrik, tashxis (+ ICD-10), reja, tavsiyalar.
 * 800 ms debounce bilan avtomatik saqlanadi; "Saqlandi" indikatori; xatoda qayta urinish.
 */
export function DiagnosisForm({ visit, readOnly, onSave, className }: DiagnosisFormProps) {
  const { t } = useLocale();
  const [values, setValues] = React.useState<ClinicalValues>(() => pickClinical(visit));
  const [state, setState] = React.useState<SaveState>('idle');
  const pendingRef = React.useRef<Partial<ClinicalValues>>({});
  const timerRef = React.useRef<number>(0);
  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;

  // Boshqa qabul ochilsa — qiymatlarni qayta yuklash
  const visitId = visit.id;
  React.useEffect(() => {
    setValues(pickClinical(visit));
    pendingRef.current = {};
    setState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  const flush = React.useCallback(async () => {
    window.clearTimeout(timerRef.current);
    const patch = pendingRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingRef.current = {};
    setState('saving');
    try {
      await onSaveRef.current(patch);
      setState(Object.keys(pendingRef.current).length > 0 ? 'dirty' : 'saved');
    } catch {
      // Saqlanmagan qiymatlarni qaytarib qoʻyamiz (keyingi urinishda yuboriladi)
      pendingRef.current = { ...patch, ...pendingRef.current };
      setState('error');
    }
  }, []);

  const schedule = React.useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), AUTOSAVE_MS);
  }, [flush]);

  React.useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const change = (key: ClinicalField, value: string) => {
    if (readOnly) return;
    setValues((s) => ({ ...s, [key]: value }));
    pendingRef.current[key] = value;
    setState('dirty');
    schedule();
  };

  const onIcd = (code: string | null, title: string | null) => {
    if (readOnly) return;
    setValues((s) => {
      const next = { ...s, icd10: code ?? '' };
      pendingRef.current.icd10 = code ?? '';
      // Tashxis boʻsh boʻlsa — kod nomi bilan toʻldirish
      if (code && title && !s.diagnosis.trim()) {
        next.diagnosis = title;
        pendingRef.current.diagnosis = title;
      }
      return next;
    });
    setState('dirty');
    schedule();
  };

  const indicator = (() => {
    switch (state) {
      case 'saving':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t('visits.diagnosis.saving')}
          </span>
        );
      case 'saved':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#00FFB2]" role="status">
            <Check className="size-3.5" aria-hidden="true" />
            {t('visits.diagnosis.saved')}
          </span>
        );
      case 'dirty':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted" role="status">
            <CloudUpload className="size-3.5" aria-hidden="true" />
            {t('visits.diagnosis.unsaved')}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-2 text-xs text-danger" role="alert">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            {t('visits.diagnosis.error')}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => void flush()}
            >
              <RotateCcw aria-hidden="true" />
              {t('visits.diagnosis.retry')}
            </Button>
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <section className={cn('glass rounded-2xl p-4 sm:p-5', className)} aria-labelledby="diagnosis-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id="diagnosis-title"
            className="flex items-center gap-2 font-heading text-lg font-semibold text-text"
          >
            <FileText className="size-5 text-accent" aria-hidden="true" />
            {t('visits.diagnosis.title')}
          </h2>
          {!readOnly ? <p className="text-xs text-text-muted">{t('visits.diagnosis.description')}</p> : null}
        </div>
        <div className="min-h-5 shrink-0" aria-live="polite">
          {indicator}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TEXTAREAS.slice(0, 3).map(({ key, rows }) => (
          <Field
            key={key}
            id={`dx-${key}`}
            label={t(`visits.diagnosis.${key}`)}
            count={values[key].length}
            className={key === 'examination' ? 'md:col-span-2' : undefined}
          >
            <Textarea
              id={`dx-${key}`}
              rows={rows}
              maxLength={MAX}
              value={values[key]}
              readOnly={readOnly}
              onChange={(e) => change(key, e.target.value)}
              onBlur={() => void flush()}
              placeholder={readOnly ? '—' : t(`visits.diagnosis.${key}Placeholder`)}
              className="resize-y"
            />
          </Field>
        ))}

        <Field id="dx-diagnosis" label={t('visits.diagnosis.diagnosis')} count={values.diagnosis.length}>
          <Input
            id="dx-diagnosis"
            maxLength={MAX}
            value={values.diagnosis}
            readOnly={readOnly}
            onChange={(e) => change('diagnosis', e.target.value)}
            onBlur={() => void flush()}
            placeholder={readOnly ? '—' : t('visits.diagnosis.diagnosisPlaceholder')}
            className="font-medium"
          />
        </Field>
        <Field id="dx-icd10" label={t('visits.diagnosis.icd10')}>
          <Icd10Select id="dx-icd10" value={values.icd10 || null} onChange={onIcd} disabled={readOnly} />
        </Field>

        {TEXTAREAS.slice(3).map(({ key, rows }) => (
          <Field key={key} id={`dx-${key}`} label={t(`visits.diagnosis.${key}`)} count={values[key].length}>
            <Textarea
              id={`dx-${key}`}
              rows={rows}
              maxLength={MAX}
              value={values[key]}
              readOnly={readOnly}
              onChange={(e) => change(key, e.target.value)}
              onBlur={() => void flush()}
              placeholder={readOnly ? '—' : t(`visits.diagnosis.${key}Placeholder`)}
              className="resize-y"
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  count,
  className,
  children,
}: {
  id: string;
  label: string;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {count !== undefined && count > MAX * 0.8 ? (
          <span className="tabular text-[11px] text-text-muted">
            {t('visits.diagnosis.chars', { n: count, max: MAX })}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

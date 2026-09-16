'use client';

import * as React from 'react';
import type { Organ, Side } from '@prisma/client';
import { Ear, Mic2, Wind, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import {
  ANATOMY_DECOR,
  ANATOMY_REGIONS,
  ANATOMY_VIEWBOX,
  matchRegionByDetail,
  regionLabel,
  type AnatomyGroup,
  type AnatomyRegion,
} from '@/data/anatomy';
import { Segmented } from '@/components/ui/segmented';
import { Button } from '@/components/ui/button';

export interface AnatomyValue {
  organ: Organ | null;
  side: Side | null;
  detail: string;
}

export interface AnatomySelectorProps {
  value: AnatomyValue;
  onChange: (value: AnatomyValue) => void;
  disabled?: boolean;
  className?: string;
}

function groupOfOrgan(organ: Organ | null): AnatomyGroup | null {
  switch (organ) {
    case 'EAR':
      return 'EAR';
    case 'NOSE':
      return 'NOSE';
    case 'THROAT':
    case 'LARYNX':
      return 'THROAT';
    default:
      return null;
  }
}

/** Tanlangan qiymatga mos soha (detail + organ + side boʻyicha) */
function selectedRegion(value: AnatomyValue): AnatomyRegion | undefined {
  const r = matchRegionByDetail(value.detail);
  if (!r) return undefined;
  if (value.organ && r.organ !== value.organ) return undefined;
  if ((value.side ?? null) !== (r.side ?? null)) return undefined;
  return r;
}

/**
 * Interaktiv LOR sxemasi (yuz — quloq/burun/tomoq). Sohani bosish organ + tomon + aniqlikni beradi.
 * Bemorning OʻNG tomoni sxemada CHAPda (tibbiy standart). Klaviatura: Tab → Enter/Space.
 */
export function AnatomySelector({ value, onChange, disabled = false, className }: AnatomySelectorProps) {
  const { locale, t } = useLocale();
  const selected = React.useMemo(() => selectedRegion(value), [value]);
  const [group, setGroup] = React.useState<AnatomyGroup>(() => groupOfOrgan(value.organ) ?? 'NOSE');

  // Tashqi organ oʻzgarsa (masalan xizmatning defaultOrgan) — guruhni moslash
  React.useEffect(() => {
    const g = groupOfOrgan(value.organ);
    if (g) setGroup(g);
  }, [value.organ]);

  const pick = (r: AnatomyRegion) => {
    if (disabled) return;
    if (selected?.id === r.id) {
      onChange({ organ: r.organ, side: null, detail: '' });
      return;
    }
    onChange({ organ: r.organ, side: r.side, detail: regionLabel(r, locale) });
  };

  const clear = () => onChange({ organ: value.organ, side: null, detail: '' });

  const groupOptions = [
    { value: 'EAR' as const, label: t('visits.anatomy.groups.EAR'), icon: <Ear aria-hidden="true" /> },
    { value: 'NOSE' as const, label: t('visits.anatomy.groups.NOSE'), icon: <Wind aria-hidden="true" /> },
    { value: 'THROAT' as const, label: t('visits.anatomy.groups.THROAT'), icon: <Mic2 aria-hidden="true" /> },
  ];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          value={group}
          onChange={setGroup}
          options={groupOptions}
          size="sm"
          ariaLabel={t('visits.dialog.organ')}
          disabled={disabled}
        />
        <span className="text-[11px] text-text-muted">{t('visits.anatomy.legend')}</span>
      </div>

      <div className="rounded-xl border border-line bg-bg-elevated p-2">
        <svg
          viewBox={ANATOMY_VIEWBOX}
          role="group"
          aria-label={t('visits.anatomy.title')}
          className="mx-auto block h-auto w-full max-w-[340px] select-none"
        >
          <defs>
            <filter id="anatomy-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Bezak chiziqlar (bosilmaydi) */}
          <g
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth={1.2}
            strokeOpacity={0.45}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d={ANATOMY_DECOR.face} />
            <path d={ANATOMY_DECOR.neck} />
            <path d={ANATOMY_DECOR.eyeRight} />
            <path d={ANATOMY_DECOR.eyeLeft} />
            <path d={ANATOMY_DECOR.nose} />
            <path d={ANATOMY_DECOR.mouth} />
          </g>
          <g fill="var(--text-muted)" fontSize={10} fontFamily="inherit" aria-hidden="true">
            <text x={46} y={76} textAnchor="middle">
              {t('visits.anatomy.patientRight')}
            </text>
            <text x={274} y={76} textAnchor="middle">
              {t('visits.anatomy.patientLeft')}
            </text>
          </g>

          {ANATOMY_REGIONS.map((r) => {
            const isSelected = selected?.id === r.id;
            const inGroup = r.group === group;
            const label = regionLabel(r, locale);
            const common = {
              className: cn(
                'cursor-pointer outline-none transition-[fill,stroke,stroke-width] duration-150',
                'focus-visible:stroke-[#EAF0FF] focus-visible:[stroke-width:2.5]',
                disabled && 'cursor-not-allowed',
                isSelected
                  ? 'fill-[rgba(0,212,255,0.45)] stroke-[#00D4FF] [stroke-width:2]'
                  : inGroup
                    ? 'fill-[rgba(0,212,255,0.10)] stroke-[rgba(0,212,255,0.55)] [stroke-width:1.4] hover:fill-[rgba(0,212,255,0.28)]'
                    : 'fill-[rgba(138,153,184,0.06)] stroke-[rgba(138,153,184,0.35)] [stroke-width:1] hover:fill-[rgba(0,212,255,0.16)]',
              ),
              filter: isSelected ? 'url(#anatomy-glow)' : undefined,
            };
            return (
              <g
                key={r.id}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={label}
                aria-pressed={isSelected}
                aria-disabled={disabled || undefined}
                data-region={r.id}
                onClick={() => pick(r)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick(r);
                  }
                }}
                className="outline-none [&:focus-visible>*]:stroke-[#EAF0FF]"
              >
                <title>{label}</title>
                {r.shape.kind === 'ellipse' ? (
                  <ellipse cx={r.shape.cx} cy={r.shape.cy} rx={r.shape.rx} ry={r.shape.ry} {...common} />
                ) : (
                  <path d={r.shape.d} {...common} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex min-h-8 items-center justify-between gap-2 text-sm" aria-live="polite">
        {selected ? (
          <>
            <span className="min-w-0 truncate">
              <span className="text-text-muted">{t('visits.anatomy.selected')}: </span>
              <span className="font-medium text-text">{regionLabel(selected, locale)}</span>
            </span>
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clear}
                className="shrink-0 gap-1 text-text-muted"
              >
                <X aria-hidden="true" />
                {t('visits.anatomy.clear')}
              </Button>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-text-muted">{t('visits.anatomy.hint')}</span>
        )}
      </div>
    </div>
  );
}

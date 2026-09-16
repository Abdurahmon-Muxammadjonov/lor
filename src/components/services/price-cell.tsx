'use client';

import * as React from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney, groupDigits, parseMoneyInput } from '@/lib/money';
import { useT } from '@/i18n/client';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PriceField } from '@/lib/services/schemas';

export interface PriceCellProps {
  field: PriceField;
  value: number;
  /** Ekran oʻquvchi va tooltip uchun (masalan "Kattalar · dorisiz") */
  label: string;
  canEdit: boolean;
  /** Ishlatilmaydigan narx (medicineOptional=false → dorisiz) */
  dimmed?: boolean;
  dimmedHint?: string;
  onSave: (field: PriceField, value: number) => Promise<void>;
  className?: string;
}

/**
 * Inline tahrirlanadigan narx katagi: bosish/Enter → input (raqamlar guruhlanadi),
 * Enter/blur → saqlash (faqat oʻzgargan boʻlsa), Esc → bekor.
 */
export function PriceCell({ field, value, label, canEdit, dimmed, dimmedHint, onSave, className }: PriceCellProps) {
  const t = useT();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const doneRef = React.useRef(false);

  const start = () => {
    if (!canEdit || saving) return;
    doneRef.current = false;
    setDraft(String(value));
    setEditing(true);
  };

  React.useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      el?.focus();
      el?.select();
    }
  }, [editing]);

  const finish = (restoreFocus: boolean) => {
    setEditing(false);
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const commit = async (restoreFocus: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const next = Number(parseMoneyInput(draft) || '0');
    if (!Number.isFinite(next) || next === value) {
      finish(restoreFocus);
      return;
    }
    setSaving(true);
    finish(restoreFocus);
    try {
      await onSave(field, next);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    doneRef.current = true;
    finish(true);
  };

  const display = (
    <span className={cn('tabular text-sm font-medium text-text', dimmed && 'text-text-muted opacity-70')}>
      {formatMoney(value, { suffix: '' })}
    </span>
  );

  if (!canEdit) {
    const node = (
      <span className={cn('inline-flex h-8 items-center justify-end px-1.5', className)} aria-label={`${label}: ${formatMoney(value)}`}>
        {display}
      </span>
    );
    return dimmed && dimmedHint ? (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent>{dimmedHint}</TooltipContent>
      </Tooltip>
    ) : (
      node
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={groupDigits(draft)}
        aria-label={t('services.prices.edit', { label })}
        onChange={(e) => setDraft(parseMoneyInput(e.target.value).slice(0, 12))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }
        }}
        onBlur={() => void commit(false)}
        className={cn(
          'h-8 w-full min-w-[6.5rem] rounded-md border border-accent bg-bg-elevated px-1.5 text-right text-sm text-text shadow-glow tabular',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
          className,
        )}
      />
    );
  }

  const button = (
    <button
      ref={buttonRef}
      type="button"
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      }}
      aria-label={t('services.prices.edit', { label })}
      aria-busy={saving || undefined}
      title={dimmed && dimmedHint ? dimmedHint : t('services.prices.editHint')}
      className={cn(
        'group/price inline-flex h-8 w-full min-w-[6.5rem] items-center justify-end gap-1.5 rounded-md border border-transparent px-1.5 text-right transition-[border-color,background-color,box-shadow] duration-150',
        'hover:border-border/70 hover:bg-popover/60 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
        saving && 'cursor-progress',
        className,
      )}
    >
      {saving ? (
        <Spinner size="xs" label={t('common.saving')} />
      ) : (
        <Pencil
          aria-hidden="true"
          className="size-3 shrink-0 text-text-muted opacity-0 transition-opacity group-hover/price:opacity-70 group-focus-visible/price:opacity-70"
        />
      )}
      {display}
    </button>
  );

  return dimmed && dimmedHint ? (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{dimmedHint}</TooltipContent>
    </Tooltip>
  ) : (
    button
  );
}

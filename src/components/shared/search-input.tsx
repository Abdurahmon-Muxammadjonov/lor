'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Kbd } from '@/components/ui/kbd';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> {
  value: string;
  /** Debounce dan keyin chaqiriladi (tozalash va Enter — darhol) */
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** ms (default 300); 0 — darhol */
  debounce?: number;
  className?: string;
  /** Oʻng tomonda spinner */
  loading?: boolean;
  /** Enter bosilganda (joriy qiymat bilan) */
  onEnter?: (value: string) => void;
  /** Oʻng tomonda klaviatura yorligʻi (masalan "⌘K") — faqat boʻsh boʻlganda koʻrinadi */
  shortcut?: string;
  /** Oʻlcham */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE = { sm: 'h-9 pl-8 pr-8 text-xs', md: 'h-10 pl-9 pr-9 text-sm', lg: 'h-12 pl-11 pr-11 text-base' } as const;
const ICON = { sm: 'left-2.5 size-3.5', md: 'left-3 size-4', lg: 'left-3.5 size-5' } as const;

/**
 * Qidiruv maydoni: Search ikonkasi, tozalash (X), debounce, Esc — tozalaydi, Enter — darhol yuboradi.
 *
 *   <SearchInput value={q} onChange={setQ} placeholder={t('patients.searchPlaceholder')} loading={isFetching} />
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    { value, onChange, placeholder, autoFocus, debounce = 300, className, loading = false, onEnter, shortcut, size = 'md', onKeyDown, disabled, ...props },
    ref,
  ) => {
    const t = useT();
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const [inner, setInner] = React.useState(value);
    const lastEmitted = React.useRef(value);
    const timer = React.useRef<number>(0);

    const setRefs = (el: HTMLInputElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    };

    // Tashqi qiymat oʻzgarsa (masalan filtrlar tiklandi) — ichkini moslash
    React.useEffect(() => {
      if (value !== lastEmitted.current) {
        lastEmitted.current = value;
        setInner(value);
      }
    }, [value]);

    React.useEffect(() => () => window.clearTimeout(timer.current), []);

    const emit = React.useCallback(
      (v: string) => {
        window.clearTimeout(timer.current);
        if (lastEmitted.current === v) return;
        lastEmitted.current = v;
        onChange(v);
      },
      [onChange],
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setInner(v);
      window.clearTimeout(timer.current);
      if (debounce <= 0) {
        emit(v);
        return;
      }
      timer.current = window.setTimeout(() => emit(v), debounce);
    };

    const clear = () => {
      setInner('');
      emit('');
      innerRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (inner) {
          e.preventDefault();
          e.stopPropagation();
          clear();
        }
        return;
      }
      if (e.key === 'Enter') {
        emit(inner);
        onEnter?.(inner);
      }
    };

    const showClear = inner.length > 0 && !loading && !disabled;

    return (
      <div className={cn('relative w-full', className)}>
        <Search aria-hidden="true" className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-muted', ICON[size])} />
        <Input
          ref={setRefs}
          type="search"
          value={inner}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('common.search')}
          aria-label={props['aria-label'] ?? placeholder ?? t('common.search')}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          className={cn(SIZE[size], shortcut && !inner && 'pr-14')}
          {...props}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading ? <Spinner size="sm" label={t('common.loading')} /> : null}
          {showClear ? (
            <button
              type="button"
              onClick={clear}
              aria-label={t('common.clear')}
              className="flex size-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
          {shortcut && !inner && !loading ? <Kbd className="hidden sm:inline-flex">{shortcut}</Kbd> : null}
        </div>
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';

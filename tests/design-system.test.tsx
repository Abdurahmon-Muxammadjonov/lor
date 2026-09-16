/** @vitest-environment jsdom */
import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { common } from '@/i18n/messages/common';
import { getMessages } from '@/i18n/messages';
import type { Tree } from '@/i18n/types';
import { makeT } from '@/i18n/t';
import type { Locale } from '@/i18n/config';
import { NumberStepper, normalizeStepperValue } from '@/components/ui/number-stepper';
import { Segmented } from '@/components/ui/segmented';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDebounce } from '@/hooks/use-debounce';
import { useHotkey, formatHotkey } from '@/hooks/use-hotkey';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useMediaQuery } from '@/hooks/use-media-query';

// LocaleProvider next/navigation ga bogʻliq — testda kontekstni toʻgʻridan-toʻgʻri mock qilamiz
let currentLocale: Locale = 'uz';
vi.mock('@/i18n/client', () => ({
  useLocale: () => ({
    locale: currentLocale,
    setLocale: (l: Locale) => {
      currentLocale = l;
    },
    t: makeT(getMessages(), currentLocale),
  }),
  useT: () => makeT(getMessages(), currentLocale),
}));

// vitest jsdom muhitida localStorage global ga koʻchirilmaydi — oddiy xotira stub
function installLocalStorage() {
  const store = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
  Object.defineProperty(window, 'localStorage', { value: stub, configurable: true });
}
installLocalStorage();

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  currentLocale = 'uz';
});

function wrap(locale: Locale = 'uz') {
  currentLocale = locale;
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
}

// ───────────────────────── i18n common ─────────────────────────

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keyPaths(v, `${prefix}${k}.`),
  );
}
function leaves(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : leaves(v)));
}

describe('common messages', () => {
  it('uz va ru kalitlari bir xil', () => {
    expect(keyPaths(common.ru as Tree).sort()).toEqual(keyPaths(common.uz as Tree).sort());
  });

  it('CONTRACTS §5 dagi barcha majburiy kalitlar mavjud', () => {
    const keys = new Set(keyPaths(common.uz as Tree));
    const required = [
      'save', 'cancel', 'delete', 'edit', 'add', 'search', 'close', 'back', 'next', 'confirm', 'yes', 'no', 'loading',
      'noData', 'error', 'success', 'currency', 'today', 'yesterday', 'date', 'time', 'status', 'actions', 'total',
      'all', 'print', 'export', 'filter', 'name', 'phone', 'birthDate', 'gender.male', 'gender.female',
      'role.SUPER_ADMIN', 'role.ADMIN', 'role.DOCTOR', 'role.RECEPTION', 'role.CASHIER', 'patientType.ADULT',
      'patientType.CHILD', 'withMedicine', 'withoutMedicine', 'side.LEFT', 'side.RIGHT', 'side.BOTH', 'organ.EAR',
      'organ.NOSE', 'organ.THROAT', 'organ.LARYNX', 'organ.OTHER', 'payMethod.CASH', 'payMethod.CARD',
      'payMethod.TRANSFER', 'payMethod.CLICK', 'payMethod.PAYME', 'queueStatus.WAITING', 'queueStatus.CALLED',
      'queueStatus.SERVING', 'queueStatus.DONE', 'queueStatus.SKIPPED', 'visitStatus.OPEN', 'visitStatus.COMPLETED',
      'visitStatus.CANCELLED', 'appointmentStatus.SCHEDULED', 'appointmentStatus.CONFIRMED',
      'appointmentStatus.ARRIVED', 'appointmentStatus.DONE', 'appointmentStatus.CANCELLED',
      'appointmentStatus.NO_SHOW', 'queueType.DOCTOR', 'queueType.RECHECK', 'queueType.LAB', 'queueType.CASHIER',
      'nav.dashboard', 'nav.queue', 'nav.patients', 'nav.visits', 'nav.appointments', 'nav.cashier', 'nav.services',
      'nav.doctors', 'nav.reports', 'nav.settings', 'nav.kiosk', 'nav.display', 'nav.logout', 'nav.profile',
      'validation.required', 'validation.phone', 'validation.min', 'validation.max', 'validation.email',
      'validation.password', 'validation.invalid', 'age', 'years', 'sum', 'discount', 'quantity', 'unitPrice',
      'subtotal', 'paid', 'balance', 'debt', 'change', 'doctor', 'patient', 'cashier', 'clinic', 'notFound.title',
      'notFound.description', 'notFound.back', 'errorPage.title', 'errorPage.description', 'errorPage.retry',
      'language', 'uz', 'ru', 'more', 'less', 'select', 'optional', 'required', 'pageOf', 'showing', 'perPage',
      'refresh', 'download', 'open', 'view', 'details', 'created', 'updated', 'notes', 'comment', 'yesDelete',
      'deleteConfirm', 'unsaved', 'saveChanges', 'copied', 'copy', 'retry', 'denied.title', 'denied.description',
      'appName', 'tagline',
    ];
    const missing = required.filter((k) => !keys.has(k));
    expect(missing).toEqual([]);
  });

  it('matnlar boʻsh emas, uz da ASCII apostrof yoʻq, currency toʻgʻri', () => {
    for (const s of leaves(common.uz as Tree)) {
      expect(s.length).toBeGreaterThan(0);
      expect(s).not.toMatch(/[A-Za-z]'[A-Za-z]/);
    }
    for (const s of leaves(common.ru as Tree)) expect(s.length).toBeGreaterThan(0);
    expect(common.uz.currency).toBe('soʻm');
    expect(common.ru.currency).toBe('сум');
    expect(common.uz.pageOf).toBe('{page} / {pages}');
    expect(common.uz.showing).toBe('{from}–{to} / {total}');
  });
});

// ───────────────────────── NumberStepper ─────────────────────────

describe('normalizeStepperValue', () => {
  it('0.5 qadam: yaqin qiymatga yaxlitlaydi va chegaralaydi', () => {
    expect(normalizeStepperValue(1.3, { step: 0.5 })).toBe(1.5);
    expect(normalizeStepperValue(1.2, { step: 0.5 })).toBe(1);
    expect(normalizeStepperValue(0, { step: 0.5 })).toBe(0.5);
    expect(normalizeStepperValue(500, { step: 0.5 })).toBe(99);
    expect(normalizeStepperValue(Number.NaN, { step: 0.5 })).toBe(0.5);
  });
  it('allowHalf=false: 0.5 rad, butun songa keltiriladi (mezon #4)', () => {
    expect(normalizeStepperValue(1.5, { step: 0.5, allowHalf: false })).toBe(2);
    expect(normalizeStepperValue(0.5, { step: 0.5, allowHalf: false })).toBe(1);
    expect(normalizeStepperValue(2.4, { step: 0.5, allowHalf: false })).toBe(2);
  });
  it('min/max va boshqa qadamlar', () => {
    expect(normalizeStepperValue(7, { step: 1, min: 1, max: 5 })).toBe(5);
    expect(normalizeStepperValue(0.3, { step: 0.25 })).toBe(0.25);
    expect(normalizeStepperValue(11, { step: 5, min: 0, max: 100 })).toBe(10);
  });
});

describe('<NumberStepper />', () => {
  it('+ / − tugmalari qadam boʻyicha oʻzgartiradi, chegarada oʻchadi', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={1} onChange={onChange} step={0.5} min={0.5} max={1.5} />, { wrapper: wrap('uz') });
    fireEvent.click(screen.getByRole('button', { name: 'Koʻpaytirish' }));
    expect(onChange).toHaveBeenLastCalledWith(1.5);
    fireEvent.click(screen.getByRole('button', { name: 'Kamaytirish' }));
    expect(onChange).toHaveBeenLastCalledWith(0.5);
  });

  it('yozilgan qiymat blur da yaxlitlanadi; allowHalf=false → 1.5 → 2', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={1} onChange={onChange} allowHalf={false} />, { wrapper: wrap('ru') });
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByText(/шаг 1/)).toBeTruthy();
  });

  it('allowHalf=true: 1.3 → 1.5 (Enter), vergul ham qabul qilinadi', () => {
    const onChange = vi.fn();
    render(<NumberStepper value={1} onChange={onChange} />, { wrapper: wrap('uz') });
    const input = screen.getByRole('spinbutton');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1,3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });
});

// ───────────────────────── Segmented ─────────────────────────

describe('<Segmented />', () => {
  const options = [
    { value: 'ADULT', label: 'Kattalar' },
    { value: 'CHILD', label: 'Bolalar' },
  ] as const;

  it('radiogroup, klik va strelkalar bilan tanlash', () => {
    const onChange = vi.fn();
    render(<Segmented value="ADULT" onChange={onChange} options={[...options]} ariaLabel="Bemor turi" />);
    const group = screen.getByRole('radiogroup', { name: 'Bemor turi' });
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[0]?.tabIndex).toBe(0);
    expect(radios[1]?.tabIndex).toBe(-1);
    fireEvent.click(radios[1] as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith('CHILD');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('CHILD');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('CHILD'); // aylanma: ADULT dan chapga → CHILD
    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('CHILD');
  });
});

// ───────────────────────── Calendar ─────────────────────────

describe('<Calendar />', () => {
  it('dushanbadan boshlanadi, kun tanlanadi, min dan oldingi kunlar oʻchiq', () => {
    const onChange = vi.fn();
    const value = new Date(2026, 8, 15); // 15.09.2026 (seshanba)
    render(<Calendar value={value} onChange={onChange} min={new Date(2026, 8, 10)} locale="uz" />, {
      wrapper: wrap('uz'),
    });
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers[0]).toBe('Du');
    expect(headers[6]).toBe('Ya');
    expect(screen.getByText('Sentabr 2026')).toBeTruthy();

    const day20 = screen.getByRole('button', { name: /^20 Sentabr 2026/ });
    fireEvent.click(day20);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toEqual(new Date(2026, 8, 20));

    const day5 = screen.getByRole('button', { name: /^5 Sentabr 2026/ }) as HTMLButtonElement;
    expect(day5.disabled).toBe(true);
    fireEvent.click(day5);
    expect(onChange).toHaveBeenCalledTimes(1);

    const selected = screen.getByRole('button', { name: /^15 Sentabr 2026/ });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    // roving tabindex: oxirgi bosilgan kun (20) tab-stop boʻladi
    expect(day20.tabIndex).toBe(0);
    expect(selected.tabIndex).toBe(-1);
  });

  it('ruscha oy nomi va oy almashtirish', () => {
    render(<Calendar defaultMonth={new Date(2026, 0, 10)} locale="ru" />, { wrapper: wrap('ru') });
    expect(screen.getByText('Январь 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }));
    expect(screen.getByText('Февраль 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    expect(screen.getByText('Декабрь 2025')).toBeTruthy();
  });

  it('klaviatura: → keyingi kun, PageDown keyingi oy', () => {
    const onChange = vi.fn();
    render(<Calendar value={new Date(2026, 8, 30)} onChange={onChange} locale="uz" />, { wrapper: wrap('uz') });
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(screen.getByText('Oktabr 2026')).toBeTruthy();
    fireEvent.keyDown(grid, { key: 'Enter' });
    expect(onChange.mock.calls[0]?.[0]).toEqual(new Date(2026, 9, 1));
  });
});

// ───────────────────────── Oddiy primitivlar ─────────────────────────

describe('primitivlar', () => {
  it('Button loading → disabled + aria-busy', () => {
    render(<Button loading>Saqlash</Button>);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });
  it('Button asChild havolaga klasslarni oʻtkazadi', () => {
    render(
      <Button asChild variant="gradient">
        <a href="/x">Havola</a>
      </Button>,
    );
    const a = screen.getByRole('link');
    expect(a.className).toContain('bg-gradient-accent');
  });
  it('Badge variantlari va Progress aria', () => {
    render(
      <>
        <Badge variant="success">OK</Badge>
        <Progress value={40} label="Yuklanish" />
      </>,
    );
    expect(screen.getByText('OK').className).toContain('text-[#00FFB2]');
    const bar = screen.getByRole('progressbar', { name: 'Yuklanish' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
  });
});

// ───────────────────────── Hooklar ─────────────────────────

describe('hooklar', () => {
  it('useDebounce kechiktiradi', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(result.current).toBe('b');
    vi.useRealTimers();
  });

  it('useHotkey mod+k (ctrl) ishlaydi, inputda ishlamaydi', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('mod+k', handler));
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'k' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(formatHotkey('mod+k')).toMatch(/Ctrl\+K|⌘K/);
  });

  it('useLocalStorage saqlaydi va oʻqiydi', () => {
    const { result } = renderHook(() => useLocalStorage<number>('ds-test', 1));
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(window.localStorage.getItem('ds-test')).toBe('5');
    act(() => result.current[2]());
    expect(result.current[0]).toBe(1);
    expect(window.localStorage.getItem('ds-test')).toBeNull();
  });

  it('useMediaQuery matchMedia boʻlmasa false', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);
  });
});

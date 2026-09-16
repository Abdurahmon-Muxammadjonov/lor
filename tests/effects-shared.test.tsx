/** @vitest-environment jsdom */
import * as React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { getMessages } from '@/i18n/messages';
import { makeT } from '@/i18n/t';
import type { Locale } from '@/i18n/config';

// LocaleProvider next/navigation ga bogʻliq — kontekstni mock qilamiz
let currentLocale: Locale = 'uz';
const setLocaleMock = vi.fn((l: Locale) => {
  currentLocale = l;
});
vi.mock('@/i18n/client', () => ({
  useLocale: () => ({ locale: currentLocale, setLocale: setLocaleMock, t: makeT(getMessages(), currentLocale) }),
  useT: () => makeT(getMessages(), currentLocale),
  pickLang: (obj: { name: string; nameRu?: string | null }, locale: Locale) =>
    locale === 'ru' && obj.nameRu ? obj.nameRu : obj.name,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { Money } from '@/components/shared/money';
import { Pagination, buildPageRange } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/status-badge';
import { SearchInput } from '@/components/shared/search-input';
import { ConfirmDialog, useConfirm } from '@/components/shared/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { LangSwitch } from '@/components/shared/lang-switch';
import { PhoneLink } from '@/components/shared/phone-link';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { CopyButton } from '@/components/shared/copy-button';
import { Logo } from '@/components/shared/logo';
import { Counter, formatCounterValue } from '@/components/effects/counter';
import { Reveal, RevealGroup, RevealItem } from '@/components/effects/reveal';
import { Marquee } from '@/components/effects/marquee';
import { TicketAnimation } from '@/components/effects/ticket-animation';
import { CustomCursor } from '@/components/effects/custom-cursor';
import { Magnetic } from '@/components/effects/magnetic';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { GlowCard } from '@/components/effects/glow-card';

afterEach(() => {
  cleanup();
  currentLocale = 'uz';
  vi.clearAllMocks();
});

// jsdom da matchMedia yoʻq — useMediaQuery false qaytaradi (reduced=false, mobile=false, fine=false)
// IntersectionObserver ham yoʻq — framer useInView uchun stub
beforeEach(() => {
  if (typeof window.IntersectionObserver === 'undefined') {
    class IO {
      constructor(private cb: IntersectionObserverCallback) {}
      observe(el: Element) {
        this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    }
    Object.defineProperty(window, 'IntersectionObserver', { value: IO, configurable: true });
  }
});

// ───────────────────────── Money ─────────────────────────

describe('Money', () => {
  it('uz: 1 250 000 soʻm', () => {
    render(<Money value={1250000} />);
    expect(screen.getByText('1 250 000 soʻm')).toBeTruthy();
  });
  it('ru: сум', () => {
    currentLocale = 'ru';
    render(<Money value="125000" />);
    expect(screen.getByText('125 000 сум')).toBeTruthy();
  });
  it('suffix=null va signed', () => {
    render(<Money value={5000} suffix={null} signed />);
    expect(screen.getByText('+5 000')).toBeTruthy();
  });
  it('null → —, notoʻgʻri satr → —', () => {
    const { container } = render(
      <>
        <Money value={null} />
        <Money value="abc" />
      </>,
    );
    const spans = container.querySelectorAll('span');
    expect(spans[0]?.textContent).toBe('—');
    expect(spans[1]?.textContent).toBe('—');
  });
});

// ───────────────────────── Pagination ─────────────────────────

describe('Pagination', () => {
  it('buildPageRange: ellipsis toʻgʻri', () => {
    expect(buildPageRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageRange(6, 20)).toEqual([1, 'dots-left', 5, 6, 7, 'dots-right', 20]);
    expect(buildPageRange(1, 20)).toEqual([1, 2, 3, 4, 5, 'dots-right', 20]);
    expect(buildPageRange(20, 20)).toEqual([1, 'dots-left', 16, 17, 18, 19, 20]);
    expect(buildPageRange(1, 0)).toEqual([]);
    expect(buildPageRange(4, 20)).toEqual([1, 2, 3, 4, 5, 'dots-right', 20]);
    expect(buildPageRange(5, 8)).toEqual([1, 'dots-left', 4, 5, 6, 7, 8]);
    expect(buildPageRange(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('koʻrsatadi va oldingi/keyingi ishlaydi', () => {
    const onChange = vi.fn();
    render(<Pagination page={2} pageSize={20} total={134} onChange={onChange} />);
    expect(screen.getByText('21–40 / 134')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Keyingi sahifa'));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByLabelText('Oldingi sahifa'));
    expect(onChange).toHaveBeenCalledWith(1);
  });
  it('birinchi sahifada "oldingi" oʻchiq, ru tarjima', () => {
    currentLocale = 'ru';
    render(<Pagination page={1} pageSize={10} total={5} onChange={() => {}} />);
    expect((screen.getByLabelText('Предыдущая страница') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Следующая страница') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('1–5 / 5')).toBeTruthy();
  });
});

// ───────────────────────── StatusBadge ─────────────────────────

describe('StatusBadge', () => {
  it('queue/visit/appointment common dan tarjima', () => {
    render(
      <>
        <StatusBadge kind="queue" status="WAITING" />
        <StatusBadge kind="visit" status="COMPLETED" />
        <StatusBadge kind="appointment" status="NO_SHOW" />
      </>,
    );
    expect(screen.getByText('Kutmoqda')).toBeTruthy();
    expect(screen.getByText('Yakunlangan')).toBeTruthy();
    expect(screen.getByText('Kelmadi')).toBeTruthy();
  });
  it('payment/shift mahalliy lugʻat (uz/ru)', () => {
    const { unmount } = render(
      <>
        <StatusBadge kind="payment" status="PARTIAL" />
        <StatusBadge kind="shift" status="OPEN" />
      </>,
    );
    expect(screen.getByText('Qisman toʻlangan')).toBeTruthy();
    expect(screen.getByText('Ochiq')).toBeTruthy();
    unmount();
    currentLocale = 'ru';
    render(<StatusBadge kind="payment" status="UNPAID" />);
    expect(screen.getByText('Не оплачено')).toBeTruthy();
  });
  it('nomaʼlum holat — kodning oʻzi', () => {
    render(<StatusBadge kind="queue" status="SOMETHING" />);
    expect(screen.getByText('SOMETHING')).toBeTruthy();
  });
});

// ───────────────────────── SearchInput ─────────────────────────

describe('SearchInput', () => {
  it('debounce bilan onChange, Esc tozalaydi', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} debounce={300} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ali' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith('ali');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input.value).toBe('');
    vi.useRealTimers();
  });
  it('Enter darhol yuboradi, tozalash tugmasi', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onEnter = vi.fn();
    render(<SearchInput value="" onChange={onChange} onEnter={onEnter} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'vali' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('vali');
    expect(onEnter).toHaveBeenCalledWith('vali');
    fireEvent.click(screen.getByLabelText('Tozalash'));
    expect(onChange).toHaveBeenLastCalledWith('');
    vi.useRealTimers();
  });
});

// ───────────────────────── ConfirmDialog / useConfirm ─────────────────────────

describe('ConfirmDialog', () => {
  it('tasdiqlash chaqiradi va promise tugagach yopadi', async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="Oʻchirish?" destructive onConfirm={onConfirm} />);
    expect(screen.getByText('Oʻchirish?')).toBeTruthy();
    expect(screen.getByText('Haqiqatan ham oʻchirmoqchimisiz? Bu amalni qaytarib boʻlmaydi.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('Ha, oʻchirish'));
    });
    expect(onConfirm).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('useConfirm: true / false', async () => {
    function Host({ onResult }: { onResult: (v: boolean) => void }) {
      const [confirm, el] = useConfirm();
      return (
        <>
          <button type="button" onClick={() => confirm({ title: 'Savol?' }).then(onResult)}>
            ask
          </button>
          {el}
        </>
      );
    }
    const onResult = vi.fn();
    render(<Host onResult={onResult} />);
    fireEvent.click(screen.getByText('ask'));
    expect(await screen.findByText('Savol?')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('Tasdiqlash'));
    });
    expect(onResult).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('ask'));
    expect(await screen.findByText('Savol?')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('Bekor qilish'));
    });
    expect(onResult).toHaveBeenLastCalledWith(false);
  });
});

// ───────────────────────── DataTable ─────────────────────────

interface Row {
  id: string;
  name: string;
  total: number;
}
const cols: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Nomi', cell: (r) => r.name },
  { key: 'total', header: 'Jami', cell: (r) => <Money value={r.total} />, align: 'right' },
];

describe('DataTable', () => {
  it('maʼlumot, boʻsh holat va yuklanish', () => {
    const { rerender, container } = render(
      <DataTable columns={cols} data={[{ id: '1', name: 'Ali', total: 1000 }]} rowKey={(r) => r.id} />,
    );
    expect(screen.getByText('Ali')).toBeTruthy();
    expect(screen.getByText('1 000 soʻm')).toBeTruthy();

    rerender(<DataTable columns={cols} data={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText('Maʼlumot yoʻq')).toBeTruthy();

    rerender(<DataTable columns={cols} data={[]} rowKey={(r) => r.id} loading skeletonRows={4} />);
    expect(container.querySelectorAll('tbody tr').length).toBe(4);
  });
  it('qator bosish: sichqoncha va klaviatura', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={cols} data={[{ id: '1', name: 'Ali', total: 1 }]} rowKey={(r) => r.id} onRowClick={onRowClick} />);
    const row = screen.getByText('Ali').closest('tr') as HTMLTableRowElement;
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(row.getAttribute('tabindex')).toBe('0');
  });
});

// ───────────────────────── LangSwitch ─────────────────────────

describe('LangSwitch', () => {
  it('pill: RU bosilganda setLocale("ru")', () => {
    render(<LangSwitch />);
    const ru = screen.getByRole('button', { name: 'Русский' });
    expect(screen.getByRole('button', { name: 'Oʻzbekcha' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(ru);
    expect(setLocaleMock).toHaveBeenCalledWith('ru');
  });
  it('text variant', () => {
    render(<LangSwitch variant="text" />);
    expect(screen.getByText('UZ')).toBeTruthy();
    expect(screen.getByText('RU')).toBeTruthy();
  });
});

// ───────────────────────── Kichik komponentlar ─────────────────────────

describe('PhoneLink / GenderAvatar / StatCard / EmptyState / PageHeader / Logo', () => {
  it('PhoneLink formatlaydi va tel: beradi', () => {
    render(<PhoneLink phone="901234567" />);
    const a = screen.getByText('+998 90 123 45 67') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('tel:+998901234567');
  });
  it('PhoneLink boʻsh → —', () => {
    render(<PhoneLink phone={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
  it('GenderAvatar initsiallar', () => {
    render(<GenderAvatar gender="FEMALE" name="Nilufar Karimova" />);
    expect(screen.getByText('NK')).toBeTruthy();
  });
  it('StatCard delta', () => {
    render(<StatCard title="Bugun" value="12" delta={12.5} deltaLabel="kechaga nisbatan" />);
    expect(screen.getByText('+12.5%')).toBeTruthy();
    expect(screen.getByText('kechaga nisbatan')).toBeTruthy();
  });
  it('StatCard loading skeleton', () => {
    const { container } = render(<StatCard title="Bugun" value="12" loading />);
    expect(container.querySelectorAll('.shimmer').length).toBeGreaterThan(0);
  });
  it('EmptyState', () => {
    render(<EmptyState title="Bemorlar yoʻq" description="Qoʻshing" action={<button type="button">Qoʻshish</button>} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Qoʻshish')).toBeTruthy();
  });
  it('PageHeader breadcrumbs', () => {
    render(
      <PageHeader
        title="Bemorlar"
        description="Roʻyxat"
        breadcrumbs={[{ label: 'Bosh sahifa', href: '/dashboard' }, { label: 'Bemorlar' }]}
        actions={<button type="button">Qoʻshish</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bemorlar');
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('Bosh sahifa').closest('a')?.getAttribute('href')).toBe('/dashboard');
    expect(within(nav).getByText('Bemorlar').getAttribute('aria-current')).toBe('page');
  });
  it('Logo havola bilan', () => {
    render(<Logo href="/" />);
    const link = screen.getByRole('link', { name: 'LOR CRM' });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.querySelector('svg')).toBeTruthy();
  });
  it('CopyButton nusxalaydi va toast', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyButton text="+998901234567" />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Nusxalash'));
    });
    expect(writeText).toHaveBeenCalledWith('+998901234567');
    expect(toast.success).toHaveBeenCalledWith('Nusxalandi');
  });
});

// ───────────────────────── Effects ─────────────────────────

describe('Effects', () => {
  it('formatCounterValue', () => {
    expect(formatCounterValue(1234567)).toBe('1 234 567');
    expect(formatCounterValue(1234.5, 1)).toBe('1 234,5');
    expect(formatCounterValue(-2500)).toBe('−2 500');
    expect(formatCounterValue(0)).toBe('0');
  });
  it('Counter: yakuniy qiymat sr-only da, animatsiya rAF bilan', () => {
    vi.useFakeTimers();
    let now = 0;
    const rafCbs: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCbs.push(cb);
      return rafCbs.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    render(<Counter to={1000} immediate duration={0.5} suffix="+" />);
    expect(screen.getByText('1 000+', { selector: '.sr-only' })).toBeTruthy();
    // 1 soniya oʻtdi — tugagan
    act(() => {
      now = 0;
      rafCbs.splice(0).forEach((cb) => cb(now));
    });
    act(() => {
      now = 1000;
      rafCbs.splice(0).forEach((cb) => cb(now));
    });
    expect(screen.getAllByText('1 000+').length).toBe(2);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('Reveal / RevealGroup render qiladi', () => {
    render(
      <RevealGroup as="ul">
        <RevealItem as="li">A</RevealItem>
        <RevealItem as="li">B</RevealItem>
      </RevealGroup>,
    );
    expect(screen.getAllByRole('listitem').length).toBe(2);
    render(<Reveal as="section">Salom</Reveal>);
    expect(screen.getByText('Salom').tagName).toBe('SECTION');
  });
  it('Marquee bolalarni ikki marta chizadi (ikkinchisi aria-hidden)', () => {
    const { container } = render(
      <Marquee>
        <span>Logo</span>
      </Marquee>,
    );
    expect(screen.getAllByText('Logo').length).toBe(2);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(1);
    expect(container.querySelector('.animate-marquee')).toBeTruthy();
  });
  it('TicketAnimation: raqam, uz/ru matnlar, replay', () => {
    const { unmount } = render(<TicketAnimation number="A-012" autoplay={false} />);
    expect(screen.getByText('A-012')).toBeTruthy();
    expect(screen.getByText('Navbat raqami')).toBeTruthy();
    expect(screen.getByText('Shifokor qabuli')).toBeTruthy();
    expect(screen.getByLabelText('Qayta chop etish')).toBeTruthy();
    unmount();
    currentLocale = 'ru';
    render(<TicketAnimation number="B-003" autoplay={false} />);
    expect(screen.getByText('Номер очереди')).toBeTruthy();
    expect(screen.getByText('Приём врача')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Напечатать снова'));
    expect(screen.getByText('B-003')).toBeTruthy();
  });
  it('CustomCursor pointer:fine boʻlmasa render qilmaydi', () => {
    const { container } = render(<CustomCursor />);
    expect(container.innerHTML).toBe('');
    expect(document.documentElement.classList.contains('has-custom-cursor')).toBe(false);
  });
  it('Magnetic / Aurora / GlowCard render', () => {
    const { container } = render(
      <>
        <Magnetic>
          <button type="button">Btn</button>
        </Magnetic>
        <AuroraBackground intensity="high" />
        <GlowCard glow="mint" className="p-4">
          Card
        </GlowCard>
      </>,
    );
    expect(screen.getByText('Btn')).toBeTruthy();
    expect(container.querySelector('.animate-aurora')).toBeTruthy();
    expect(screen.getByText('Card').closest('.glass')).toBeTruthy();
  });
});

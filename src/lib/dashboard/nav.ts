import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ListOrdered,
  MonitorPlay,
  Settings,
  Stethoscope,
  TabletSmartphone,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@prisma/client';
import { can, type Permission } from '@/lib/permissions';

/**
 * Yon panel / mobil tab bar / buyruqlar paneli uchun yagona navigatsiya manbasi.
 * Nomlar `common.nav.*` kalitlaridan olinadi.
 */
export interface NavItem {
  key: string;
  href: string;
  /** i18n kaliti (common.nav.*) */
  labelKey: string;
  icon: LucideIcon;
  permission: Permission;
  /** Faol holat uchun qoʻshimcha prefikslar (masalan /dashboard/visits → Bemorlar) */
  match?: string[];
  /** Klaviatura yorligʻi (buyruqlar panelida koʻrsatiladi) */
  shortcut?: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', href: '/dashboard', labelKey: 'common.nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view', shortcut: 'G H' },
  { key: 'queue', href: '/dashboard/queue', labelKey: 'common.nav.queue', icon: ListOrdered, permission: 'queue.view', shortcut: 'G Q' },
  {
    key: 'patients',
    href: '/dashboard/patients',
    labelKey: 'common.nav.patients',
    icon: Users,
    permission: 'patients.view',
    match: ['/dashboard/visits'],
    shortcut: 'G P',
  },
  { key: 'appointments', href: '/dashboard/appointments', labelKey: 'common.nav.appointments', icon: CalendarDays, permission: 'appointments.view', shortcut: 'G A' },
  { key: 'cashier', href: '/dashboard/cashier', labelKey: 'common.nav.cashier', icon: Wallet, permission: 'payments.view', shortcut: 'G C' },
  { key: 'services', href: '/dashboard/services', labelKey: 'common.nav.services', icon: Stethoscope, permission: 'services.view' },
  { key: 'doctors', href: '/dashboard/doctors', labelKey: 'common.nav.doctors', icon: UserCog, permission: 'staff.view' },
  { key: 'reports', href: '/dashboard/reports', labelKey: 'common.nav.reports', icon: BarChart3, permission: 'reports.view' },
  { key: 'settings', href: '/dashboard/settings', labelKey: 'common.nav.settings', icon: Settings, permission: 'settings.view' },
] as const;

/** Ochiq (sessiyasiz) sahifalar — kiosk kaliti kerak, yangi oynada ochiladi */
export interface SecondaryNavItem {
  key: 'kiosk' | 'display';
  path: '/kiosk' | '/display';
  labelKey: string;
  icon: LucideIcon;
}

export const SECONDARY_NAV: readonly SecondaryNavItem[] = [
  { key: 'kiosk', path: '/kiosk', labelKey: 'common.nav.kiosk', icon: TabletSmartphone },
  { key: 'display', path: '/display', labelKey: 'common.nav.display', icon: MonitorPlay },
] as const;

/** Mobil pastki tab bar tartibi (5 ta: 4 asosiy + "Menyu") */
export const MOBILE_TAB_KEYS: readonly string[] = ['dashboard', 'queue', 'patients', 'cashier', 'appointments', 'reports', 'services'] as const;

/** Kiosk kalitini koʻra oladigan rollar */
export function canSeeKioskKey(role: Role): boolean {
  return role === 'ADMIN' || role === 'RECEPTION' || role === 'SUPER_ADMIN';
}

export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => can(role, i.permission));
}

export function mobileTabsForRole(role: Role, max = 4): NavItem[] {
  const allowed = navForRole(role);
  const byKey = new Map(allowed.map((i) => [i.key, i] as const));
  const out: NavItem[] = [];
  for (const k of MOBILE_TAB_KEYS) {
    const item = byKey.get(k);
    if (item) out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

/** Yoʻl faol elementga mosmi (aniq yoki pastki sahifa) */
export function isNavActive(pathname: string, item: Pick<NavItem, 'href' | 'match'>): boolean {
  if (item.href === '/dashboard') return pathname === '/dashboard';
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// ── Breadcrumb ──

export interface Crumb {
  /** i18n kaliti */
  labelKey: string;
  href?: string;
  /** Kalit topilmasa koʻrsatiladigan xom matn */
  raw?: string;
}

/** Statik segmentlar → i18n kaliti */
const SEGMENT_KEYS: Record<string, string> = {
  dashboard: 'common.nav.dashboard',
  queue: 'common.nav.queue',
  patients: 'common.nav.patients',
  visits: 'common.nav.visits',
  appointments: 'common.nav.appointments',
  cashier: 'common.nav.cashier',
  services: 'common.nav.services',
  categories: 'common.category',
  doctors: 'common.nav.doctors',
  reports: 'common.nav.reports',
  settings: 'common.nav.settings',
  profile: 'common.nav.profile',
  new: 'dashboard.breadcrumb.new',
  edit: 'common.edit',
  printer: 'dashboard.breadcrumb.printer',
  sms: 'dashboard.breadcrumb.sms',
  telegram: 'dashboard.breadcrumb.telegram',
  payments: 'dashboard.breadcrumb.payments',
  integrations: 'dashboard.breadcrumb.integrations',
  audit: 'dashboard.breadcrumb.audit',
  clinic: 'common.clinic',
  shifts: 'dashboard.breadcrumb.shifts',
  calendar: 'dashboard.breadcrumb.calendar',
  daily: 'dashboard.breadcrumb.daily',
  salary: 'dashboard.breadcrumb.salary',
  schedule: 'dashboard.breadcrumb.schedule',
};

/** Dinamik segment (id) uchun ota boʻlim boʻyicha nom */
const ENTITY_KEYS: Record<string, string> = {
  patients: 'common.patient',
  visits: 'dashboard.breadcrumb.visit',
  appointments: 'dashboard.breadcrumb.appointment',
  doctors: 'common.doctor',
  services: 'common.service',
  queue: 'common.queueNumber',
  reports: 'dashboard.breadcrumb.report',
  shifts: 'dashboard.breadcrumb.shift',
  categories: 'common.category',
};

/**
 * `/dashboard/patients/abc123` → [Bosh sahifa (/dashboard), Bemorlar (/dashboard/patients), Bemor]
 * Faqat yoʻl (pathname) dan tuziladi, maʼlumot soʻralmaydi.
 */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const segments = pathname.split('?')[0]?.split('/').filter(Boolean) ?? [];
  if (segments[0] !== 'dashboard') return [];
  const crumbs: Crumb[] = [];
  let href = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] ?? '';
    href += `/${seg}`;
    const last = i === segments.length - 1;
    const staticKey = SEGMENT_KEYS[seg];
    if (staticKey) {
      crumbs.push({ labelKey: staticKey, href: last ? undefined : href });
      continue;
    }
    const parent = segments[i - 1] ?? '';
    const entityKey = ENTITY_KEYS[parent];
    if (entityKey) {
      crumbs.push({ labelKey: entityKey, href: last ? undefined : href });
    } else {
      crumbs.push({ labelKey: '', raw: prettifySegment(seg), href: last ? undefined : href });
    }
  }
  return crumbs;
}

function prettifySegment(seg: string): string {
  const s = decodeURIComponent(seg).replace(/[-_]+/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

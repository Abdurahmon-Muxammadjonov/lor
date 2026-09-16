import type { Role } from '@prisma/client';
import { can } from '@/lib/permissions';
import { REPORT_TABS, type ReportKind, type ReportTab } from './types';

/** Kassir koʻra oladigan boʻlimlar */
export const CASHIER_KINDS: readonly ReportKind[] = ['revenue', 'shifts', 'debtors'] as const;
/** `reports.full` talab qiladigan boʻlimlar (shifokorlar/maoshlar, toʻliq eksport) */
export const FULL_KINDS: readonly ReportKind[] = ['doctors', 'full'] as const;

/**
 * Hisobot boʻlimiga kirish qoidasi (API va UI bir xil manba):
 *  - hamma boʻlimlar `reports.view` talab qiladi;
 *  - `doctors` va `full` — `reports.full`;
 *  - CASHIER faqat tushum / smenalar / qarzdorlar.
 */
export function canViewReport(role: Role | null | undefined, kind: ReportKind): boolean {
  if (!can(role, 'reports.view')) return false;
  if (role === 'SUPER_ADMIN') return true;
  if (FULL_KINDS.includes(kind)) return can(role, 'reports.full');
  if (role === 'CASHIER') return CASHIER_KINDS.includes(kind);
  return true;
}

/** Rol uchun koʻrinadigan tablar (tartib saqlanadi) */
export function allowedTabs(role: Role | null | undefined): ReportTab[] {
  return REPORT_TABS.filter((tab) => canViewReport(role, tab));
}

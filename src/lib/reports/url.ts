import type { GroupBy, ReportTab } from './types';

export interface ReportsUrlState {
  tab: ReportTab;
  from: string;
  to: string;
  groupBy: GroupBy;
  doctorId?: string | null;
  allTime?: boolean;
  auto?: boolean;
}

/** Hisobot holatidan query-string (server va client uchun; boʻsh qiymatlar tashlab yuboriladi) */
export function reportsQuery(s: ReportsUrlState): string {
  const sp = new URLSearchParams();
  sp.set('tab', s.tab);
  sp.set('from', s.from);
  sp.set('to', s.to);
  sp.set('groupBy', s.groupBy);
  if (s.doctorId) sp.set('doctorId', s.doctorId);
  if (s.allTime) sp.set('all', '1');
  if (s.auto) sp.set('auto', '1');
  return `?${sp.toString()}`;
}

export function reportsHref(s: ReportsUrlState): string {
  return `/dashboard/reports${reportsQuery(s)}`;
}

export function reportsPrintHref(s: ReportsUrlState): string {
  return `/dashboard/reports/print${reportsQuery(s)}`;
}

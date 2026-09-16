/**
 * Sozlamalar sahifasining tablari. URL: `/dashboard/settings?tab=<key>`.
 * Server komponent (`page.tsx`) ham, client (`SettingsTabs`) ham shu roʻyxatdan foydalanadi.
 */

export const SETTINGS_TABS = ['clinic', 'printer', 'sms', 'telegram', 'queue', 'roles', 'audit'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const DEFAULT_SETTINGS_TAB: SettingsTab = 'clinic';

export function isSettingsTab(value: unknown): value is SettingsTab {
  return typeof value === 'string' && (SETTINGS_TABS as readonly string[]).includes(value);
}

/** `?tab=` qiymatini xavfsiz tabga keltirish (notoʻgʻri boʻlsa — Klinika) */
export function parseSettingsTab(value: string | string[] | undefined): SettingsTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return isSettingsTab(raw) ? raw : DEFAULT_SETTINGS_TAB;
}

/** Tab uchun havola (birinchi tab — toza URL) */
export function settingsTabHref(tab: SettingsTab, basePath = '/dashboard/settings'): string {
  return tab === DEFAULT_SETTINGS_TAB ? basePath : `${basePath}?tab=${tab}`;
}

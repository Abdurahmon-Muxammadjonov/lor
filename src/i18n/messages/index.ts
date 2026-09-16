import type { Locale } from '../config';
import type { Tree } from '../types';
import { common } from './common';
import { landing } from './landing';
import { auth } from './auth';
import { dashboard } from './dashboard';
import { queue } from './queue';
import { patients } from './patients';
import { visits } from './visits';
import { appointments } from './appointments';
import { cashier } from './cashier';
import { services } from './services';
import { staff } from './staff';
import { reports } from './reports';
import { settings } from './settings';

/**
 * Barcha modullar lugʻati. Kalit = modul nomi: t('patients.title'), t('common.save') ...
 * Yangi modul: src/i18n/messages/<modul>.ts yarating va shu yerga qoʻshing.
 */
const modules = {
  common,
  landing,
  auth,
  dashboard,
  queue,
  patients,
  visits,
  appointments,
  cashier,
  services,
  staff,
  reports,
  settings,
} as const;

let cache: Record<Locale, Tree> | null = null;

export function getMessages(): Record<Locale, Tree> {
  if (cache) return cache;
  const uz: Tree = {};
  const ru: Tree = {};
  for (const [name, mod] of Object.entries(modules)) {
    uz[name] = mod.uz as Tree;
    ru[name] = mod.ru as Tree;
  }
  cache = { uz, ru };
  return cache;
}

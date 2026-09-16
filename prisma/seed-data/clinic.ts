import type { Plan } from '@prisma/client';
import { parseClinicSettings, type ClinicSettings } from '../../src/lib/settings/types';

export interface ClinicSeed {
  slug: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  childAgeLimit: number;
  roundTo: number;
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  kioskKey: string;
  ticketFooter: string;
  plan: Plan;
  settings: ClinicSettings;
}

/** Asosiy demo klinika — barcha tarixiy maʼlumotlar shu yerda */
export const DEMO_CLINIC: ClinicSeed = {
  slug: 'demo',
  name: 'Shifo LOR Klinikasi',
  phone: '+998712000000',
  email: 'info@shifo-lor.uz',
  address: 'Toshkent sh., Yunusobod t., Amir Temur koʻchasi 108',
  city: 'Toshkent',
  childAgeLimit: 14,
  roundTo: 100,
  workStart: '08:00',
  workEnd: '20:00',
  slotMinutes: 20,
  kioskKey: 'demo-kiosk-key-2026',
  ticketFooter: 'Sogʻligʻingiz — biz uchun eng muhimi',
  plan: 'PRO',
  settings: parseClinicSettings({
    printer: {
      transport: 'BROWSER',
      paperWidth: 58,
      codepage: 'CP866',
      autoPrintTicket: true,
      autoPrintReceipt: true,
      receiptFooter: 'Tashrifingiz uchun rahmat! Sogʻ boʻling!',
      receiptQr: true,
      cut: true,
      avgServiceMinutes: 8,
    },
    queue: {
      prefixes: { DOCTOR: 'A', RECHECK: 'B', LAB: 'C', CASHIER: 'D' },
      enabledTypes: ['DOCTOR', 'RECHECK', 'LAB', 'CASHIER'],
      displaySound: true,
      displayVoice: true,
      kioskShowSeconds: 5,
    },
    sms: { enabled: false },
    telegram: { enabled: false },
  }),
};

/** Ikkinchi klinika — multi-tenant izolyatsiyani tekshirish uchun */
export const LOR_PLUS_CLINIC: ClinicSeed = {
  slug: 'lor-plus',
  name: 'LOR Plus Medical',
  phone: '+998662300000',
  email: 'info@lorplus.uz',
  address: 'Samarqand sh., Registon koʻchasi 25',
  city: 'Samarqand',
  childAgeLimit: 12,
  roundTo: 1000,
  workStart: '09:00',
  workEnd: '18:00',
  slotMinutes: 30,
  kioskKey: 'lorplus-kiosk-key-2026',
  ticketFooter: 'LOR Plus Medical — sogʻlom nafas, tiniq eshitish',
  plan: 'START',
  settings: parseClinicSettings({
    printer: { transport: 'BROWSER', paperWidth: 80, receiptFooter: 'Rahmat! Yana kutamiz.' },
    queue: {
      prefixes: { DOCTOR: 'A', RECHECK: 'B', LAB: 'C', CASHIER: 'D' },
      enabledTypes: ['DOCTOR', 'RECHECK'],
    },
    sms: { enabled: false },
    telegram: { enabled: false },
  }),
};

export const CLINICS: ClinicSeed[] = [DEMO_CLINIC, LOR_PLUS_CLINIC];

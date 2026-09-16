import { describe, expect, it, vi } from 'vitest';

import { settings } from '@/i18n/messages/settings';
import type { Tree } from '@/i18n/types';
import {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_TABS,
  isSettingsTab,
  parseSettingsTab,
  settingsTabHref,
} from '@/lib/settings/tabs';
import {
  insertPlaceholder,
  renderSmsTemplate,
  smsSegments,
  usedPlaceholders,
} from '@/lib/settings/sms-preview';
import {
  asRecord,
  changedKeys,
  diffRows,
  formatValue,
  hasDiffPayload,
  mergeUserOptions,
  prettyJson,
  stableJson,
} from '@/lib/settings/audit-diff';
import { SMS_DEFAULTS, SMS_PLACEHOLDERS, kioskLinks } from '@/lib/settings/schemas';

// `@/lib/integrations/eskiz` serverga bogʻliq (prisma) — parity testi uchun mock kifoya
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keyPaths(v, `${prefix}${k}.`)));
}
function leaves(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : leaves(v)));
}

// ───────────────────────── Tablar ─────────────────────────

describe('sozlamalar tablari', () => {
  it('barcha tablar roʻyxati toʻliq va tartibli', () => {
    expect([...SETTINGS_TABS]).toEqual(['clinic', 'printer', 'sms', 'telegram', 'queue', 'roles', 'audit']);
    expect(DEFAULT_SETTINGS_TAB).toBe('clinic');
  });

  it('isSettingsTab faqat mavjud kalitlarga true', () => {
    expect(isSettingsTab('audit')).toBe(true);
    expect(isSettingsTab('nope')).toBe(false);
    expect(isSettingsTab(undefined)).toBe(false);
    expect(isSettingsTab(3)).toBe(false);
  });

  it('parseSettingsTab massiv va notoʻgʻri qiymatlarni xavfsiz oʻqiydi', () => {
    expect(parseSettingsTab('sms')).toBe('sms');
    expect(parseSettingsTab(['queue', 'sms'])).toBe('queue');
    expect(parseSettingsTab('../etc')).toBe('clinic');
    expect(parseSettingsTab(undefined)).toBe('clinic');
    expect(parseSettingsTab([])).toBe('clinic');
  });

  it('settingsTabHref birinchi tab uchun toza URL beradi', () => {
    expect(settingsTabHref('clinic')).toBe('/dashboard/settings');
    expect(settingsTabHref('audit')).toBe('/dashboard/settings?tab=audit');
  });

  it('har bir tab uchun i18n kaliti bor', () => {
    const uz = keyPaths(settings.uz as Tree);
    for (const tab of SETTINGS_TABS) expect(uz, tab).toContain(`tabs.${tab}`);
  });
});

// ───────────────────────── SMS koʻrinishi ─────────────────────────

describe('renderSmsTemplate', () => {
  it('oʻrin egallovchilarni almashtiradi va ortiqcha boʻshliqlarni yigʻadi', () => {
    const out = renderSmsTemplate('{clinic}: {name}, siz {date} soat {time} ga {doctor} qabuliga yozildingiz.', {
      clinic: 'LOR Plus',
      name: 'Aliyev Alisher',
      date: '16.09.2026',
      time: '10:30',
      doctor: 'Karimova Nodira',
    });
    expect(out).toBe('LOR Plus: Aliyev Alisher, siz 16.09.2026 soat 10:30 ga Karimova Nodira qabuliga yozildingiz.');
  });

  it('boʻsh qiymatlarda tinish belgilaridan oldingi boʻshliq yoʻqoladi', () => {
    expect(renderSmsTemplate('{clinic}: {name}, salom', { clinic: 'LOR', name: '' })).toBe('LOR:, salom');
    expect(renderSmsTemplate('a {x} b', { x: null })).toBe('a b');
  });

  it('nomaʼlum kalit oʻzgarishsiz qoladi', () => {
    expect(renderSmsTemplate('{unknown} {name}', { name: 'A' })).toBe('{unknown} A');
  });

  it('standart shablonlardagi barcha kalitlar qoʻllab-quvvatlanadi', () => {
    for (const template of [SMS_DEFAULTS.confirmTemplate, SMS_DEFAULTS.reminderTemplate, SMS_DEFAULTS.birthdayTemplate]) {
      for (const key of usedPlaceholders(template)) expect(SMS_PLACEHOLDERS).toContain(key);
      const rendered = renderSmsTemplate(template, { clinic: 'K', name: 'N', date: 'D', time: 'T', doctor: 'S', phone: 'P' });
      expect(rendered).not.toMatch(/\{(clinic|name|date|time|doctor|phone)\}/);
    }
  });
});

describe('smsSegments', () => {
  it('lotin matn GSM-7 (160/153)', () => {
    expect(smsSegments('Salom')).toEqual({ encoding: 'GSM-7', length: 5, segments: 1 });
    expect(smsSegments('a'.repeat(160)).segments).toBe(1);
    expect(smsSegments('a'.repeat(161)).segments).toBe(2);
  });

  it('kirill matn UCS-2 (70/67)', () => {
    const ru = 'Здравствуйте';
    expect(smsSegments(ru).encoding).toBe('UCS-2');
    expect(smsSegments('я'.repeat(70)).segments).toBe(1);
    expect(smsSegments('я'.repeat(71)).segments).toBe(2);
  });

  it('boʻsh matn — 0 ta SMS', () => {
    expect(smsSegments('').segments).toBe(0);
  });

  it('eskiz (server) implementatsiyasi bilan bir xil natija beradi', async () => {
    const eskiz = await import('@/lib/integrations/eskiz');
    const samples = ['', 'Salom', 'Здравствуйте, приём', SMS_DEFAULTS.confirmTemplate, 'a'.repeat(200), 'я'.repeat(100)];
    for (const s of samples) {
      expect(smsSegments(s), s.slice(0, 20)).toEqual(eskiz.smsSegments(s));
      expect(renderSmsTemplate(s, { clinic: 'K', name: 'N' })).toBe(eskiz.renderTemplate(s, { clinic: 'K', name: 'N' }));
    }
  });
});

describe('insertPlaceholder', () => {
  it('kursor oʻrniga qoʻyadi va yangi kursor holatini qaytaradi', () => {
    expect(insertPlaceholder('Salom , xush kelibsiz', 'name', 6, 6)).toEqual({
      text: 'Salom {name}, xush kelibsiz',
      caret: 12,
    });
  });

  it('belgilangan matnni almashtiradi', () => {
    expect(insertPlaceholder('Salom XXX!', 'name', 6, 9).text).toBe('Salom {name}!');
  });

  it('chegaradan tashqaridagi indekslar qisiladi', () => {
    expect(insertPlaceholder('abc', 'time', 99, 120).text).toBe('abc{time}');
    expect(insertPlaceholder('abc', 'time', -5, -1).text).toBe('{time}abc');
  });

  it('standart holatda matn oxiriga qoʻshadi', () => {
    expect(insertPlaceholder('abc', 'phone').text).toBe('abc{phone}');
  });
});

// ───────────────────────── Audit farqi ─────────────────────────

describe('audit diff yordamchilari', () => {
  it('asRecord faqat oddiy obyektni qaytaradi', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord([1, 2])).toBeNull();
    expect(asRecord(null)).toBeNull();
    expect(asRecord('x')).toBeNull();
  });

  it('stableJson kalitlar tartibiga bogʻliq emas', () => {
    expect(stableJson({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe(stableJson({ a: [2, { c: 3, d: 4 }], b: 1 }));
    expect(stableJson(undefined)).toBe('null');
  });

  it('changedKeys faqat farq qilgan kalitlarni beradi', () => {
    expect(changedKeys({ a: 1, b: 2, c: { x: 1 } }, { a: 1, b: 3, c: { x: 1 } })).toEqual(['b']);
    expect(changedKeys({ a: 1 }, { a: 1, b: 2 })).toEqual(['b']);
    expect(changedKeys(null, null)).toEqual([]);
    expect(changedKeys({ a: 1 }, null)).toEqual(['a']);
  });

  it('diffRows oʻzgargan kalitlarni birinchi qoʻyadi', () => {
    const rows = diffRows({ a: 1, b: 2, z: 9 }, { a: 1, b: 3 });
    expect(rows.map((r) => r.key)).toEqual(['b', 'z', 'a']);
    const b = rows[0];
    const z = rows[1];
    expect(b?.changed).toBe(true);
    expect(b?.before).toBe(2);
    expect(b?.after).toBe(3);
    expect(z?.onlyBefore).toBe(true);
    expect(z?.after).toBeUndefined();
  });

  it('prettyJson / formatValue koʻrinishi', () => {
    expect(prettyJson(null)).toBe('');
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatValue('matn')).toBe('matn');
    expect(formatValue(undefined)).toBe('');
    expect(formatValue(null)).toBe('null');
    expect(formatValue(180000)).toBe('180000');
  });

  it('hasDiffPayload boʻsh yozuvlarni ajratadi', () => {
    expect(hasDiffPayload(null, null)).toBe(false);
    expect(hasDiffPayload(undefined, { a: 1 })).toBe(true);
  });

  it('mergeUserOptions takrorlanmaydi va F.I.Sh. boʻyicha tartiblaydi', () => {
    const staff = [
      { id: 'u2', fullName: 'Boboyev Botir', role: 'DOCTOR' },
      { id: 'u1', fullName: 'Aliyev Alisher', role: 'ADMIN' },
    ];
    const audit = [
      { id: 'u1', fullName: 'Aliyev Alisher', role: 'ADMIN' },
      { id: 'u3', fullName: 'Valiyeva Vazira', role: 'CASHIER' },
    ];
    expect(mergeUserOptions(staff, audit).map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
    expect(mergeUserOptions(undefined, undefined)).toEqual([]);
  });
});

// ───────────────────────── Kiosk havolalari ─────────────────────────

describe('kioskLinks', () => {
  it('kalitni URL-kodlaydi', () => {
    expect(kioskLinks('abc/1', 'https://lor.uz')).toEqual({
      kioskUrl: 'https://lor.uz/kiosk?key=abc%2F1',
      displayUrl: 'https://lor.uz/display?key=abc%2F1',
    });
    expect(kioskLinks('k').kioskUrl).toBe('/kiosk?key=k');
  });
});

// ───────────────────────── i18n ─────────────────────────

describe('i18n settings', () => {
  it('uz va ru kalitlari bir xil', () => {
    expect(keyPaths(settings.ru as Tree).sort()).toEqual(keyPaths(settings.uz as Tree).sort());
  });

  it('boʻsh matn yoʻq', () => {
    for (const v of [...leaves(settings.uz as Tree), ...leaves(settings.ru as Tree)]) expect(v.trim().length).toBeGreaterThan(0);
  });

  it('oʻzbek matnlarida ASCII apostrof ishlatilmagan', () => {
    for (const v of leaves(settings.uz as Tree)) expect(v, v).not.toMatch(/'/);
  });

  it('yangi kalitlar (koʻrinish namunalari, telegram test tavsifi) mavjud', () => {
    const uz = new Set(keyPaths(settings.uz as Tree));
    for (const k of ['sms.previewVars.name', 'sms.previewVars.doctor', 'telegram.test.description']) expect(uz).toContain(k);
  });
});

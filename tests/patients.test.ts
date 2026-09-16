import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeSearch, normalizePhone } from '@/lib/utils';
import { getMessages, makeT } from '@/i18n';
import {
  EMPTY_PATIENT_FORM,
  PatientFormSchema,
  PatientListQuery,
  PatientPatchSchema,
  PatientSchema,
  PatientSearchQuery,
  toPatientPayload,
} from '@/lib/patients/schemas';
import {
  ageFromKey,
  checkBirthDate,
  childCutoffKey,
  keyToDisplay,
  maskDateInput,
  monthsFromKey,
  parseDateParts,
  patientAge,
  patientTypeFor,
  toDateKey,
} from '@/lib/patients/age';
import { formatPhoneMask, isCompletePhoneMask, maskToE164, nationalDigits } from '@/lib/patients/phone-mask';
import { buildCsv, CSV_BOM, escapeCsvCell } from '@/lib/patients/csv';
import { countActiveFilters, listParamsToSearch, parseListSearchParams } from '@/lib/patients/list-params';
import { formatAge, lineName, renderTemplate } from '@/lib/patients/format';
import { patients } from '@/i18n/messages/patients';

const t = makeT(getMessages(), 'uz');
const tRu = makeT(getMessages(), 'ru');

describe('PatientSchema (API)', () => {
  const base = {
    fullName: 'Oʻktamov Sherzod',
    birthDate: '1990-05-20',
    gender: 'MALE',
    phone: '+998 90 123 45 67',
  };

  it('normallashtiradi: birthDate → UTC Date, boʻsh matnlar → null, smsConsent default true', () => {
    const r = PatientSchema.parse({ ...base, phone2: '', address: '', notes: undefined });
    expect(r.birthDate.toISOString()).toBe('1990-05-20T00:00:00.000Z');
    expect(r.phone).toBe('+998901234567');
    expect(r.phone2).toBeNull();
    expect(r.address).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.smsConsent).toBe(true);
    expect(r.force).toBeUndefined();
  });

  it('kk.oo.yyyy va ISO vaqtli sanalarni qabul qiladi', () => {
    expect(PatientSchema.parse({ ...base, birthDate: '20.03.2018' }).birthDate.toISOString()).toBe(
      '2018-03-20T00:00:00.000Z',
    );
    expect(
      PatientSchema.parse({ ...base, birthDate: '2018-03-20T10:15:00.000Z' }).birthDate.toISOString(),
    ).toBe('2018-03-20T00:00:00.000Z');
  });

  it('rad etadi: qisqa ism, kelajak sana, 1900 dan oldingi sana, notoʻgʻri sana, notoʻgʻri telefon', () => {
    expect(PatientSchema.safeParse({ ...base, fullName: 'Ab' }).success).toBe(false);
    expect(PatientSchema.safeParse({ ...base, birthDate: '2099-01-01' }).success).toBe(false);
    expect(PatientSchema.safeParse({ ...base, birthDate: '1899-12-31' }).success).toBe(false);
    expect(PatientSchema.safeParse({ ...base, birthDate: '31.02.2000' }).success).toBe(false);
    expect(PatientSchema.safeParse({ ...base, phone: '12' }).success).toBe(false);
    expect(PatientSchema.safeParse({ ...base, gender: 'X' }).success).toBe(false);
  });

  it('xato xabarlari i18n kalitlari', () => {
    const r = PatientSchema.safeParse({ ...base, birthDate: '2099-01-01' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.flatten().fieldErrors.birthDate?.[0];
      expect(msg).toBe('patients.validation.birthFuture');
      expect(t(msg ?? '')).not.toBe(msg);
    }
  });

  it('HTML teglarini tozalaydi (sanitizeText)', () => {
    const r = PatientSchema.parse({
      ...base,
      fullName: 'Ali <b>Valiyev</b>',
      address: '<script>x</script>Toshkent',
    });
    expect(r.fullName).toBe('Ali Valiyev');
    expect(r.address).toBe('xToshkent');
  });

  it('PatientPatchSchema: boʻsh tana rad etiladi, null maydonlar oʻchirish uchun', () => {
    expect(PatientPatchSchema.safeParse({}).success).toBe(false);
    expect(PatientPatchSchema.safeParse({ force: true }).success).toBe(false);
    const r = PatientPatchSchema.parse({ address: null, smsConsent: false });
    expect(r.address).toBeNull();
    expect(r.smsConsent).toBe(false);
    expect(r.fullName).toBeUndefined();
  });

  it('PatientListQuery / PatientSearchQuery defaultlari', () => {
    const q = PatientListQuery.parse({});
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(20);
    expect(
      PatientListQuery.parse({ hasDebt: '1', type: 'CHILD', sort: 'lastVisit', page: '3' }),
    ).toMatchObject({
      hasDebt: '1',
      type: 'CHILD',
      sort: 'lastVisit',
      page: 3,
    });
    expect(PatientListQuery.safeParse({ sort: 'phone' }).success).toBe(false);
    expect(PatientSearchQuery.parse({})).toEqual({ q: '', limit: 8 });
    expect(PatientSearchQuery.safeParse({ limit: '500' }).success).toBe(false);
    expect(PatientSearchQuery.parse({ q: '  ali ', limit: '3' })).toEqual({ q: 'ali', limit: 3 });
  });
});

describe('PatientFormSchema (client) va toPatientPayload', () => {
  it('forma qiymatlari → API tanasi', () => {
    const values = {
      ...EMPTY_PATIENT_FORM,
      fullName: '  Karimova Nodira ',
      birthDate: '20.03.2018',
      gender: 'FEMALE' as const,
      phone: '+998 90 123 45 67',
      phone2: '',
      allergies: 'Penitsillin',
    };
    expect(PatientFormSchema.safeParse(values).success).toBe(true);
    const payload = toPatientPayload(values, true);
    expect(payload).toEqual({
      fullName: 'Karimova Nodira',
      birthDate: '2018-03-20',
      gender: 'FEMALE',
      phone: '+998901234567',
      phone2: null,
      address: null,
      allergies: 'Penitsillin',
      chronic: null,
      notes: null,
      source: null,
      smsConsent: true,
      force: true,
    });
    expect(toPatientPayload(values).force).toBeUndefined();
  });

  it('xato kalitlari: nameMin, birthDate, phone, gender', () => {
    const r = PatientFormSchema.safeParse({
      ...EMPTY_PATIENT_FORM,
      fullName: 'A',
      birthDate: '99.99.9999',
      phone: 'abc',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fe = r.error.flatten().fieldErrors;
      expect(fe.fullName?.[0]).toBe('patients.validation.nameMin');
      expect(fe.birthDate?.[0]).toBe('patients.validation.birthDate');
      expect(fe.phone?.[0]).toBe('patients.validation.phone');
      for (const key of [fe.fullName?.[0], fe.birthDate?.[0], fe.phone?.[0]]) {
        expect(t(key ?? '')).not.toBe(key);
        expect(tRu(key ?? '')).not.toBe(key);
      }
    }
    const empty = PatientFormSchema.safeParse({ ...EMPTY_PATIENT_FORM });
    expect(empty.success).toBe(false);
    if (!empty.success)
      expect(empty.error.flatten().fieldErrors.birthDate?.[0]).toBe('common.validation.required');
  });
});

describe('qidiruv normallashtirish (apostrofga sezgir emas)', () => {
  it("normalizeSearch: Oʻktam, O'ktam, O’ktam → oktam", () => {
    expect(normalizeSearch('Oʻktam')).toBe('oktam');
    expect(normalizeSearch("O'ktam")).toBe('oktam');
    expect(normalizeSearch('O’ktam')).toBe('oktam');
    expect(normalizeSearch('  Gʻafur   Gʻulom ')).toBe('gafur gulom');
  });

  it('telefon raqamlari: normalizePhone turli koʻrinishlarni +998… ga keltiradi', () => {
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567');
    expect(normalizePhone('998901234567')).toBe('+998901234567');
    expect(normalizePhone('8 998 90 123 45 67')).toBe('+998901234567');
  });
});

describe('age.ts — kalendar sanalari', () => {
  it('parseDateParts / toDateKey / keyToDisplay', () => {
    expect(parseDateParts('1985-03-12')).toEqual({ year: 1985, month: 3, day: 12 });
    expect(parseDateParts('1985-03-12T00:00:00.000Z')).toEqual({ year: 1985, month: 3, day: 12 });
    expect(parseDateParts('12.03.1985')).toEqual({ year: 1985, month: 3, day: 12 });
    expect(parseDateParts('12/03/1985')).toEqual({ year: 1985, month: 3, day: 12 });
    expect(parseDateParts('1985')).toBeNull();
    expect(toDateKey('31.02.2000')).toBeNull();
    expect(toDateKey('29.02.2000')).toBe('2000-02-29');
    expect(keyToDisplay('2000-02-29')).toBe('29.02.2000');
    expect(keyToDisplay(null)).toBe('');
    expect(maskDateInput('12031985')).toBe('12.03.1985');
    expect(maskDateInput('1203')).toBe('12.03');
    expect(maskDateInput('1')).toBe('1');
    expect(maskDateInput('12.03.19855555')).toBe('12.03.1985');
  });

  it('checkBirthDate qoidalari', () => {
    expect(checkBirthDate('2099-01-01', '2026-09-15')).toBe('future');
    expect(checkBirthDate('2026-09-16', '2026-09-15')).toBe('future');
    expect(checkBirthDate('2026-09-15', '2026-09-15')).toBeNull();
    expect(checkBirthDate('1899-12-31', '2026-09-15')).toBe('tooOld');
    expect(checkBirthDate('abc', '2026-09-15')).toBe('invalid');
    expect(checkBirthDate('', '2026-09-15')).toBe('invalid');
  });

  it('yosh va oylar', () => {
    expect(ageFromKey('1990-05-20', '2026-09-15')).toBe(36);
    expect(ageFromKey('1990-09-16', '2026-09-15')).toBe(35);
    expect(ageFromKey('1990-09-15', '2026-09-15')).toBe(36);
    expect(monthsFromKey('2026-02-10', '2026-09-15')).toBe(7);
    expect(monthsFromKey('2026-02-20', '2026-09-15')).toBe(6);
    expect(patientAge('1990-05-20T00:00:00.000Z', '2026-09-15')).toBe(36);
  });

  it('bola/katta chegarasi (childAgeLimit=14)', () => {
    expect(childCutoffKey(14, '2026-09-15')).toBe('2012-09-15');
    expect(patientTypeFor('2012-09-15', 14, '2026-09-15')).toBe('ADULT'); // aynan 14 yosh
    expect(patientTypeFor('2012-09-16', 14, '2026-09-15')).toBe('CHILD'); // 13 yosh
    expect(patientTypeFor('2020-01-01', 12, '2026-09-15')).toBe('CHILD');
    expect(patientTypeFor('1990-01-01', 14, '2026-09-15')).toBe('ADULT');
  });
});

describe('telefon maskasi', () => {
  it('formatPhoneMask', () => {
    expect(formatPhoneMask('901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneMask('+998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneMask('998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneMask('9012')).toBe('+998 90 12');
    expect(formatPhoneMask('')).toBe('');
    expect(formatPhoneMask('+998 90 123 45 678')).toBe('+998 90 123 45 67');
  });
  it('nationalDigits / isCompletePhoneMask / maskToE164', () => {
    expect(nationalDigits('+998 99 700 11 01')).toBe('997001101');
    expect(nationalDigits('99')).toBe('99');
    expect(isCompletePhoneMask('+998 90 123 45 6')).toBe(false);
    expect(isCompletePhoneMask('+998 90 123 45 67')).toBe(true);
    expect(maskToE164('+998 90 123 45 67')).toBe('+998901234567');
    expect(maskToE164('90 12')).toBe('');
  });
});

describe('CSV', () => {
  it('BOM, qoʻshtirnoq, CRLF, formula-injection himoyasi', () => {
    expect(CSV_BOM).toBe('﻿');
    expect(escapeCsvCell('Ali "Valiyev"')).toBe('"Ali ""Valiyev"""');
    expect(escapeCsvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(12)).toBe('"12"');
    expect(escapeCsvCell('a\r\nb')).toBe('"a b"');
    const csv = buildCsv(['A', 'B'], [['1', 'x;y']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿"A";"B"\r\n"1";"x;y"\r\n');
  });
});

describe('list-params (URL ↔ holat)', () => {
  it('parse: defaultlar va yaroqsiz qiymatlar', () => {
    expect(parseListSearchParams({})).toEqual({
      q: '',
      page: 1,
      pageSize: 20,
      sort: 'created',
      gender: undefined,
      type: undefined,
      hasDebt: false,
    });
    expect(
      parseListSearchParams({
        page: '0',
        pageSize: '33',
        sort: 'x',
        gender: 'Y',
        type: 'CHILD',
        hasDebt: '1',
        q: ['ali', 'vali'],
      }),
    ).toEqual({
      q: 'ali',
      page: 1,
      pageSize: 20,
      sort: 'created',
      gender: undefined,
      type: 'CHILD',
      hasDebt: true,
    });
  });
  it('roundtrip va faol filtrlar soni', () => {
    const p = parseListSearchParams({
      q: 'ali',
      page: '2',
      pageSize: '50',
      sort: 'name',
      gender: 'FEMALE',
      hasDebt: '1',
    });
    const search = listParamsToSearch(p);
    expect(search).toBe('?q=ali&page=2&pageSize=50&sort=name&gender=FEMALE&hasDebt=1');
    expect(parseListSearchParams(Object.fromEntries(new URLSearchParams(search)))).toEqual(p);
    expect(listParamsToSearch(parseListSearchParams({}))).toBe('');
    expect(countActiveFilters(p)).toBe(2);
    expect(countActiveFilters({ gender: undefined, type: 'ADULT', hasDebt: false })).toBe(1);
  });
});

describe('format helpers', () => {
  it('formatAge: yil / oy', () => {
    expect(formatAge('1990-05-20', t, '2026-09-15')).toBe('36 yosh');
    expect(formatAge('2026-02-10', t, '2026-09-15')).toBe('7 oy');
    expect(formatAge('1990-05-20', tRu, '2026-09-15')).toBe('36 лет');
  });
  it('renderTemplate va lineName', () => {
    expect(
      renderTemplate('{clinic}: {name}, {date} {missing}', { clinic: 'Shifo', name: 'Ali', date: '15.09' }),
    ).toBe('Shifo: Ali, 15.09 {missing}');
    expect(lineName({ serviceName: 'Burun yuvish', serviceNameRu: 'Промывание носа' }, 'ru')).toBe(
      'Промывание носа',
    );
    expect(lineName({ serviceName: 'Burun yuvish', serviceNameRu: '' }, 'ru')).toBe('Burun yuvish');
    expect(lineName({ serviceName: 'Burun yuvish', serviceNameRu: 'Промывание носа' }, 'uz')).toBe(
      'Burun yuvish',
    );
  });
});

describe('i18n — patients lugʻati', () => {
  function keysOf(tree: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(tree).flatMap(([k, v]) =>
      typeof v === 'string' ? [`${prefix}${k}`] : keysOf(v as Record<string, unknown>, `${prefix}${k}.`),
    );
  }

  it('uz va ru kalitlari bir xil, apostrof ʻ (U+02BB) va tutuq ʼ (U+02BC) ishlatilgan', () => {
    const uz = keysOf(patients.uz as unknown as Record<string, unknown>).sort();
    const ru = keysOf(patients.ru as unknown as Record<string, unknown>).sort();
    expect(ru).toEqual(uz);
    const uzText = JSON.stringify(patients.uz);
    expect(uzText).not.toMatch(/[oOgG]'/);
    expect(uzText).not.toMatch(/[oOgG]’/);
    expect(uzText).toContain('ʻ');
  });

  it('komponentlarda ishlatilgan har bir t("patients.…") kaliti lugʻatda bor', () => {
    const roots = ['src/components/patients', 'src/app/dashboard/patients', 'src/app/api/patients'];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    roots.forEach((r) => walk(path.resolve(process.cwd(), r)));
    const used = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/t\(\s*'((?:patients|common)\.[A-Za-z0-9_.]+)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(40);
    const missing = [...used].filter((k) => t(k) === k);
    expect(missing).toEqual([]);
  });
});

describe('isNoneText', () => {
  it('"Yoʻq", "Нет", "-", boʻsh → maʼlumot yoʻq; matn → bor', async () => {
    const { isNoneText } = await import('@/lib/patients/format');
    expect(isNoneText('Yoʻq')).toBe(true);
    expect(isNoneText("yo'q")).toBe(true);
    expect(isNoneText('Нет')).toBe(true);
    expect(isNoneText('-')).toBe(true);
    expect(isNoneText('')).toBe(true);
    expect(isNoneText(null)).toBe(true);
    expect(isNoneText('Penitsillin')).toBe(false);
    expect(isNoneText('Yoʻq, lekin dori')).toBe(false);
  });
});

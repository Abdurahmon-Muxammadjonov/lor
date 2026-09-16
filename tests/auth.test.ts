import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// DB kerak emas: prisma mijozini boʻsh stub bilan almashtiramiz (reset-token.ts import qiladi)
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { auth } from '@/i18n/messages/auth';
import type { Tree } from '@/i18n/types';
import { isStrongPassword } from '@/lib/auth/password';
import { rateLimitKey } from '@/lib/auth/rate-limit';
import { hashResetToken, generateResetToken, RESET_TOKEN_TTL_MS } from '@/lib/auth/reset-token';
import {
  ForgotSchema,
  LoginSchema,
  ResetSchema,
  passwordStrength,
  sanitizeCallbackUrl,
} from '@/lib/auth/schemas';
import { escapeHtml, formatDevMail, isMailConfigured, resetEmailTemplate, sendMail } from '@/lib/auth/email';

// ───────────────────────── i18n auth ─────────────────────────

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [prefix + k] : keyPaths(v, `${prefix}${k}.`),
  );
}
function leaves(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : leaves(v)));
}

describe('auth messages', () => {
  it('uz va ru kalitlari bir xil', () => {
    expect(keyPaths(auth.ru as Tree).sort()).toEqual(keyPaths(auth.uz as Tree).sort());
  });

  it('kerakli kalitlar mavjud', () => {
    const keys = new Set(keyPaths(auth.uz as Tree));
    const required = [
      'login.title',
      'login.subtitle',
      'login.login',
      'login.password',
      'login.remember',
      'login.submit',
      'login.forgot',
      'login.demoTitle',
      'login.demoHint',
      'forgot.title',
      'forgot.subtitle',
      'forgot.submit',
      'forgot.sent',
      'forgot.back',
      'reset.title',
      'reset.subtitle',
      'reset.password',
      'reset.confirm',
      'reset.submit',
      'reset.done',
      'reset.invalid',
      'reset.backToLogin',
      'errors.INVALID_CREDENTIALS',
      'errors.RATE_LIMITED',
      'errors.INACTIVE',
      'errors.CLINIC_INACTIVE',
      'errors.default',
      'visual.badge',
      'visual.title',
      'visual.subtitle',
      'visual.stat1',
      'visual.stat2',
      'visual.stat3',
      'visual.queueLabel',
      'email.subject',
      'email.greeting',
      'email.body',
      'email.button',
      'email.ignore',
    ];
    for (const k of required) expect(keys.has(k), `kalit yoʻq: ${k}`).toBe(true);
  });

  it("uz matnlarida oddiy apostrof (') ishlatilmagan, boʻsh matn yoʻq", () => {
    for (const s of leaves(auth.uz as Tree)) {
      expect(s.trim().length, `boʻsh matn`).toBeGreaterThan(0);
      expect(s.includes("'"), `oddiy apostrof: ${s}`).toBe(false);
    }
    for (const s of leaves(auth.ru as Tree)) expect(s.trim().length).toBeGreaterThan(0);
  });
});

// ───────────────────────── LoginSchema ─────────────────────────

describe('LoginSchema', () => {
  it('loginni trim + lowercase qiladi', () => {
    const r = LoginSchema.safeParse({ login: '  Admin  ', password: 'Admin123!' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.login).toBe('admin');
      expect(r.data.password).toBe('Admin123!');
    }
  });

  it('parolni oʻzgartirmaydi (trim qilmaydi)', () => {
    const r = LoginSchema.safeParse({ login: 'admin', password: ' abc123 ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.password).toBe(' abc123 ');
  });

  it('qisqa login rad etiladi (3 dan kam)', () => {
    const r = LoginSchema.safeParse({ login: 'ab', password: 'Admin123!' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.login).toContain('auth.validation.loginMin');
  });

  it('boʻshliqdan iborat login rad etiladi', () => {
    const r = LoginSchema.safeParse({ login: '      ', password: 'Admin123!' });
    expect(r.success).toBe(false);
  });

  it('uzun login rad etiladi (64 dan koʻp)', () => {
    const r = LoginSchema.safeParse({ login: 'a'.repeat(65), password: 'Admin123!' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.login).toContain('auth.validation.loginMax');
  });

  it('qisqa parol rad etiladi (6 dan kam)', () => {
    const r = LoginSchema.safeParse({ login: 'admin', password: '12345' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.flatten().fieldErrors.password).toContain('auth.validation.passwordMin');
  });

  it('uzun parol rad etiladi (128 dan koʻp)', () => {
    const r = LoginSchema.safeParse({ login: 'admin', password: 'x'.repeat(129) });
    expect(r.success).toBe(false);
  });

  it('maydonlar yoʻq boʻlsa required kaliti', () => {
    const r = LoginSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) {
      const fe = r.error.flatten().fieldErrors;
      expect(fe.login).toContain('common.validation.required');
      expect(fe.password).toContain('common.validation.required');
    }
  });

  it('email koʻrinishidagi login qabul qilinadi', () => {
    const r = LoginSchema.safeParse({ login: 'Admin@LOR.uz', password: 'Admin123!' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.login).toBe('admin@lor.uz');
  });
});

// ───────────────────────── ForgotSchema ─────────────────────────

describe('ForgotSchema', () => {
  it('login yoki emailni normallashtiradi', () => {
    expect(ForgotSchema.parse({ login: ' Doctor ' }).login).toBe('doctor');
    expect(ForgotSchema.parse({ login: 'Doctor@Clinic.UZ' }).login).toBe('doctor@clinic.uz');
  });

  it('boʻsh qiymat rad etiladi', () => {
    expect(ForgotSchema.safeParse({ login: '' }).success).toBe(false);
    expect(ForgotSchema.safeParse({}).success).toBe(false);
  });
});

// ───────────────────────── ResetSchema ─────────────────────────

describe('ResetSchema', () => {
  const token = 'a'.repeat(64);

  it('kuchli va mos parollar qabul qilinadi', () => {
    const r = ResetSchema.safeParse({ token, password: 'NewPass123', confirm: 'NewPass123' });
    expect(r.success).toBe(true);
  });

  it('parollar mos kelmasa confirm maydonida xato', () => {
    const r = ResetSchema.safeParse({ token, password: 'NewPass123', confirm: 'NewPass124' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fe = r.error.flatten().fieldErrors;
      expect(fe.confirm).toContain('auth.validation.confirmMatch');
      expect(fe.password).toBeUndefined();
    }
  });

  it('zaif parol rad etiladi (8 dan kam / harf yoʻq / raqam yoʻq)', () => {
    for (const weak of ['Ab1', 'abcdefgh', '12345678', 'short1']) {
      const r = ResetSchema.safeParse({ token, password: weak, confirm: weak });
      expect(r.success, weak).toBe(false);
      if (!r.success)
        expect(r.error.flatten().fieldErrors.password).toContain('auth.validation.passwordWeak');
    }
  });

  it('token boʻsh yoki juda qisqa boʻlsa rad etiladi', () => {
    expect(ResetSchema.safeParse({ token: '', password: 'NewPass123', confirm: 'NewPass123' }).success).toBe(
      false,
    );
    expect(
      ResetSchema.safeParse({ token: 'abc', password: 'NewPass123', confirm: 'NewPass123' }).success,
    ).toBe(false);
    expect(ResetSchema.safeParse({ password: 'NewPass123', confirm: 'NewPass123' }).success).toBe(false);
  });

  it('token trim qilinadi', () => {
    const r = ResetSchema.safeParse({ token: `  ${token}  `, password: 'NewPass123', confirm: 'NewPass123' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.token).toBe(token);
  });
});

// ───────────────────────── isStrongPassword / passwordStrength ─────────────────────────

describe('isStrongPassword', () => {
  it('kamida 8 belgi, harf + raqam', () => {
    expect(isStrongPassword('Admin123!')).toBe(true);
    expect(isStrongPassword('abcdefg1')).toBe(true);
    expect(isStrongPassword('1234567a')).toBe(true);
  });

  it('zaif parollar', () => {
    expect(isStrongPassword('')).toBe(false);
    expect(isStrongPassword('abc1')).toBe(false);
    expect(isStrongPassword('abcdefgh')).toBe(false);
    expect(isStrongPassword('12345678')).toBe(false);
    expect(isStrongPassword('!!!!!!!!')).toBe(false);
  });
});

describe('passwordStrength', () => {
  it('0..4 oraligʻida oʻsib boradi', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(0);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefg1')).toBe(2);
    expect(passwordStrength('Abcdefg1')).toBe(3);
    expect(passwordStrength('Abcdefg1!')).toBe(4);
    expect(passwordStrength('Abcdefghijklmn1')).toBe(4);
  });
});

// ───────────────────────── rateLimitKey ─────────────────────────

describe('rateLimitKey', () => {
  it('loginni normallashtiradi (trim + lowercase) va IP bilan birlashtiradi', () => {
    expect(rateLimitKey('  Admin ', '1.2.3.4')).toBe('admin|1.2.3.4');
    expect(rateLimitKey('ADMIN', '1.2.3.4')).toBe(rateLimitKey('admin', '1.2.3.4'));
  });

  it('har xil IP — har xil kalit', () => {
    expect(rateLimitKey('admin', '1.1.1.1')).not.toBe(rateLimitKey('admin', '2.2.2.2'));
  });

  it('forgot endpointi uchun "forgot|<ip>" kaliti', () => {
    expect(rateLimitKey('forgot', '10.0.0.7')).toBe('forgot|10.0.0.7');
    expect(rateLimitKey('forgot', 'unknown')).toBe('forgot|unknown');
  });
});

// ───────────────────────── sanitizeCallbackUrl ─────────────────────────

describe('sanitizeCallbackUrl', () => {
  it('ichki yoʻllar qabul qilinadi', () => {
    expect(sanitizeCallbackUrl('/dashboard/queue?d=2026-09-15')).toBe('/dashboard/queue?d=2026-09-15');
    expect(sanitizeCallbackUrl(['/dashboard/patients', '/x'])).toBe('/dashboard/patients');
  });

  it('tashqi / protokol-nisbiy / boʻsh manzillar → /dashboard', () => {
    expect(sanitizeCallbackUrl('https://evil.com')).toBe('/dashboard');
    expect(sanitizeCallbackUrl('//evil.com/x')).toBe('/dashboard');
    expect(sanitizeCallbackUrl('/\\evil.com')).toBe('/dashboard');
    expect(sanitizeCallbackUrl('javascript:alert(1)')).toBe('/dashboard');
    expect(sanitizeCallbackUrl('')).toBe('/dashboard');
    expect(sanitizeCallbackUrl(undefined)).toBe('/dashboard');
    expect(sanitizeCallbackUrl(null)).toBe('/dashboard');
    expect(sanitizeCallbackUrl('/dashboard\r\nSet-Cookie: x')).toBe('/dashboard');
  });

  it('/login ga qayta yoʻnaltirish halqasi oldini oladi', () => {
    expect(sanitizeCallbackUrl('/login')).toBe('/dashboard');
    expect(sanitizeCallbackUrl('/login?callbackUrl=/x')).toBe('/dashboard');
  });

  it('fallback parametri', () => {
    expect(sanitizeCallbackUrl('bad', '/dashboard/cashier')).toBe('/dashboard/cashier');
  });
});

// ───────────────────────── reset token yordamchilari ─────────────────────────

describe('reset token helpers', () => {
  it('generateResetToken — 32 bayt hex (64 belgi), har safar har xil', () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('hashResetToken — sha256 hex, deterministik, trim qiladi', () => {
    const tok = generateResetToken();
    const h = hashResetToken(tok);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(tok)).toBe(h);
    expect(hashResetToken(`  ${tok} `)).toBe(h);
    expect(hashResetToken(generateResetToken())).not.toBe(h);
    expect(h).not.toBe(tok);
  });

  it('muddat 1 soat', () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});

// ───────────────────────── email ─────────────────────────

describe('resetEmailTemplate', () => {
  const url =
    'http://localhost:3000/reset-password?token=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

  it.each(['uz', 'ru'] as const)('%s — html va text ichida havola bor', (locale) => {
    const tpl = resetEmailTemplate(locale, { name: 'Dilnoza Karimova', url });
    expect(tpl.subject.length).toBeGreaterThan(0);
    expect(tpl.html).toContain(url);
    expect(tpl.text).toContain(url);
    expect(tpl.html).toContain('Dilnoza Karimova');
    expect(tpl.text).toContain('Dilnoza Karimova');
    expect(tpl.html).toContain(`href="${url}"`);
  });

  it('tilga qarab mavzu va matn farq qiladi, ikkinchi til ham mavjud (ikki tilli)', () => {
    const uz = resetEmailTemplate('uz', { name: 'A', url });
    const ru = resetEmailTemplate('ru', { name: 'A', url });
    expect(uz.subject).toBe(auth.uz.email.subject);
    expect(ru.subject).toBe(auth.ru.email.subject);
    expect(uz.subject).not.toBe(ru.subject);
    expect(uz.html).toContain(auth.uz.email.button);
    expect(uz.html).toContain(auth.ru.email.button);
    expect(ru.html).toContain(auth.ru.email.button);
    expect(ru.html).toContain(auth.uz.email.button);
    expect(uz.text).toContain(auth.uz.email.ignore);
    expect(uz.text).toContain(auth.ru.email.ignore);
    expect(uz.html).toMatch(/lang="uz-Latn"/);
    expect(ru.html).toMatch(/lang="ru"/);
  });

  it('ismdagi HTML belgilar ekranlanadi', () => {
    const tpl = resetEmailTemplate('uz', { name: '<b>X</b> & "Y"', url });
    expect(tpl.html).not.toContain('<b>X</b>');
    expect(tpl.html).toContain('&lt;b&gt;X&lt;/b&gt; &amp; &quot;Y&quot;');
    expect(tpl.text).toContain('<b>X</b> & "Y"');
  });

  it('boʻsh ism uchun neytral murojaat', () => {
    expect(resetEmailTemplate('uz', { name: '   ', url }).text).toContain('hamkasb');
    expect(resetEmailTemplate('ru', { name: '', url }).text).toContain('коллега');
  });

  it('dizayn: qorongʻi karta va gradient tugma', () => {
    const tpl = resetEmailTemplate('uz', { name: 'A', url });
    expect(tpl.html).toContain('#131a2b');
    expect(tpl.html).toContain('linear-gradient(135deg,#00d4ff 0%,#7c5cff 100%)');
  });
});

describe('escapeHtml', () => {
  it('maxsus belgilarni almashtiradi', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(escapeHtml('oddiy matn')).toBe('oddiy matn');
  });
});

describe('sendMail (dev fallback)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.SMTP_HOST;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it('SMTP_HOST boʻlmasa konsolga chiqaradi va delivered:false qaytaradi', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    expect(isMailConfigured()).toBe(false);
    const res = await sendMail({
      to: 'a@b.uz',
      subject: 'Mavzu',
      html: '<p>x</p>',
      text: 'Salom\nhavola: http://x',
    });
    expect(res).toEqual({ delivered: false });
    expect(info).toHaveBeenCalledTimes(1);
    const out = String(info.mock.calls[0]?.[0] ?? '');
    expect(out).toContain('DEV MAIL');
    expect(out).toContain('To:      a@b.uz');
    expect(out).toContain('Subject: Mavzu');
    expect(out).toContain('│ havola: http://x');
  });

  it('SMTP_HOST boʻsh satr ham sozlanmagan hisoblanadi', () => {
    process.env.SMTP_HOST = '   ';
    expect(isMailConfigured()).toBe(false);
    process.env.SMTP_HOST = 'smtp.example.com';
    expect(isMailConfigured()).toBe(true);
  });

  it('formatDevMail ramkali koʻrinish', () => {
    const s = formatDevMail({ to: 'x@y.z', subject: 'S', html: '', text: 'L1\nL2' });
    expect(s.startsWith('┌')).toBe(true);
    expect(s.trimEnd().endsWith('─')).toBe(true);
    expect(s).toContain('│ L1\n│ L2');
  });
});

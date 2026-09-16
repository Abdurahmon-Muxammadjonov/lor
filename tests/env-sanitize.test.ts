import { describe, it, expect } from 'vitest';
import { sanitizeEnv, URLISH_ENV_KEYS } from '@/lib/env-sanitize';

describe('sanitizeEnv', () => {
  it('boʻsh va faqat probelli qiymatlarni oʻchiradi', () => {
    const env: Record<string, string | undefined> = { NEXTAUTH_URL: '', APP_URL: '   ', DATABASE_URL: 'postgres://x' };
    const removed = sanitizeEnv(env);
    expect(removed.sort()).toEqual(['APP_URL', 'NEXTAUTH_URL']);
    expect('NEXTAUTH_URL' in env).toBe(false);
    expect('APP_URL' in env).toBe(false);
    expect(env.DATABASE_URL).toBe('postgres://x');
  });

  it('haqiqiy qiymatlarga tegmaydi va roʻyxatdan tashqari kalitlarni saqlaydi', () => {
    const env: Record<string, string | undefined> = { NEXTAUTH_URL: 'https://lor.uz', OTHER: '' };
    expect(sanitizeEnv(env)).toEqual([]);
    expect(env.NEXTAUTH_URL).toBe('https://lor.uz');
    expect(env.OTHER).toBe('');
  });

  it('next-auth qulaydigan kalitlarni qamrab oladi', () => {
    expect(URLISH_ENV_KEYS).toContain('NEXTAUTH_URL');
    expect(URLISH_ENV_KEYS).toContain('NEXTAUTH_URL_INTERNAL');
    expect(URLISH_ENV_KEYS).toContain('VERCEL_URL');
  });
});

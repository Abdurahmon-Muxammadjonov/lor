import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LOCAL_URL, absoluteUrl, getSiteUrl, getSiteUrlObject, normalizeBaseUrl } from '@/lib/site-url';
import { SITE } from '@/data/landing-content';

const KEYS = [
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXTAUTH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('normalizeBaseUrl', () => {
  it('boʻsh va yaroqsiz qiymatlarni rad etadi', () => {
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('   ')).toBeNull();
    expect(normalizeBaseUrl(undefined)).toBeNull();
    expect(normalizeBaseUrl(null)).toBeNull();
    expect(normalizeBaseUrl('http://')).toBeNull();
    expect(normalizeBaseUrl('ftp://lor.uz')).toBeNull();
  });

  it('protokolsiz domenga https qoʻshadi (Vercel VERCEL_URL koʻrinishi)', () => {
    expect(normalizeBaseUrl('lor-abc123.vercel.app')).toBe('https://lor-abc123.vercel.app');
  });

  it('oxirgi slash va yoʻlni olib tashlaydi', () => {
    expect(normalizeBaseUrl('https://lor.uz/')).toBe('https://lor.uz');
    expect(normalizeBaseUrl('https://lor.uz/dashboard')).toBe('https://lor.uz');
    expect(normalizeBaseUrl('  https://lor.uz  ')).toBe('https://lor.uz');
  });

  it('portni saqlaydi', () => {
    expect(normalizeBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });
});

describe('getSiteUrl', () => {
  it('APP_URL boʻsh satr boʻlsa qulamaydi (Vercel build xatosi)', () => {
    process.env.APP_URL = '';
    expect(() => getSiteUrl()).not.toThrow();
    expect(getSiteUrl()).toBe(SITE.url.replace(/\/$/, ''));
    expect(() => getSiteUrlObject()).not.toThrow();
    expect(getSiteUrlObject().href).toContain('http');
  });

  it('APP_URL ustunlikka ega', () => {
    process.env.APP_URL = 'https://crm.example.uz';
    process.env.NEXTAUTH_URL = 'https://other.example.uz';
    expect(getSiteUrl()).toBe('https://crm.example.uz');
  });

  it('APP_URL boʻsh boʻlsa NEXTAUTH_URL ga oʻtadi', () => {
    process.env.APP_URL = '  ';
    process.env.NEXTAUTH_URL = 'https://next.example.uz/';
    expect(getSiteUrl()).toBe('https://next.example.uz');
  });

  it('faqat VERCEL_URL boʻlsa undan foydalanadi', () => {
    process.env.VERCEL_URL = 'lor-git-main.vercel.app';
    expect(getSiteUrl()).toBe('https://lor-git-main.vercel.app');
  });

  it('yaroqsiz APP_URL keyingi manbaga oʻtadi', () => {
    process.env.APP_URL = 'http://';
    process.env.NEXTAUTH_URL = 'https://valid.example.uz';
    expect(getSiteUrl()).toBe('https://valid.example.uz');
  });

  it('hech narsa boʻlmasa SITE.url, u ham boʻlmasa localhost', () => {
    expect(getSiteUrl()).toBe(SITE.url.replace(/\/$/, ''));
    expect(LOCAL_URL).toBe('http://localhost:3000');
  });
});

describe('absoluteUrl', () => {
  it('yoʻlni bazaga qoʻshadi', () => {
    process.env.APP_URL = 'https://crm.example.uz';
    expect(absoluteUrl('/login')).toBe('https://crm.example.uz/login');
    expect(absoluteUrl('login')).toBe('https://crm.example.uz/login');
    expect(absoluteUrl()).toBe('https://crm.example.uz/');
  });
});

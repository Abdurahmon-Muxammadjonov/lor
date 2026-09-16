#!/usr/bin/env node
/**
 * Build wrapper: `npm run build` shu faylni ishga tushiradi.
 *
 * Vazifasi — `prisma generate` va `next build` ishga tushishidan OLDIN boʻsh qiymatli muhit
 * oʻzgaruvchilarini oʻchirish. Hosting panelida (Vercel) oʻzgaruvchini qiymatsiz qoʻshish mumkin;
 * u kodga `''` boʻlib keladi va kutubxonalar uni haqiqiy qiymat deb qabul qiladi. Masalan
 * `next-auth/react` modul darajasida `parseUrl(process.env.NEXTAUTH_URL)` chaqiradi va boʻsh satrda
 * `new URL('')` → `TypeError: Invalid URL (input: '')` beradi; build esa
 * `Failed to collect page data for /_not-found` bilan toʻxtaydi.
 *
 * Tozalash aynan shu jarayonda bajariladi va `next build` (hamda u yaratadigan barcha
 * static-generation worker'lari) tozalangan `process.env` ni meros qilib oladi — shuning uchun
 * `next.config.mjs` dagi himoyaga qaraganda ishonchliroq.
 */
import { spawnSync } from 'node:child_process';

const KEYS = [
  'NEXTAUTH_URL',
  'NEXTAUTH_URL_INTERNAL',
  'NEXTAUTH_SECRET',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'ESKIZ_BASE_URL',
  'ESKIZ_EMAIL',
  'ESKIZ_PASSWORD',
  'ESKIZ_FROM',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_ADMIN_CHAT_ID',
  'CLICK_MERCHANT_ID',
  'CLICK_SERVICE_ID',
  'CLICK_SECRET_KEY',
  'CLICK_MERCHANT_USER_ID',
  'PAYME_MERCHANT_ID',
  'PAYME_KEY',
  'PAYME_TEST_KEY',
  'PAYME_CHECKOUT_URL',
  'CRON_SECRET',
];

const removed = [];
for (const key of KEYS) {
  const value = process.env[key];
  if (typeof value === 'string' && value.trim() === '') {
    delete process.env[key];
    removed.push(key);
  }
}
if (removed.length > 0) {
  console.warn(`[build] boʻsh qiymatli muhit oʻzgaruvchilari eʼtiborsiz qoldirildi: ${removed.join(', ')}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
  if (result.error) {
    console.error(`[build] "${command} ${args.join(' ')}" ishga tushmadi:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const bin = (name) => new URL(`../node_modules/.bin/${name}`, import.meta.url).pathname;

run(bin('prisma'), ['generate']);
run(bin('next'), ['build']);

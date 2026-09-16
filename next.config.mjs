/**
 * Boʻsh qiymatli muhit oʻzgaruvchilarini olib tashlash — ilovaning birorta moduli yuklanishidan OLDIN.
 * Vercel'da qiymatsiz qoʻshilgan oʻzgaruvchi `''` boʻlib keladi va, masalan, `next-auth/react`
 * modul darajasida `new URL('')` chaqirib build'ni toʻxtatadi
 * (TypeError: Invalid URL → Failed to collect page data for /_not-found).
 * Bu fayl build jarayonida ham, har bir static-generation worker'ida ham yuklanadi.
 */
const URLISH_ENV_KEYS = [
  'NEXTAUTH_URL',
  'NEXTAUTH_URL_INTERNAL',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'ESKIZ_BASE_URL',
  'PAYME_CHECKOUT_URL',
  'SMTP_HOST',
];
for (const key of URLISH_ENV_KEYS) {
  if (typeof process.env[key] === 'string' && process.env[key].trim() === '') delete process.env[key];
}

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), usb=(self)' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'exceljs', 'nodemailer', 'iconv-lite'],
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', 'date-fns'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;

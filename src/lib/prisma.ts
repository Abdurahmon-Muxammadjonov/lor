import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function getClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;
  const client = createClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  else globalForPrisma.prisma = client;
  return client;
}

/**
 * Prisma mijozi **kechiktirilgan** (lazy) tarzda yaratiladi: `new PrismaClient()` faqat birinchi
 * murojaatda ishga tushadi, modul import qilinganda emas.
 *
 * Sabab: `DATABASE_URL` boʻlmagan yoki notoʻgʻri boʻlgan muhitda (masalan Vercel'da env
 * oʻzgaruvchilari toʻldirilmagan holda `next build` sahifa maʼlumotlarini yigʻayotganda)
 * konstruktor xato tashlashi va butun build'ni "Failed to collect page data" bilan toʻxtatishi mumkin.
 * Lazy proxy bilan build oʻtadi, xato esa faqat haqiqiy soʻrov paytida (API javobida) koʻrinadi.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_target, prop) {
    return Reflect.has(getClient() as object, prop);
  },
  set(_target, prop, value) {
    return Reflect.set(getClient() as object, prop, value);
  },
});

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

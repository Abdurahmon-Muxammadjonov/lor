import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { sessionCookieName, secureAuthCookies } from './cookies';
import { verifyPassword } from './password';
import { checkLoginRateLimit, rateLimitKey, recordLoginAttempt } from './rate-limit';

export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 kun — "refresh token" muddati
export const TOKEN_ROTATE_SEC = 60 * 60; // 1 soat — access token yangilanish (rotation)
const DB_RECHECK_MS = 5 * 60 * 1000; // 5 daqiqa — sessionVersion / isActive tekshiruvi

export class AuthError extends Error {
  constructor(
    public code: 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'INACTIVE' | 'CLINIC_INACTIVE',
    public retryAfterSec = 0,
  ) {
    super(code);
    this.name = 'AuthError';
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SEC, updateAge: TOKEN_ROTATE_SEC },
  jwt: { maxAge: SESSION_MAX_AGE_SEC },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Login',
      credentials: {
        login: { label: 'Login', type: 'text' },
        password: { label: 'Parol', type: 'password' },
      },
      async authorize(credentials, req) {
        const login = credentials?.login?.trim().toLowerCase() ?? '';
        const password = credentials?.password ?? '';
        if (!login || !password) throw new AuthError('INVALID_CREDENTIALS');

        const ip =
          (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
          (req?.headers?.['x-real-ip'] as string | undefined) ||
          'unknown';
        const key = rateLimitKey(login, ip);
        const rl = await checkLoginRateLimit(key);
        if (rl.blocked) throw new AuthError('RATE_LIMITED', rl.retryAfterSec);

        const user = await prisma.user.findFirst({
          where: { OR: [{ login }, { email: login }] },
          include: { clinic: { select: { id: true, name: true, slug: true, isActive: true } } },
        });
        const ok = user ? await verifyPassword(password, user.password) : false;
        if (!user || !ok) {
          await recordLoginAttempt(key, false);
          throw new AuthError('INVALID_CREDENTIALS');
        }
        if (!user.isActive) {
          await recordLoginAttempt(key, false);
          throw new AuthError('INACTIVE');
        }
        if (!user.clinic.isActive && user.role !== 'SUPER_ADMIN') {
          throw new AuthError('CLINIC_INACTIVE');
        }

        await recordLoginAttempt(key, true);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await prisma.auditLog.create({
          data: { clinicId: user.clinicId, userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ip },
        });

        return {
          id: user.id,
          login: user.login,
          fullName: user.fullName,
          role: user.role,
          clinicId: user.clinicId,
          clinicName: user.clinic.name,
          clinicSlug: user.clinic.slug,
          room: user.room,
          color: user.color,
          sessionVersion: user.sessionVersion,
          name: user.fullName,
          email: user.email ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const now = Date.now();
      if (user) {
        token.id = user.id;
        token.login = user.login;
        token.fullName = user.fullName;
        token.role = user.role;
        token.clinicId = user.clinicId;
        token.clinicName = user.clinicName;
        token.clinicSlug = user.clinicSlug;
        token.room = user.room;
        token.color = user.color;
        token.sessionVersion = user.sessionVersion;
        token.checkedAt = now;
        token.issuedAt = now;
        return token;
      }
      // Token rotation: har `updateAge` da NextAuth qayta chaqiradi → issuedAt yangilanadi
      if (trigger === 'update' || now - (token.issuedAt ?? 0) > TOKEN_ROTATE_SEC * 1000) {
        token.issuedAt = now;
      }
      // Davriy DB tekshiruvi: foydalanuvchi oʻchirilgan / parol oʻzgargan boʻlsa sessiya bekor
      if (now - (token.checkedAt ?? 0) > DB_RECHECK_MS) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            isActive: true,
            sessionVersion: true,
            role: true,
            fullName: true,
            room: true,
            color: true,
            clinic: { select: { name: true, slug: true, isActive: true } },
          },
        });
        if (!fresh || !fresh.isActive || fresh.sessionVersion !== token.sessionVersion || !fresh.clinic.isActive) {
          // Boʻsh token → session null → middleware /login ga yoʻnaltiradi
          return { ...token, id: '', role: undefined as never, clinicId: '' };
        }
        token.role = fresh.role;
        token.fullName = fresh.fullName;
        token.room = fresh.room;
        token.color = fresh.color;
        token.clinicName = fresh.clinic.name;
        token.clinicSlug = fresh.clinic.slug;
        token.checkedAt = now;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id) {
        // bekor qilingan sessiya
        return { ...session, user: undefined as never, expires: new Date(0).toISOString() };
      }
      session.user = {
        ...session.user,
        id: token.id,
        login: token.login,
        fullName: token.fullName,
        name: token.fullName,
        role: token.role,
        clinicId: token.clinicId,
        clinicName: token.clinicName,
        clinicSlug: token.clinicSlug,
        room: token.room,
        color: token.color,
      };
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: secureAuthCookies() },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

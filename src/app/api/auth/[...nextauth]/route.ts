import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/options';

/**
 * NextAuth (Credentials, JWT) — /api/auth/signin, /api/auth/callback/credentials, /api/auth/session, ...
 * Middleware `/api/auth` prefiksini ochiq qoldiradi.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

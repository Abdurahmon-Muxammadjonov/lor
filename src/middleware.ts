import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { sessionCookieName, secureAuthCookies } from '@/lib/auth/cookies';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/i18n/config';

/**
 * 1) /dashboard/* — faqat kirgan foydalanuvchilar (JWT cookie)
 * 2) /api/* (auth va ochiq endpointlardan tashqari) — sessiya + CSRF (Origin / X-Requested-With)
 * 3) Til cookie'si boʻlmasa oʻrnatiladi (Accept-Language → uz/ru)
 */

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/health', '/api/public', '/api/cron', '/api/webhooks', '/api/kiosk', '/api/display'];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** `authOptions.cookies.sessionToken` bilan bir xil nom — nomlar farq qilsa hamma soʻrov 401 boʻladi. */
function readToken(req: NextRequest) {
  return getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: sessionCookieName(),
    secureCookie: secureAuthCookies(),
  });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;
  if (!origin) return true; // brauzer boʻlmagan mijozlar (curl) — sessiya cookie bilan baribir kira olmaydi
  try {
    const o = new URL(origin);
    return o.host === req.nextUrl.host;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // ── Til cookie'si ──
  const localeCookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (!isLocale(localeCookie)) {
    const al = req.headers.get('accept-language') ?? '';
    const guess = /^ru\b/i.test(al) ? 'ru' : DEFAULT_LOCALE;
    res.cookies.set(LOCALE_COOKIE, guess, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }

  // ── API himoyasi ──
  if (pathname.startsWith('/api')) {
    if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return res;

    if (MUTATING.has(req.method)) {
      const xrw = req.headers.get('x-requested-with');
      if (!sameOrigin(req) || xrw !== 'lor-crm') {
        return NextResponse.json({ ok: false, error: { code: 'CSRF', message: 'Cross-site request rejected' } }, { status: 403 });
      }
    }
    const token = await readToken(req);
    if (!token?.id) {
      return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Avtorizatsiya talab qilinadi' } }, { status: 401 });
    }
    return res;
  }

  // ── Dashboard himoyasi ──
  if (pathname.startsWith('/dashboard')) {
    const token = await readToken(req);
    if (!token?.id) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return res;
  }

  // ── Kirgan foydalanuvchi /login ga kelsa → dashboard ──
  if (pathname === '/login') {
    const token = await readToken(req);
    if (token?.id) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|fonts|images|robots.txt|sitemap.xml|manifest.webmanifest).*)'],
};

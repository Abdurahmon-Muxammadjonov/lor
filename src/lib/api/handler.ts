import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Role } from '@prisma/client';
import { authOptions } from '@/lib/auth/options';
import type { SessionUser } from '@/lib/auth/session';
import { can, type Permission } from '@/lib/permissions';
import { ApiError } from './errors';
import { toErrorResponse } from './respond';

export interface ApiContext<P extends Record<string, string> = Record<string, string>> {
  user: SessionUser;
  params: P;
  req: NextRequest;
  /** SUPER_ADMIN boshqa klinika nomidan ishlashi mumkin (?clinicId=), qolganlar — oʻz klinikasi */
  clinicId: string;
  ip: string;
}

export interface GuardOptions {
  /** Ruxsat etilgan rollar (SUPER_ADMIN doim ruxsatli) */
  roles?: Role[];
  /** yoki permission kaliti (permissions.ts) */
  permission?: Permission;
}

type Handler<P extends Record<string, string>> = (ctx: ApiContext<P>) => Promise<Response>;

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Route handler wrapper: sessiya + rol tekshiruvi (server-side), xatolarni yagona formatga keltirish.
 *
 *   export const GET = withAuth({ permission: 'patients.view' }, async ({ user, clinicId }) => ok(...));
 */
export function withAuth<P extends Record<string, string> = Record<string, string>>(
  guard: GuardOptions,
  handler: Handler<P>,
) {
  return async (req: NextRequest, routeCtx?: { params?: P }): Promise<Response> => {
    try {
      const session = await getServerSession(authOptions);
      const u = session?.user;
      if (!u?.id || !u.role) throw ApiError.unauthorized();

      const roleOk = guard.roles ? guard.roles.includes(u.role) : true;
      const permOk = guard.permission ? can(u.role, guard.permission) : true;
      const allowed = u.role === 'SUPER_ADMIN' || (roleOk && permOk);
      if (!allowed) throw ApiError.forbidden();

      const override = req.nextUrl.searchParams.get('clinicId');
      const clinicId = u.role === 'SUPER_ADMIN' && override ? override : u.clinicId;

      return await handler({
        user: {
          id: u.id,
          login: u.login,
          fullName: u.fullName,
          role: u.role,
          clinicId: u.clinicId,
          clinicName: u.clinicName,
          clinicSlug: u.clinicSlug,
          room: u.room,
          color: u.color,
        },
        params: (routeCtx?.params ?? {}) as P,
        req,
        clinicId,
        ip: clientIp(req),
      });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Ochiq (sessiyasiz) endpointlar uchun — faqat xatolarni formatlaydi */
export function withPublic<P extends Record<string, string> = Record<string, string>>(
  handler: (ctx: { req: NextRequest; params: P; ip: string }) => Promise<Response>,
) {
  return async (req: NextRequest, routeCtx?: { params?: P }): Promise<Response> => {
    try {
      return await handler({ req, params: (routeCtx?.params ?? {}) as P, ip: clientIp(req) });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

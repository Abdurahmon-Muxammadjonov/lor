import type { ApiContext } from '@/lib/api/handler';
import { requestLocale } from './request-locale';
import type { CashierCtx } from './service';

/** withAuth kontekstidan kassa xizmat konteksti */
export function cashierCtx<P extends Record<string, string>>(ctx: ApiContext<P>): CashierCtx {
  return {
    clinicId: ctx.clinicId,
    actor: { id: ctx.user.id, role: ctx.user.role, fullName: ctx.user.fullName },
    locale: requestLocale(ctx.req),
    ip: ctx.ip,
    userAgent: ctx.req.headers.get('user-agent'),
  };
}

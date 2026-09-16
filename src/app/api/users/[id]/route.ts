import { withAuth, ok, parseBody } from '@/lib/api';
import { UserUpdateSchema } from '@/lib/staff/schemas';
import { deactivateUser, getUser, updateUser } from '@/lib/staff/service';

export const dynamic = 'force-dynamic';

type P = { id: string };

/** GET /api/users/[id] */
export const GET = withAuth<P>({ permission: 'staff.view' }, async ({ clinicId, params }) => {
  return ok(await getUser(clinicId, params.id));
});

/** PATCH /api/users/[id] — qisman yangilash (rol/faollik oʻzgarsa sessiya bekor qilinadi) */
export const PATCH = withAuth<P>({ permission: 'staff.write' }, async ({ user, clinicId, params, req, ip }) => {
  const body = await parseBody(req, UserUpdateSchema);
  const row = await updateUser(
    { id: user.id, role: user.role, clinicId, ip, userAgent: req.headers.get('user-agent') },
    clinicId,
    params.id,
    body,
  );
  return ok(row);
});

/** DELETE /api/users/[id] — nofaol qilish (oʻzini emas; kamida bitta faol ADMIN qoladi) */
export const DELETE = withAuth<P>({ permission: 'staff.write' }, async ({ user, clinicId, params, req, ip }) => {
  const row = await deactivateUser(
    { id: user.id, role: user.role, clinicId, ip, userAgent: req.headers.get('user-agent') },
    clinicId,
    params.id,
  );
  return ok(row);
});

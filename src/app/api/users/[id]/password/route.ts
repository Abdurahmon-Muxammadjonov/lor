import { withAuth, ok, parseBody } from '@/lib/api';
import { PasswordSchema } from '@/lib/staff/schemas';
import { setPassword } from '@/lib/staff/service';

export const dynamic = 'force-dynamic';

type P = { id: string };

/** POST /api/users/[id]/password — yangi parol (bcrypt), barcha sessiyalar bekor qilinadi */
export const POST = withAuth<P>({ permission: 'staff.write' }, async ({ user, clinicId, params, req, ip }) => {
  const body = await parseBody(req, PasswordSchema);
  const res = await setPassword(
    { id: user.id, role: user.role, clinicId, ip, userAgent: req.headers.get('user-agent') },
    clinicId,
    params.id,
    body.password,
  );
  return ok(res);
});

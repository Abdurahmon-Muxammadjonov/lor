import { withAuth, ok, created, parseBody, parseQuery } from '@/lib/api';
import { UserCreateSchema, UsersQuerySchema } from '@/lib/staff/schemas';
import { createUser, listUsers } from '@/lib/staff/service';

export const dynamic = 'force-dynamic';

/** GET /api/users?role=DOCTOR&active=1&search= — xodimlar roʻyxati (parolsiz, jadval bilan) */
export const GET = withAuth({ permission: 'staff.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, UsersQuerySchema);
  const items = await listUsers(clinicId, q);
  return ok({ items, total: items.length });
});

/** POST /api/users — yangi xodim (faqat ADMIN) */
export const POST = withAuth({ permission: 'staff.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, UserCreateSchema);
  const row = await createUser(
    { id: user.id, role: user.role, clinicId, ip, userAgent: req.headers.get('user-agent') },
    clinicId,
    body,
  );
  return created(row);
});

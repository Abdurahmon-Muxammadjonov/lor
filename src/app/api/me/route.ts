import { ApiError, audit, ok, parseBody, withAuth } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { normalizePhone } from '@/lib/utils';
import { getMeClinic, getMeUser, toMeUser } from '@/lib/dashboard/me';
import { UpdateMeSchema } from '@/lib/dashboard/schemas';
import type { MeDTO, UpdateMeResultDTO } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

/** GET /api/me → { user, clinic } (kioskKey faqat ADMIN / RECEPTION) */
export const GET = withAuth({}, async ({ user, clinicId }) => {
  const [me, clinic] = await Promise.all([getMeUser(user.id, user.clinicId), getMeClinic(clinicId, user.role)]);
  const data: MeDTO = { user: me, clinic };
  return ok(data, { headers: { 'Cache-Control': 'no-store' } });
});

/**
 * PATCH /api/me { fullName?, phone?, password?: { current, next } }
 * Parol almashtirishda joriy parol tekshiriladi; sessionVersion oshirilmaydi (joriy sessiya saqlanadi), audit yoziladi.
 */
export const PATCH = withAuth({}, async ({ user, req, ip }) => {
  const body = await parseBody(req, UpdateMeSchema);

  const current = await prisma.user.findFirst({
    where: { id: user.id, clinicId: user.clinicId },
    select: { id: true, fullName: true, phone: true, password: true },
  });
  if (!current) throw ApiError.notFound('Foydalanuvchi topilmadi');

  const data: { fullName?: string; phone?: string | null; password?: string } = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  if (body.fullName !== undefined && body.fullName !== current.fullName) {
    data.fullName = body.fullName;
    before.fullName = current.fullName;
    after.fullName = body.fullName;
  }
  if (body.phone !== undefined) {
    const phone = body.phone === '' ? null : normalizePhone(body.phone);
    if (phone !== current.phone) {
      data.phone = phone;
      before.phone = current.phone;
      after.phone = phone;
    }
  }

  let passwordChanged = false;
  if (body.password) {
    const okPwd = await verifyPassword(body.password.current, current.password);
    if (!okPwd) {
      throw new ApiError(400, 'VALIDATION', 'Joriy parol notoʻgʻri', {
        fieldErrors: { 'password.current': ['dashboard.profile.wrongPassword'] },
      });
    }
    data.password = await hashPassword(body.password.next);
    passwordChanged = true;
    after.passwordChanged = true;
  }

  if (Object.keys(data).length === 0) {
    const unchanged = await getMeUser(user.id, user.clinicId);
    const result: UpdateMeResultDTO = { user: unchanged, passwordChanged: false };
    return ok(result);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({
      where: { id: current.id },
      data,
      select: {
        id: true,
        login: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        specialty: true,
        room: true,
        color: true,
        clinicId: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    await audit(
      {
        clinicId: user.clinicId,
        userId: user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        before,
        after,
        ip,
        userAgent: req.headers.get('user-agent'),
      },
      tx,
    );
    return row;
  });

  const result: UpdateMeResultDTO = { user: toMeUser(updated), passwordChanged };
  return ok(result);
});

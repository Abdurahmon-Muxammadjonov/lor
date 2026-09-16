import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { parseClinicSettings } from '@/lib/settings/types';
import { canSeeKioskKey } from './nav';
import type { MeClinicDTO, MeUserDTO } from './types';

const USER_SELECT = {
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
} as const;

export function toMeUser(u: {
  id: string;
  login: string;
  email: string | null;
  fullName: string;
  role: Role;
  phone: string | null;
  specialty: string | null;
  room: string | null;
  color: string;
  clinicId: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}): MeUserDTO {
  return {
    id: u.id,
    login: u.login,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    phone: u.phone,
    specialty: u.specialty,
    room: u.room,
    color: u.color,
    clinicId: u.clinicId,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Joriy foydalanuvchi (DB dan, sessiyadan emas — profil oʻzgarishlari darhol koʻrinadi) */
export async function getMeUser(userId: string, clinicId: string): Promise<MeUserDTO> {
  const u = await prisma.user.findFirst({ where: { id: userId, clinicId }, select: USER_SELECT });
  if (!u) throw ApiError.notFound('Foydalanuvchi topilmadi');
  return toMeUser(u);
}

/** Klinika maʼlumoti; kiosk kaliti faqat ADMIN / RECEPTION uchun */
export async function getMeClinic(clinicId: string, role: Role): Promise<MeClinicDTO> {
  const c = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, slug: true, plan: true, phone: true, kioskKey: true, settings: true },
  });
  if (!c) throw ApiError.notFound('Klinika topilmadi');
  const settings = parseClinicSettings(c.settings);
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    plan: c.plan,
    phone: c.phone,
    kioskKey: canSeeKioskKey(role) ? c.kioskKey : null,
    settings: { queue: settings.queue },
  };
}

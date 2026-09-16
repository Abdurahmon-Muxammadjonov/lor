import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { authOptions } from './options';
import { can, type Permission } from '@/lib/permissions';

export type SessionUser = {
  id: string;
  login: string;
  fullName: string;
  role: Role;
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  room?: string | null;
  color?: string;
};

/** Server komponentlar / route handlerlar uchun joriy foydalanuvchi (yoki null) */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id || !u.role) return null;
  return {
    id: u.id,
    login: u.login,
    fullName: u.fullName,
    role: u.role,
    clinicId: u.clinicId,
    clinicName: u.clinicName,
    clinicSlug: u.clinicSlug,
    room: u.room,
    color: u.color,
  };
}

/** Server komponentlar uchun: kirmagan boʻlsa /login ga, ruxsat boʻlmasa /dashboard ga */
export async function requireUser(permission?: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (permission && !can(user.role, permission)) redirect('/dashboard?denied=1');
  return user;
}

import type { Session } from 'next-auth';

export type SessionUserShape = Session['user'];

/** Test sessiyasi uchun standart foydalanuvchi (ADMIN, clinic_test) */
export const TEST_USER: SessionUserShape = {
  id: 'user_test',
  login: 'admin',
  fullName: 'Test Admin',
  role: 'ADMIN',
  clinicId: 'clinic_test',
  clinicName: 'Test klinika',
  clinicSlug: 'test',
  room: '101',
  color: '#00D4FF',
  name: 'Test Admin',
  email: 'admin@test.local',
  image: null,
};

/**
 * next-auth Session koʻrinishidagi obyekt. `getServerSession` mocki uchun:
 *
 *   vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
 *   vi.mocked(getServerSession).mockResolvedValue(mockSession({ role: 'DOCTOR' }));
 */
export function mockSession(user: Partial<SessionUserShape> = {}, expiresInMs = 60 * 60 * 1000): Session {
  const merged: SessionUserShape = { ...TEST_USER, ...user };
  if (user.fullName && !user.name) merged.name = user.fullName;
  return {
    user: merged,
    expires: new Date(Date.now() + expiresInMs).toISOString(),
  };
}

/** Rol boʻyicha tez sessiya: mockSession({ role }) qisqartmasi */
export const sessionFor = (role: SessionUserShape['role'], extra: Partial<SessionUserShape> = {}): Session =>
  mockSession({ role, id: `user_${role.toLowerCase()}`, login: role.toLowerCase(), ...extra });

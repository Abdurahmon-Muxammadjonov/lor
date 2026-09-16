import type { Role } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      login: string;
      fullName: string;
      role: Role;
      clinicId: string;
      clinicName: string;
      clinicSlug: string;
      room?: string | null;
      color?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    login: string;
    fullName: string;
    role: Role;
    clinicId: string;
    clinicName: string;
    clinicSlug: string;
    room?: string | null;
    color?: string;
    sessionVersion: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    login: string;
    fullName: string;
    role: Role;
    clinicId: string;
    clinicName: string;
    clinicSlug: string;
    room?: string | null;
    color?: string;
    sessionVersion: number;
    /** Oxirgi DB tekshiruvi (unix ms) — sessionVersion / isActive uchun */
    checkedAt: number;
    /** Token yaratilgan vaqt (unix ms) — refresh (rotation) uchun */
    issuedAt: number;
  }
}

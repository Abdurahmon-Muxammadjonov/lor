import type { Role } from '@prisma/client';

/**
 * Rol → ruxsatlar matritsasi. Server tomonda (API) va UI da bir xil manba.
 * SUPER_ADMIN hamma narsaga ruxsatli.
 */
export const PERMISSIONS = {
  'dashboard.view': ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'],
  'queue.view': ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'],
  'queue.manage': ['ADMIN', 'RECEPTION'],
  'queue.call': ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'],
  'patients.view': ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'],
  'patients.write': ['ADMIN', 'DOCTOR', 'RECEPTION'],
  'patients.delete': ['ADMIN'],
  'visits.view': ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'],
  'visits.write': ['ADMIN', 'DOCTOR'],
  'visits.create': ['ADMIN', 'DOCTOR', 'RECEPTION'],
  'appointments.view': ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'],
  'appointments.write': ['ADMIN', 'RECEPTION', 'DOCTOR'],
  'payments.view': ['ADMIN', 'CASHIER', 'RECEPTION', 'DOCTOR'],
  'payments.write': ['ADMIN', 'CASHIER'],
  'payments.refund': ['ADMIN', 'CASHIER'],
  'shifts.manage': ['ADMIN', 'CASHIER'],
  'services.view': ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'],
  'services.write': ['ADMIN'],
  'staff.view': ['ADMIN', 'RECEPTION', 'DOCTOR', 'CASHIER'],
  'staff.write': ['ADMIN'],
  'reports.view': ['ADMIN', 'CASHIER'],
  'reports.full': ['ADMIN'],
  'settings.view': ['ADMIN'],
  'settings.write': ['ADMIN'],
  'audit.view': ['ADMIN'],
  'clinics.manage': [],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function canAny(role: Role | undefined | null, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'];
export const CLINIC_ROLES: Role[] = ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'];

/** Rol uchun dashboard boshlangʻich sahifasi */
export function homeForRole(role: Role): string {
  switch (role) {
    case 'DOCTOR':
      return '/dashboard/queue';
    case 'RECEPTION':
      return '/dashboard/queue';
    case 'CASHIER':
      return '/dashboard/cashier';
    default:
      return '/dashboard';
  }
}

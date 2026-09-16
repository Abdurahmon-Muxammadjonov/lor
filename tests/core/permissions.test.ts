import { describe, it, expect } from 'vitest';
import type { Role } from '@prisma/client';
import { PERMISSIONS, can, canAny, homeForRole, ALL_ROLES, CLINIC_ROLES, type Permission } from '@/lib/permissions';

describe('permissions: can()', () => {
  it('DOCTOR services.write va settings.write ga ega EMAS', () => {
    expect(can('DOCTOR', 'services.write')).toBe(false);
    expect(can('DOCTOR', 'settings.write')).toBe(false);
    expect(can('DOCTOR', 'settings.view')).toBe(false);
    expect(can('DOCTOR', 'staff.write')).toBe(false);
    expect(can('DOCTOR', 'patients.delete')).toBe(false);
    expect(can('DOCTOR', 'payments.write')).toBe(false);
  });

  it('DOCTOR qabul/bemor bilan ishlay oladi', () => {
    expect(can('DOCTOR', 'visits.write')).toBe(true);
    expect(can('DOCTOR', 'visits.create')).toBe(true);
    expect(can('DOCTOR', 'patients.write')).toBe(true);
    expect(can('DOCTOR', 'services.view')).toBe(true);
    expect(can('DOCTOR', 'queue.call')).toBe(true);
  });

  it('ADMIN services.write va settings.write ga ega', () => {
    expect(can('ADMIN', 'services.write')).toBe(true);
    expect(can('ADMIN', 'settings.write')).toBe(true);
    expect(can('ADMIN', 'staff.write')).toBe(true);
    expect(can('ADMIN', 'reports.full')).toBe(true);
    expect(can('ADMIN', 'audit.view')).toBe(true);
  });

  it('ADMIN clinics.manage ga ega emas (faqat SUPER_ADMIN)', () => {
    expect(can('ADMIN', 'clinics.manage')).toBe(false);
    expect(can('SUPER_ADMIN', 'clinics.manage')).toBe(true);
    expect(PERMISSIONS['clinics.manage']).toHaveLength(0);
  });

  it('SUPER_ADMIN hamma narsaga ruxsatli', () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) {
      expect(can('SUPER_ADMIN', p)).toBe(true);
    }
  });

  it('CASHIER payments.write ga ega, visits.write ga EMAS', () => {
    expect(can('CASHIER', 'payments.write')).toBe(true);
    expect(can('CASHIER', 'payments.refund')).toBe(true);
    expect(can('CASHIER', 'shifts.manage')).toBe(true);
    expect(can('CASHIER', 'visits.write')).toBe(false);
    expect(can('CASHIER', 'visits.create')).toBe(false);
    expect(can('CASHIER', 'patients.write')).toBe(false);
    expect(can('CASHIER', 'services.write')).toBe(false);
  });

  it('RECEPTION navbat/bemor/yozilish, lekin toʻlov va hisobot yoʻq', () => {
    expect(can('RECEPTION', 'queue.manage')).toBe(true);
    expect(can('RECEPTION', 'patients.write')).toBe(true);
    expect(can('RECEPTION', 'appointments.write')).toBe(true);
    expect(can('RECEPTION', 'visits.create')).toBe(true);
    expect(can('RECEPTION', 'visits.write')).toBe(false);
    expect(can('RECEPTION', 'payments.write')).toBe(false);
    expect(can('RECEPTION', 'reports.view')).toBe(false);
  });

  it('rol yoʻq (null/undefined) → false', () => {
    expect(can(null, 'dashboard.view')).toBe(false);
    expect(can(undefined, 'dashboard.view')).toBe(false);
  });

  it('barcha klinika rollari dashboard.view ga ega', () => {
    for (const r of CLINIC_ROLES) expect(can(r, 'dashboard.view')).toBe(true);
  });
});

describe('permissions: canAny()', () => {
  it('birontasi boʻlsa true', () => {
    expect(canAny('CASHIER', ['visits.write', 'payments.write'])).toBe(true);
    expect(canAny('DOCTOR', ['services.write', 'settings.write'])).toBe(false);
    expect(canAny('DOCTOR', [])).toBe(false);
    expect(canAny(null, ['dashboard.view'])).toBe(false);
  });
});

describe('permissions: matritsa yaxlitligi', () => {
  it('matritsadagi barcha rollar haqiqiy Role', () => {
    const valid = new Set<Role>(ALL_ROLES);
    for (const roles of Object.values(PERMISSIONS)) {
      for (const r of roles) expect(valid.has(r)).toBe(true);
    }
  });

  it('ALL_ROLES = CLINIC_ROLES + SUPER_ADMIN', () => {
    expect(ALL_ROLES).toHaveLength(5);
    expect(ALL_ROLES).toContain('SUPER_ADMIN');
    expect(CLINIC_ROLES).not.toContain('SUPER_ADMIN');
    for (const r of CLINIC_ROLES) expect(ALL_ROLES).toContain(r);
  });
});

describe('permissions: homeForRole()', () => {
  it('DOCTOR va RECEPTION → /dashboard/queue', () => {
    expect(homeForRole('DOCTOR')).toBe('/dashboard/queue');
    expect(homeForRole('RECEPTION')).toBe('/dashboard/queue');
  });

  it('CASHIER → /dashboard/cashier', () => {
    expect(homeForRole('CASHIER')).toBe('/dashboard/cashier');
  });

  it('ADMIN va SUPER_ADMIN → /dashboard', () => {
    expect(homeForRole('ADMIN')).toBe('/dashboard');
    expect(homeForRole('SUPER_ADMIN')).toBe('/dashboard');
  });
});

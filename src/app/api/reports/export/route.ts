import { withAuth, parseQuery } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { ExportQuerySchema } from '@/lib/reports/schemas';
import { assertReportAccess, requestLocale } from '@/lib/reports/api';
import { buildWorkbook, exportFileName, type WorkbookMeta } from '@/lib/reports/excel';
import { debtors, doctors, full, medicine, patientTypes, revenue, services, shifts } from '@/lib/reports/queries';
import type { ReportKind } from '@/lib/reports/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * GET /api/reports/export?kind=revenue|doctors|services|patient-types|medicine|shifts|debtors|full&from&to&groupBy&doctorId&all
 * → .xlsx (Content-Disposition: ASCII + UTF-8 fayl nomi). Ruxsat: reports.view; doctors/full — reports.full; CASHIER — cheklangan.
 */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  const q = parseQuery(req, ExportQuerySchema);
  assertReportAccess(user.role, q.kind);
  const locale = requestLocale(req);

  const [clinic, doctor] = await Promise.all([
    prisma.clinic.findFirst({ where: { id: clinicId }, select: { name: true } }),
    q.doctorId ? prisma.user.findFirst({ where: { id: q.doctorId, clinicId }, select: { fullName: true } }) : Promise.resolve(null),
  ]);
  const meta: WorkbookMeta = {
    clinicName: clinic?.name ?? user.clinicName,
    locale,
    range: { from: q.from, to: q.to },
    groupBy: q.groupBy,
    doctorName: doctor?.fullName ?? null,
    generatedAt: new Date(),
  };

  const buffer = await buildFor(q.kind, clinicId, q, meta);
  const name = exportFileName(q.kind, meta.range, locale);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Length': String(buffer.byteLength),
      'Content-Disposition': `attachment; filename="${name.ascii}"; filename*=UTF-8''${encodeURIComponent(name.utf8)}`,
      'Cache-Control': 'no-store',
    },
  });
});

async function buildFor(
  kind: ReportKind,
  clinicId: string,
  q: { from: string; to: string; doctorId: string | null; groupBy: 'day' | 'week' | 'month'; all: boolean },
  meta: WorkbookMeta,
): Promise<Buffer> {
  const filters = { from: q.from, to: q.to, doctorId: q.doctorId };
  switch (kind) {
    case 'revenue':
      return buildWorkbook('revenue', await revenue(clinicId, filters, q.groupBy), meta);
    case 'doctors':
      return buildWorkbook('doctors', await doctors(clinicId, filters), meta);
    case 'services':
      return buildWorkbook('services', await services(clinicId, filters), meta);
    case 'patient-types':
      return buildWorkbook('patient-types', await patientTypes(clinicId, filters, q.groupBy), meta);
    case 'medicine':
      return buildWorkbook('medicine', await medicine(clinicId, filters), meta);
    case 'shifts':
      return buildWorkbook('shifts', await shifts(clinicId, filters), meta);
    case 'debtors':
      return buildWorkbook('debtors', await debtors(clinicId, filters, q.all), meta);
    case 'full':
      return buildWorkbook('full', await full(clinicId, filters, q.groupBy, q.all), meta);
  }
}

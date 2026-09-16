import { createServer, type AddressInfo, type Server } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// DATABASE_URL berilmagan boʻlsa — lokal .env dan olishga urinamiz (faqat DB kalitlari)
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*"?([^"]*)"?\s*$/.exec(line);
      if (m && m[1] && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const HAS_DB = !!process.env.DATABASE_URL;

import { prisma } from '@/lib/prisma';
import { parseClinicSettings } from '@/lib/settings/types';
import { bytesToBase64 } from '@/lib/printer/base64';
import { loadClinicPrinterSettings, printerErrorToApiError, sendRawToClinicPrinter } from '@/lib/printer/print-server';
import { PrinterError } from '@/lib/printer/errors';

const MARK = 'printer-test-clinic';

(HAS_DB ? describe : describe.skip)('print-server (DB)', () => {
  let server: Server;
  let port = 0;
  let clinicId = '';
  const received: Buffer[] = [];

  beforeAll(async () => {
    server = createServer((socket) => {
      socket.on('data', (chunk) => received.push(Buffer.from(chunk)));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;

    await prisma.clinic.deleteMany({ where: { slug: MARK } });
    const clinic = await prisma.clinic.create({
      data: {
        name: 'Printer Test Clinic',
        slug: MARK,
        phone: '+998 71 000 00 00',
        settings: parseClinicSettings({ printer: { transport: 'NETWORK', host: '127.0.0.1', port, paperWidth: 80 } }),
      },
      select: { id: true },
    });
    clinicId = clinic.id;
  });

  afterAll(async () => {
    if (clinicId) await prisma.clinic.deleteMany({ where: { id: clinicId } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  it('loads printer settings with defaults from Clinic.settings', async () => {
    const s = await loadClinicPrinterSettings(clinicId);
    expect(s).toMatchObject({ transport: 'NETWORK', host: '127.0.0.1', port, paperWidth: 80, codepage: 'CP866', cut: true });
    const demo = await prisma.clinic.findFirst({ where: { slug: 'demo' }, select: { id: true } });
    if (demo) {
      const d = await loadClinicPrinterSettings(demo.id);
      expect(d.transport).toBe('BROWSER');
      expect(d.host).toBe('');
    }
  });

  it('sends base64 bytes to the clinic printer host:port', async () => {
    const bytes = new Uint8Array([0x1b, 0x40, 0x48, 0x69, 0x0a, 0x1d, 0x56, 0x42, 0x00]);
    const r = await sendRawToClinicPrinter(clinicId, bytesToBase64(bytes), 3000);
    expect(r.sent).toBe(bytes.length);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(Array.from(Buffer.concat(received))).toEqual(Array.from(bytes));
  });

  it('rejects when the clinic has no printer host, and maps errors to ApiError(PRINTER_ERROR)', async () => {
    await prisma.clinic.update({
      where: { id: clinicId },
      data: { settings: parseClinicSettings({ printer: { transport: 'NETWORK', host: '' } }) },
    });
    await expect(sendRawToClinicPrinter(clinicId, bytesToBase64(new Uint8Array([1])))).rejects.toMatchObject({
      code: 'NETWORK_NOT_CONFIGURED',
    });
    const api = printerErrorToApiError(new PrinterError('NETWORK_TIMEOUT', 'slow'));
    expect(api).toMatchObject({ status: 504, code: 'PRINTER_ERROR', message: 'slow', details: { code: 'NETWORK_TIMEOUT' } });
    expect(printerErrorToApiError(new Error('x'))).toMatchObject({ status: 502, code: 'PRINTER_ERROR' });
    await expect(loadClinicPrinterSettings('nope-' + MARK)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

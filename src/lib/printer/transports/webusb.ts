import { hydratePrinterStore, usePrinterStore } from '@/stores/use-printer-store';
import { PrinterError, toPrinterError } from '../errors';

/**
 * WebUSB transport — Chrome/Edge da printerga toʻgʻridan-toʻgʻri (drayversiz) yozish.
 *
 * Oqim: `requestDevice()` (foydalanuvchi bosishi bilan, bir marta — sozlamalar sahifasida) →
 * brauzer ruxsatni eslab qoladi → keyingi safar `navigator.usb.getDevices()` orqali topiladi.
 * `write()` bulk OUT endpointga boʻlaklab yozadi. Qurilma ochiq holda saqlanadi (`shared()` singleton).
 *
 * Eslatma: Windows da printerga "usbprint"/"WinUSB" drayveri bogʻlangan boʻlsa `claimInterface` xato beradi —
 * Zadig bilan WinUSB oʻrnatish yoki QZ/NETWORK transportini tanlash kerak.
 */

/** Keng tarqalgan ESC/POS printer ishlab chiqaruvchilari (vendorId) */
export const ESCPOS_VENDOR_IDS: ReadonlyArray<{ vendorId: number; name: string }> = [
  { vendorId: 0x04b8, name: 'Epson' },
  { vendorId: 0x0416, name: 'Winbond / Xprinter' },
  { vendorId: 0x0483, name: 'STMicroelectronics (Xprinter, Rongta)' },
  { vendorId: 0x1fc9, name: 'NXP' },
  { vendorId: 0x0dd4, name: 'Custom / Sewoo' },
  { vendorId: 0x28e9, name: 'GPrinter' },
  { vendorId: 0x0525, name: 'Netchip (generic)' },
  { vendorId: 0x1504, name: 'Bixolon' },
  { vendorId: 0x067b, name: 'Prolific (USB-serial)' },
  { vendorId: 0x0519, name: 'Star Micronics' },
  { vendorId: 0x154f, name: 'SNBC' },
  { vendorId: 0x20d1, name: 'Rongta' },
  { vendorId: 0x6868, name: 'Zjiang' },
];

const USB_CLASS_PRINTER = 7;

export interface WebUsbWriteOptions {
  /** Har bir transferOut boʻlagi (64 B … 16 KB, default 4096) */
  chunkSize?: number;
}

interface Endpoint {
  interfaceNumber: number;
  alternateSetting: number;
  endpointNumber: number;
  packetSize: number;
}

function usbApi(): USB {
  if (typeof navigator === 'undefined') throw new PrinterError('NOT_IN_BROWSER');
  const usb = navigator.usb;
  if (!usb) throw new PrinterError('WEBUSB_UNSUPPORTED');
  return usb;
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

export function deviceLabel(d: USBDevice): string {
  const vendor = ESCPOS_VENDOR_IDS.find((v) => v.vendorId === d.vendorId)?.name;
  const name = [d.manufacturerName, d.productName].filter(Boolean).join(' ').trim();
  if (name) return name;
  const hex = (n: number) => n.toString(16).padStart(4, '0');
  return `${vendor ?? 'USB'} ${hex(d.vendorId)}:${hex(d.productId)}`;
}

/** Bulk OUT endpointni topish: avval printer klassi (7), keyin har qanday interfeys */
export function findBulkOutEndpoint(device: USBDevice): Endpoint | null {
  const config = device.configuration ?? device.configurations[0];
  if (!config) return null;
  const candidates: Array<Endpoint & { isPrinter: boolean }> = [];
  for (const iface of config.interfaces) {
    for (const alt of iface.alternates) {
      for (const ep of alt.endpoints) {
        if (ep.direction === 'out' && ep.type === 'bulk') {
          candidates.push({
            interfaceNumber: iface.interfaceNumber,
            alternateSetting: alt.alternateSetting,
            endpointNumber: ep.endpointNumber,
            packetSize: ep.packetSize,
            isPrinter: alt.interfaceClass === USB_CLASS_PRINTER,
          });
        }
      }
    }
  }
  const best = candidates.find((c) => c.isPrinter) ?? candidates[0];
  if (!best) return null;
  return {
    interfaceNumber: best.interfaceNumber,
    alternateSetting: best.alternateSetting,
    endpointNumber: best.endpointNumber,
    packetSize: best.packetSize,
  };
}

let sharedInstance: WebUsbTransport | null = null;

export class WebUsbTransport {
  private device: USBDevice | null = null;
  private endpoint: Endpoint | null = null;
  private listening = false;

  static shared(): WebUsbTransport {
    if (!sharedInstance) sharedInstance = new WebUsbTransport();
    return sharedInstance;
  }

  get deviceName(): string | null {
    return this.device ? deviceLabel(this.device) : null;
  }

  get isOpen(): boolean {
    return !!this.device?.opened && !!this.endpoint;
  }

  /**
   * Brauzer qurilma tanlash oynasi (faqat foydalanuvchi harakati — click — ichida chaqiriladi).
   * `any=true` — filtrsiz, barcha USB qurilmalar roʻyxati (printer roʻyxatda chiqmasa).
   * Bekor qilinsa `PrinterError('NO_DEVICE')`.
   */
  async requestDevice(opts: { any?: boolean } = {}): Promise<USBDevice> {
    const usb = usbApi();
    const filters: USBDeviceFilter[] = opts.any
      ? []
      : [...ESCPOS_VENDOR_IDS.map(({ vendorId }) => ({ vendorId })), { classCode: USB_CLASS_PRINTER }];
    hydratePrinterStore();
    let device: USBDevice;
    try {
      device = await usb.requestDevice({ filters });
    } catch (e) {
      throw new PrinterError('NO_DEVICE', e instanceof Error ? e.message : undefined, e);
    }
    await this.close();
    this.device = device;
    this.endpoint = null;
    usePrinterStore.getState().setWebUsbDevice({
      vendorId: device.vendorId,
      productId: device.productId,
      name: deviceLabel(device),
    });
    return device;
  }

  /** Avval ruxsat berilgan qurilmalar ichidan eslab qolinganini (yoki birinchisini) qaytaradi */
  async getRememberedDevice(): Promise<USBDevice | null> {
    const usb = usbApi();
    const devices = await usb.getDevices();
    if (devices.length === 0) return null;
    hydratePrinterStore();
    const remembered = usePrinterStore.getState().webUsbDevice;
    const match = remembered
      ? devices.find((d) => d.vendorId === remembered.vendorId && d.productId === remembered.productId)
      : undefined;
    return match ?? devices[0] ?? null;
  }

  /** Qurilmani ochish, konfiguratsiya tanlash, interfeysni band qilish */
  async open(device?: USBDevice): Promise<void> {
    hydratePrinterStore();
    const target = device ?? this.device ?? (await this.getRememberedDevice());
    if (!target) throw new PrinterError('NO_DEVICE');
    if (this.device && this.device !== target) await this.close();
    this.device = target;
    this.watchDisconnect();
    try {
      if (!target.opened) await target.open();
      if (target.configuration === null) {
        const first = target.configurations[0];
        await target.selectConfiguration(first?.configurationValue ?? 1);
      }
    } catch (e) {
      this.endpoint = null;
      throw new PrinterError('DEVICE_OPEN_FAILED', e instanceof Error ? e.message : undefined, e);
    }
    const ep = findBulkOutEndpoint(target);
    if (!ep) {
      throw new PrinterError('NO_ENDPOINT');
    }
    try {
      const iface = target.configuration?.interfaces.find((i) => i.interfaceNumber === ep.interfaceNumber);
      if (!iface?.claimed) await target.claimInterface(ep.interfaceNumber);
      if (ep.alternateSetting !== 0) await target.selectAlternateInterface(ep.interfaceNumber, ep.alternateSetting);
    } catch (e) {
      throw new PrinterError('DEVICE_OPEN_FAILED', e instanceof Error ? e.message : undefined, e);
    }
    this.endpoint = ep;
    usePrinterStore.getState().setWebUsbDevice({
      vendorId: target.vendorId,
      productId: target.productId,
      name: deviceLabel(target),
    });
  }

  /** Baytlarni boʻlaklab yozish (kerak boʻlsa avval `open()` chaqiradi) */
  async write(bytes: Uint8Array, opts: WebUsbWriteOptions = {}): Promise<void> {
    if (!this.isOpen) await this.open();
    const device = this.device;
    const ep = this.endpoint;
    if (!device || !ep) throw new PrinterError('NO_DEVICE');
    const chunkSize = Math.min(16 * 1024, Math.max(64, opts.chunkSize ?? 4096));
    try {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        const result = await device.transferOut(ep.endpointNumber, chunk);
        if (result.status !== 'ok') {
          throw new PrinterError('WRITE_FAILED', `transferOut status: ${result.status}`);
        }
        if (result.bytesWritten !== chunk.length) {
          throw new PrinterError('WRITE_FAILED', `short write: ${result.bytesWritten}/${chunk.length}`);
        }
      }
    } catch (e) {
      // Qurilma uzilgan boʻlishi mumkin — keyingi urinishda qayta ochiladi
      if (e instanceof Error && (e.name === 'NetworkError' || e.name === 'NotFoundError')) {
        this.endpoint = null;
      }
      throw toPrinterError(e, 'WRITE_FAILED');
    }
  }

  /** Ochish + yozish (transport interfeysi) */
  async print(bytes: Uint8Array): Promise<void> {
    await this.write(bytes);
  }

  async close(): Promise<void> {
    const device = this.device;
    const ep = this.endpoint;
    this.endpoint = null;
    if (!device) return;
    try {
      if (ep && device.opened) await device.releaseInterface(ep.interfaceNumber);
    } catch {
      // eʼtiborsiz — qurilma allaqachon uzilgan boʻlishi mumkin
    }
    try {
      if (device.opened) await device.close();
    } catch {
      // eʼtiborsiz
    }
  }

  /** Ruxsatni bekor qilish (sozlamalarda "Printerni unutish") */
  async forget(): Promise<void> {
    const device = this.device;
    await this.close();
    this.device = null;
    usePrinterStore.getState().setWebUsbDevice(null);
    if (device && typeof device.forget === 'function') {
      try {
        await device.forget();
      } catch {
        // eski Chrome versiyalarida yoʻq
      }
    }
  }

  private watchDisconnect(): void {
    if (this.listening || typeof navigator === 'undefined' || !navigator.usb) return;
    this.listening = true;
    navigator.usb.addEventListener('disconnect', (ev: USBConnectionEvent) => {
      if (ev.device === this.device) {
        this.endpoint = null;
      }
    });
  }
}

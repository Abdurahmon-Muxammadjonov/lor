import { usePrinterStore } from '@/stores/use-printer-store';
import { bytesToBase64 } from '../base64';
import { PrinterError, errorMessage } from '../errors';

/**
 * QZ Tray transport (https://qz.io) — kompyuterda oʻrnatilgan QZ Tray dasturi orqali istalgan OS printeriga
 * xom ESC/POS baytlar yuborish (Windows drayverlari bilan ishlaydi, WebUSB kerak emas).
 *
 * Kutubxona (`qz-tray.js`, rasmiy npm build) sahifaga runtime da `<script>` sifatida CDN dan ulanadi.
 *
 * IMZOSIZ (unsigned) REJIM: biz sertifikat/imzo bermaymiz, shuning uchun QZ Tray har ulanishda
 * "Untrusted website … allow?" dialogini koʻrsatadi. Administrator bir marta "Remember this decision" ni
 * belgilasa, keyingi ulanishlar soʻrovsiz oʻtadi. Ishlab chiqarishda oʻz sertifikatingizni
 * `setCertificate(pem, signer)` orqali bersangiz dialog chiqmaydi (imzo serverda private key bilan qilinadi).
 */

export const QZ_TRAY_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';

type Resolver<T> = (value: T) => void;
type Rejecter = (reason?: unknown) => void;

export interface QzPrintData {
  type: 'raw';
  format: 'command';
  flavor: 'base64' | 'plain' | 'hex';
  data: string;
}

export interface QzConnectOptions {
  host?: string | string[];
  port?: { secure?: number[]; insecure?: number[] };
  usingSecure?: boolean;
  retries?: number;
  delay?: number;
}

/** qz-tray.js global obyektining biz ishlatadigan qismi */
export interface QzApi {
  websocket: {
    connect(options?: QzConnectOptions): Promise<void>;
    disconnect(): Promise<void>;
    isActive(): boolean;
    setClosedCallbacks(cb: (evt: unknown) => void): void;
    setErrorCallbacks(cb: (evt: unknown) => void): void;
  };
  security: {
    setCertificatePromise(fn: (resolve: Resolver<string>, reject: Rejecter) => void): void;
    setSignaturePromise(fn: (toSign: string) => (resolve: Resolver<string | undefined>, reject: Rejecter) => void): void;
    setSignatureAlgorithm(alg: 'SHA1' | 'SHA256' | 'SHA512'): void;
  };
  printers: {
    find(query?: string): Promise<string | string[]>;
    getDefault(): Promise<string | null>;
  };
  configs: {
    create(printer: string | { name: string }, options?: Record<string, unknown>): unknown;
  };
  print(config: unknown, data: QzPrintData[]): Promise<void>;
  api: { setPromiseType?(fn: unknown): void };
}

function getQzGlobal(): QzApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { qz?: QzApi }).qz;
}

let loadPromise: Promise<QzApi> | null = null;
let sharedInstance: QzTransport | null = null;

/** qz-tray.js ni bir marta yuklaydi (script tag) */
export function loadQzTray(scriptUrl = QZ_TRAY_SCRIPT_URL): Promise<QzApi> {
  const existing = getQzGlobal();
  if (existing) return Promise.resolve(existing);
  if (loadPromise) return loadPromise;
  if (typeof document === 'undefined') return Promise.reject(new PrinterError('NOT_IN_BROWSER'));
  loadPromise = new Promise<QzApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.qzTray = '1';
    script.onload = () => {
      const qz = getQzGlobal();
      if (qz) resolve(qz);
      else reject(new PrinterError('QZ_LOAD_FAILED', 'window.qz is not defined after load'));
    };
    script.onerror = () => {
      script.remove();
      loadPromise = null;
      reject(new PrinterError('QZ_LOAD_FAILED', `failed to load ${scriptUrl}`));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export interface QzCertificate {
  /** PEM sertifikat (digital-certificate.txt) */
  pem: string;
  /** Imzolovchi — odatda serverga soʻrov: (toSign) => Promise<base64 imzo> */
  signer: (toSign: string) => Promise<string>;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
}

export class QzTransport {
  private qz: QzApi | null = null;
  private securityApplied = false;
  private certificate: QzCertificate | null = null;

  static shared(): QzTransport {
    if (!sharedInstance) sharedInstance = new QzTransport();
    return sharedInstance;
  }

  /** Ishlab chiqarish uchun imzolangan rejim (ixtiyoriy). `connect()` dan oldin chaqiriladi. */
  setCertificate(cert: QzCertificate | null): void {
    this.certificate = cert;
    this.securityApplied = false;
  }

  get isConnected(): boolean {
    return !!this.qz?.websocket.isActive();
  }

  async load(): Promise<QzApi> {
    if (!this.qz) this.qz = await loadQzTray();
    return this.qz;
  }

  private applySecurity(qz: QzApi): void {
    if (this.securityApplied) return;
    const cert = this.certificate;
    if (cert) {
      qz.security.setCertificatePromise((resolve) => resolve(cert.pem));
      qz.security.setSignatureAlgorithm(cert.algorithm ?? 'SHA512');
      qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
        cert.signer(toSign).then(resolve, reject);
      });
    } else {
      // Imzosiz rejim: sertifikat yoʻq (reject → QZ "untrusted" dialog), imzo boʻsh
      qz.security.setCertificatePromise((_resolve, reject) => reject(new Error('unsigned mode')));
      qz.security.setSignatureAlgorithm('SHA512');
      qz.security.setSignaturePromise(() => (resolve) => resolve(undefined));
    }
    qz.websocket.setClosedCallbacks(() => usePrinterStore.getState().setQzConnected(false));
    qz.websocket.setErrorCallbacks(() => usePrinterStore.getState().setQzConnected(false));
    this.securityApplied = true;
  }

  /** Kutubxonani yuklab, QZ Tray websocketiga ulanadi (allaqachon ulangan boʻlsa — hech narsa) */
  async connect(options: QzConnectOptions = {}): Promise<QzApi> {
    let qz: QzApi;
    try {
      qz = await this.load();
    } catch (e) {
      usePrinterStore.getState().setQzConnected(false);
      throw e instanceof PrinterError ? e : new PrinterError('QZ_LOAD_FAILED', errorMessage(e), e);
    }
    this.applySecurity(qz);
    if (!qz.websocket.isActive()) {
      try {
        await qz.websocket.connect({ retries: 1, delay: 1, ...options });
      } catch (e) {
        usePrinterStore.getState().setQzConnected(false);
        throw new PrinterError('QZ_CONNECT_FAILED', errorMessage(e), e);
      }
    }
    usePrinterStore.getState().setQzConnected(true);
    return qz;
  }

  async listPrinters(): Promise<string[]> {
    const qz = await this.connect();
    try {
      const found = await qz.printers.find();
      const list = Array.isArray(found) ? found : found ? [found] : [];
      usePrinterStore.getState().setQzPrinters(list);
      return list;
    } catch (e) {
      throw new PrinterError('QZ_PRINTER_NOT_FOUND', errorMessage(e), e);
    }
  }

  /** Nomi boʻyicha (qisman mos ham) yoki standart printerni topadi */
  async resolvePrinter(name: string): Promise<string> {
    const qz = await this.connect();
    const wanted = name.trim();
    try {
      if (wanted) {
        const found = await qz.printers.find(wanted);
        const first = Array.isArray(found) ? found[0] : found;
        if (first) return first;
        throw new Error(`printer "${wanted}" not found`);
      }
      const def = await qz.printers.getDefault();
      if (def) return def;
      throw new Error('no default printer');
    } catch (e) {
      throw new PrinterError('QZ_PRINTER_NOT_FOUND', errorMessage(e), e);
    }
  }

  /** Xom ESC/POS baytlarni chop etish */
  async print(bytes: Uint8Array, printerName = ''): Promise<void> {
    const qz = await this.connect();
    const printer = await this.resolvePrinter(printerName);
    const config = qz.configs.create(printer);
    const data: QzPrintData[] = [{ type: 'raw', format: 'command', flavor: 'base64', data: bytesToBase64(bytes) }];
    try {
      await qz.print(config, data);
    } catch (e) {
      throw new PrinterError('QZ_PRINT_FAILED', errorMessage(e), e);
    }
  }

  async disconnect(): Promise<void> {
    const qz = this.qz;
    if (qz?.websocket.isActive()) {
      try {
        await qz.websocket.disconnect();
      } catch {
        // eʼtiborsiz
      }
    }
    usePrinterStore.getState().setQzConnected(false);
  }
}

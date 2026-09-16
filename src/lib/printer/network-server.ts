import { Socket } from 'node:net';
import { PrinterError } from './errors';

/**
 * Tarmoq (Ethernet/Wi-Fi) termal printerga xom ESC/POS baytlarni TCP orqali yuborish (odatda 9100-port, "RAW/JetDirect").
 * FAQAT SERVERDA (`node:net`) — `POST /api/print/raw` route-i ([queue] moduli) shu funksiyani chaqiradi.
 * Client komponentlardan yoki `index.ts` barrel dan import QILMANG (Node moduli brauzer bundle ga tushmaydi).
 *
 * Xatolar `PrinterError` bilan: NETWORK_NOT_CONFIGURED (host boʻsh/notoʻgʻri), NETWORK_TIMEOUT, NETWORK_FAILED.
 * Ulanish + yozish + yopish `timeoutMs` ichida tugamasa socket uziladi.
 */

const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** IP manzil yoki host nomi toʻgʻri koʻrinishdami (boʻsh joylar, sxema, port yoʻq) */
export function isValidPrinterHost(host: string): boolean {
  const h = host.trim();
  if (!h) return false;
  if (IPV4_RE.test(h)) return true;
  if (/^[\d.]+$/.test(h)) return false; // raqamli, lekin IPv4 emas ("999.1.1.1")
  // IPv6 (qavssiz) — faqat hex va ':'
  if (/^[0-9A-Fa-f:]+$/.test(h) && h.includes(':')) return true;
  return HOSTNAME_RE.test(h);
}

export function isValidPrinterPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export interface SendToNetworkPrinterResult {
  /** Yuborilgan baytlar */
  sent: number;
  /** Ulanishdan yopilishgacha (ms) */
  elapsedMs: number;
}

/**
 * `host:port` ga ulanib, `bytes` ni yozadi va socketni yopadi.
 * `timeoutMs` (default 5000) — butun operatsiya uchun umumiy chegara.
 */
export function sendToNetworkPrinter(
  host: string,
  port: number,
  bytes: Uint8Array,
  timeoutMs = 5000,
): Promise<SendToNetworkPrinterResult> {
  const target = host.trim();
  if (!isValidPrinterHost(target)) {
    return Promise.reject(new PrinterError('NETWORK_NOT_CONFIGURED', `invalid printer host "${host}"`));
  }
  if (!isValidPrinterPort(port)) {
    return Promise.reject(new PrinterError('NETWORK_NOT_CONFIGURED', `invalid printer port ${port}`));
  }
  const limit = Math.max(500, Math.floor(timeoutMs));
  const started = Date.now();

  return new Promise<SendToNetworkPrinterResult>((resolve, reject) => {
    const socket = new Socket();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (err: PrinterError | null): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      socket.removeAllListeners();
      socket.on('error', () => undefined); // yopilish paytidagi kech xatolar
      socket.destroy();
      if (err) reject(err);
      else resolve({ sent: bytes.length, elapsedMs: Date.now() - started });
    };

    timer = setTimeout(() => {
      finish(new PrinterError('NETWORK_TIMEOUT', `printer ${target}:${port} did not respond within ${limit} ms`));
    }, limit);

    socket.setNoDelay(true);
    socket.once('error', (e: NodeJS.ErrnoException) => {
      const code = e.code ?? '';
      if (code === 'ETIMEDOUT') {
        finish(new PrinterError('NETWORK_TIMEOUT', e.message, e));
      } else {
        finish(new PrinterError('NETWORK_FAILED', code ? `${code}: ${e.message}` : e.message, e));
      }
    });
    socket.once('close', (hadError: boolean) => {
      if (!settled) finish(hadError ? new PrinterError('NETWORK_FAILED', 'connection closed with error') : null);
    });

    socket.connect({ host: target, port }, () => {
      if (bytes.length === 0) {
        socket.end();
        return;
      }
      // Buffer.from(bytes.buffer, offset, length) — nusxasiz koʻrinish
      const payload = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      socket.write(payload, (err) => {
        if (err) {
          finish(new PrinterError('NETWORK_FAILED', err.message, err));
          return;
        }
        // Yozildi — printer javob bermaydi, shunchaki yopamiz ('close' → resolve)
        socket.end();
      });
    });
  });
}

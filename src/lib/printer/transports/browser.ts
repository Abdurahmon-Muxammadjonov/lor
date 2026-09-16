import { PrinterError, errorMessage } from '../errors';

/**
 * BROWSER transport — zaxira (fallback) va termal printersiz klinikalar uchun.
 * Berilgan `/print/ticket/[id]` yoki `/print/receipt/[visitId]` sahifasini yashirin <iframe> da ochadi,
 * yuklanishini kutadi, `contentWindow.print()` ni chaqiradi va `afterprint` (yoki zaxira taymer) dan soʻng
 * iframe ni olib tashlaydi. Bir vaqtda faqat bitta chop etish oynasi ochiladi (navbat bilan).
 *
 * Eslatma: brauzer chop etish dialogi modal — `print()` qaytguncha JS toʻxtaydi (Chrome), Safari da darhol qaytadi.
 * Shuning uchun `afterprint` ga tayanamiz, lekin uni har doim ham yubormaydi — `cleanupDelayMs` zaxira.
 */

export interface BrowserPrintOptions {
  /** Sahifa yuklanishini kutish (default 15 000 ms) */
  loadTimeoutMs?: number;
  /** `afterprint` kelmasa iframe ni olib tashlash (default 60 000 ms) */
  cleanupDelayMs?: number;
  /** Sahifa `load` dan keyin shriftlar/rasmlar uchun qisqa pauza (default 150 ms) */
  settleMs?: number;
}

const FRAME_ATTR = 'data-lor-print-frame';

function isSameOrigin(url: string): boolean {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

let queue: Promise<void> = Promise.resolve();

export class BrowserPrintTransport {
  constructor(private readonly options: BrowserPrintOptions = {}) {}

  /**
   * `url` ni yashirin iframe da ochib chop etadi. Muvaffaqiyat = print() chaqirildi.
   * Xatolar: NOT_IN_BROWSER, NO_FALLBACK_URL, BROWSER_TIMEOUT (yuklanmadi), BROWSER_FAILED.
   */
  async openPrintWindow(url: string): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') throw new PrinterError('NOT_IN_BROWSER');
    if (!url || !url.trim()) throw new PrinterError('NO_FALLBACK_URL');
    if (!isSameOrigin(url)) throw new PrinterError('BROWSER_FAILED', 'print page must be same-origin');
    const run = () => this.printInFrame(url.trim());
    // Ketma-ket: oldingi chop etish tugaguncha kutamiz (dialoglar ustma-ust tushmasin)
    const task = queue.then(run, run);
    queue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  /** Transport interfeysi bilan bir xil nom */
  async print(url: string): Promise<void> {
    return this.openPrintWindow(url);
  }

  private printInFrame(url: string): Promise<void> {
    const loadTimeoutMs = this.options.loadTimeoutMs ?? 15_000;
    const cleanupDelayMs = this.options.cleanupDelayMs ?? 60_000;
    const settleMs = this.options.settleMs ?? 150;

    return new Promise<void>((resolve, reject) => {
      // Eski qolib ketgan freymlarni tozalash
      document.querySelectorAll<HTMLIFrameElement>(`iframe[${FRAME_ATTR}]`).forEach((f) => f.remove());

      const frame = document.createElement('iframe');
      frame.setAttribute(FRAME_ATTR, '1');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('title', 'print');
      frame.tabIndex = -1;
      Object.assign(frame.style, {
        position: 'fixed',
        right: '0',
        bottom: '0',
        width: '0',
        height: '0',
        border: '0',
        opacity: '0',
        pointerEvents: 'none',
      } satisfies Partial<CSSStyleDeclaration>);

      let done = false;
      let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
      const cleanup = (): void => {
        if (cleanupTimer) clearTimeout(cleanupTimer);
        cleanupTimer = null;
        frame.remove();
      };
      const fail = (err: PrinterError): void => {
        if (done) return;
        done = true;
        clearTimeout(loadTimer);
        cleanup();
        reject(err);
      };

      const loadTimer = setTimeout(() => {
        fail(new PrinterError('BROWSER_TIMEOUT', `print page did not load within ${loadTimeoutMs} ms: ${url}`));
      }, loadTimeoutMs);

      frame.addEventListener('load', () => {
        if (done) return;
        clearTimeout(loadTimer);
        const win = frame.contentWindow;
        if (!win) {
          fail(new PrinterError('BROWSER_FAILED', 'iframe has no contentWindow'));
          return;
        }
        // Sahifa haqiqatan yuklandimi (about:blank emas, 404 emas)?
        let title = '';
        try {
          title = win.document.title;
          if (win.location.href === 'about:blank') {
            fail(new PrinterError('BROWSER_FAILED', 'print page is blank'));
            return;
          }
        } catch {
          // cross-origin boʻlishi mumkin emas (tekshirilgan), lekin ehtiyot
        }
        if (/^404/.test(title) || /not found/i.test(title)) {
          fail(new PrinterError('BROWSER_FAILED', `print page not found: ${url}`));
          return;
        }

        const onAfterPrint = (): void => {
          win.removeEventListener('afterprint', onAfterPrint);
          cleanup();
        };
        win.addEventListener('afterprint', onAfterPrint);
        cleanupTimer = setTimeout(() => {
          win.removeEventListener('afterprint', onAfterPrint);
          cleanup();
        }, cleanupDelayMs);

        setTimeout(() => {
          if (done) return;
          try {
            win.focus();
            win.print();
            done = true;
            resolve();
          } catch (e) {
            fail(new PrinterError('BROWSER_FAILED', errorMessage(e), e));
          }
        }, settleMs);
      });

      frame.addEventListener('error', () => {
        fail(new PrinterError('BROWSER_FAILED', `failed to load ${url}`));
      });

      try {
        frame.src = url;
        document.body.appendChild(frame);
      } catch (e) {
        fail(new PrinterError('BROWSER_FAILED', errorMessage(e), e));
      }
    });
  }
}

/** Qisqa yordamchi */
export function printInBrowser(url: string, options?: BrowserPrintOptions): Promise<void> {
  return new BrowserPrintTransport(options).openPrintWindow(url);
}

/**
 * Bir sahifali hujjatni (masalan /print/receipt/[visitId]) yashirin iframe orqali chop etish.
 * Bir xil domen boʻlgani uchun `contentWindow.print()` ishlaydi; yuklanmasa/xato boʻlsa — rad etiladi,
 * chaqiruvchi hujjatni yangi oynada ochishga oʻtadi.
 */
export function printUrlInFrame(url: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('NO_DOCUMENT'));
      return;
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('tabindex', '-1');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';

    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      // Chop etish dialogi yopilgach ramkani olib tashlash uchun kichik kechikish
      window.setTimeout(() => frame.remove(), 60_000);
    };
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve();
    };
    const timer = window.setTimeout(() => {
      frame.remove();
      finish(new Error('PRINT_TIMEOUT'));
    }, timeoutMs);

    frame.onload = () => {
      try {
        const win = frame.contentWindow;
        if (!win) throw new Error('NO_WINDOW');
        // Sahifa "not found"/login sahifasiga yoʻnaltirilgan boʻlsa — chop etmaymiz
        const title = win.document.title.toLowerCase();
        if (title.includes('404') || win.location.pathname.startsWith('/login'))
          throw new Error('PRINT_UNAVAILABLE');
        win.focus();
        win.print();
        finish();
      } catch (e) {
        frame.remove();
        finish(e instanceof Error ? e : new Error('PRINT_FAILED'));
      }
    };
    frame.onerror = () => {
      frame.remove();
      finish(new Error('PRINT_LOAD_FAILED'));
    };
    frame.src = url;
    document.body.appendChild(frame);
  });
}

'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PrinterTransport } from '@/lib/settings/types';

/**
 * Printer holati (brauzer localStorage da saqlanadi, `lor:printer` kaliti).
 * Oxirgi muvaffaqiyatli transport, eslab qolingan WebUSB qurilma, QZ Tray ulanishi.
 * `qzConnected` sessiyaga tegishli — saqlanmaydi (sahifa yangilanganda qayta ulanadi).
 *
 * SSR mosligi: `skipHydration` — server va birinchi client render bir xil (boʻsh) boʻladi.
 * Brauzerda `hydratePrinterStore()` (idempotent, sinxron) yoki `usePrinterStoreHydrated()` hook orqali oʻqiladi;
 * `usePrinter()` / `usePrinterSettings()` va transportlar buni oʻzlari chaqiradi.
 *
 * React tashqarisida: `usePrinterStore.getState().setLastTransportOk('WEBUSB')`.
 */
export interface RememberedUsbDevice {
  vendorId: number;
  productId: number;
  name: string;
}

export interface PrinterStoreState {
  /** Oxirgi muvaffaqiyatli chop etgan transport */
  lastTransportOk: PrinterTransport | null;
  /** ISO vaqt */
  lastPrintAt: string | null;
  /** Oxirgi xato (texnik matn) */
  lastError: string | null;
  /** Foydalanuvchi tanlagan USB printer nomi (koʻrsatish uchun) */
  webUsbDeviceName: string | null;
  /** Bir nechta ruxsat berilgan qurilma ichidan qaysi birini tanlash */
  webUsbDevice: RememberedUsbDevice | null;
  qzConnected: boolean;
  /** QZ Tray da topilgan printerlar (sozlamalar sahifasi uchun) */
  qzPrinters: string[];

  setLastTransportOk: (transport: PrinterTransport) => void;
  setLastError: (error: string | null) => void;
  setWebUsbDevice: (device: RememberedUsbDevice | null) => void;
  setQzConnected: (connected: boolean) => void;
  setQzPrinters: (printers: string[]) => void;
  reset: () => void;
}

const initialState = {
  lastTransportOk: null,
  lastPrintAt: null,
  lastError: null,
  webUsbDeviceName: null,
  webUsbDevice: null,
  qzConnected: false,
  qzPrinters: [],
} satisfies Omit<
  PrinterStoreState,
  'setLastTransportOk' | 'setLastError' | 'setWebUsbDevice' | 'setQzConnected' | 'setQzPrinters' | 'reset'
>;

export const PRINTER_STORE_KEY = 'lor:printer';

export const usePrinterStore = create<PrinterStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      setLastTransportOk: (transport) =>
        set({ lastTransportOk: transport, lastPrintAt: new Date().toISOString(), lastError: null }),
      setLastError: (error) => set({ lastError: error }),
      setWebUsbDevice: (device) => set({ webUsbDevice: device, webUsbDeviceName: device?.name ?? null }),
      setQzConnected: (connected) => set({ qzConnected: connected }),
      setQzPrinters: (printers) => set({ qzPrinters: printers }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: PRINTER_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lastTransportOk: s.lastTransportOk,
        lastPrintAt: s.lastPrintAt,
        lastError: s.lastError,
        webUsbDeviceName: s.webUsbDeviceName,
        webUsbDevice: s.webUsbDevice,
        qzPrinters: s.qzPrinters,
      }),
      skipHydration: true,
    },
  ),
);

/**
 * localStorage dan bir marta oʻqish (brauzerda; sinxron storage — qaytganda holat allaqachon yangilangan).
 * Serverda yoki storage yopiq boʻlsa (private rejim) hech narsa qilmaydi.
 */
export function hydratePrinterStore(): void {
  if (typeof window === 'undefined') return;
  const p = usePrinterStore.persist;
  if (p.hasHydrated()) return;
  try {
    void p.rehydrate();
  } catch {
    // storage mavjud emas — boshlangʻich holat bilan davom etamiz
  }
}

/** Komponent uchun: gidratsiya tugagach `true` (birinchi renderda server bilan bir xil boʻsh holat) */
export function usePrinterStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => usePrinterStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = usePrinterStore.persist.onFinishHydration(() => setHydrated(true));
    hydratePrinterStore();
    if (usePrinterStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

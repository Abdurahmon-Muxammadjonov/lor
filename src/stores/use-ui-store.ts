'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Dashboard qobigʻi holati: yon panel (yigʻilgan/yoyilgan — localStorage da saqlanadi),
 * mobil menyu va buyruqlar paneli (⌘K) — sessiya ichida.
 *
 * SSR mosligi: `skipHydration` — brauzerda <DashboardShell/> `useUiStore.persist.rehydrate()` ni chaqiradi,
 * shunda server va birinchi render bir xil (yoyilgan) boʻladi va gidratsiya xatosi chiqmaydi.
 */
export interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  /** persist dan oʻqib boʻlindi (birinchi renderda animatsiyani oʻchirish uchun) */
  hydrated: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileNavOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  toggleCommand: () => void;
  setHydrated: (v: boolean) => void;
}

export const UI_STORE_KEY = 'lor:ui';

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandOpen: false,
      hydrated: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      setCommandOpen: (v) => set({ commandOpen: v }),
      toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: UI_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
      skipHydration: true,
    },
  ),
);

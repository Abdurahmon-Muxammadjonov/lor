'use client';

import { createContext, useContext, type MutableRefObject } from 'react';
import type { AppointmentDTO } from '@/lib/appointments/types';
import type { AppointmentStatusCode } from '@/lib/appointments/schemas';

export interface DragPreview {
  id: string;
  columnKey: string;
  startMin: number;
  /** Boshqa ustunga sudralganda soya (ghost) davomiyligi uchun */
  appointment: AppointmentDTO;
}

export interface CalendarInteractions {
  canWrite: boolean;
  slotMinutes: number;
  workStartMin: number;
  workEndMin: number;
  pxPerMin: number;
  now: { dateKey: string; minutes: number };
  dragPreview: DragPreview | null;
  /** Sudrashdan keyingi "click" ni bosish deb qabul qilmaslik uchun */
  suppressClickRef: MutableRefObject<boolean>;
  /** Hozir serverda oʻzgarayotgan yozilishlar */
  pendingIds: ReadonlySet<string>;
  onOpen: (a: AppointmentDTO) => void;
  onStatus: (a: AppointmentDTO, status: AppointmentStatusCode) => void;
  onDelete: (a: AppointmentDTO) => void;
}

const Ctx = createContext<CalendarInteractions | null>(null);

export const CalendarProvider = Ctx.Provider;

export function useCalendar(): CalendarInteractions {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCalendar must be used inside <CalendarProvider>');
  return ctx;
}

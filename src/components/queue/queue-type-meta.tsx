import type { QueueType } from '@prisma/client';
import { FlaskConical, RotateCcw, Stethoscope, Wallet, type LucideIcon } from 'lucide-react';

/** Navbat turi → ikonka va rang (kiosk, taxta, tablo bir xil koʻrinadi) */
export interface QueueTypeMeta {
  icon: LucideIcon;
  /** Asosiy rang (hex) — CSS oʻzgaruvchilar yoki inline uslub uchun */
  hex: string;
  /** Matn rangi klassi */
  text: string;
  /** Yumshoq fon klassi */
  soft: string;
  /** Chegara klassi */
  border: string;
  /** Yorqin fon (tugma) */
  glow: string;
}

export const QUEUE_TYPE_META: Record<QueueType, QueueTypeMeta> = {
  DOCTOR: {
    icon: Stethoscope,
    hex: '#00D4FF',
    text: 'text-accent',
    soft: 'bg-primary/10',
    border: 'border-primary/30',
    glow: 'shadow-glow',
  },
  RECHECK: {
    icon: RotateCcw,
    hex: '#7C5CFF',
    text: 'text-[#A996FF]',
    soft: 'bg-[#7C5CFF]/15',
    border: 'border-[#7C5CFF]/40',
    glow: 'shadow-glow-violet',
  },
  LAB: {
    icon: FlaskConical,
    hex: '#00FFB2',
    text: 'text-[#00FFB2]',
    soft: 'bg-[#00FFB2]/10',
    border: 'border-[#00FFB2]/30',
    glow: 'shadow-glow-mint',
  },
  CASHIER: {
    icon: Wallet,
    hex: '#FFB547',
    text: 'text-[#FFB547]',
    soft: 'bg-warning/10',
    border: 'border-[#FFB547]/40',
    glow: 'shadow-[0_0_0_1px_rgba(255,181,71,0.3),0_0_24px_rgba(255,181,71,0.3)]',
  },
};

export function QueueTypeIcon({ type, className }: { type: QueueType; className?: string }) {
  const Icon = QUEUE_TYPE_META[type].icon;
  return <Icon className={className} aria-hidden="true" />;
}

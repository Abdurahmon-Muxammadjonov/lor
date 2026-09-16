import {
  Activity,
  Baby,
  Bandage,
  ClipboardList,
  Droplets,
  Ear,
  FlaskConical,
  FolderOpen,
  HeartPulse,
  Mic,
  Microscope,
  Pill,
  ScanLine,
  Scissors,
  Sparkles,
  Stethoscope,
  Syringe,
  TestTube,
  Thermometer,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryIconName } from '@/lib/services/schemas';

/** Kategoriya ikonkasi nomi (lucide kebab-case) → komponent */
export const CATEGORY_ICON_MAP: Record<CategoryIconName, LucideIcon> = {
  stethoscope: Stethoscope,
  wind: Wind,
  ear: Ear,
  mic: Mic,
  zap: Zap,
  scissors: Scissors,
  'flask-conical': FlaskConical,
  syringe: Syringe,
  pill: Pill,
  activity: Activity,
  'heart-pulse': HeartPulse,
  microscope: Microscope,
  thermometer: Thermometer,
  droplets: Droplets,
  waves: Waves,
  baby: Baby,
  bandage: Bandage,
  'test-tube': TestTube,
  'scan-line': ScanLine,
  'clipboard-list': ClipboardList,
  sparkles: Sparkles,
};

export function isCategoryIconName(v: unknown): v is CategoryIconName {
  return typeof v === 'string' && v in CATEGORY_ICON_MAP;
}

export function iconFor(name: string | null | undefined): LucideIcon {
  return isCategoryIconName(name) ? CATEGORY_ICON_MAP[name] : FolderOpen;
}

export interface CategoryIconProps {
  name: string | null | undefined;
  className?: string;
}

/** Kategoriya ikonkasi (nomaʼlum/boʻsh nom → papka) — server-safe */
export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = iconFor(name);
  return <Icon className={cn('size-4 shrink-0', className)} aria-hidden="true" />;
}

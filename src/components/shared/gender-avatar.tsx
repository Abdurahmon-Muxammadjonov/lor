import * as React from 'react';
import { cn, initials } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type GenderValue = 'MALE' | 'FEMALE' | null | undefined;
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface GenderAvatarProps {
  gender: GenderValue;
  name: string;
  size?: AvatarSize;
  /** Rasm URL (boʻlsa initsiallar oʻrniga) */
  src?: string | null;
  className?: string;
}

const SIZE: Record<AvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-xl',
};

const COLOR: Record<'MALE' | 'FEMALE' | 'UNKNOWN', string> = {
  MALE: 'border-primary/25 bg-primary/10 text-accent',
  FEMALE: 'border-[#FF7EB6]/30 bg-[#FF7EB6]/10 text-[#FF9CC7]',
  UNKNOWN: 'border-line bg-surface text-text-muted',
};

/**
 * Bemor/xodim avatari — initsiallar, jins boʻyicha rang (erkak — cyan, ayol — pushti).
 *
 *   <GenderAvatar gender={patient.gender} name={patient.fullName} size="sm" />
 */
export function GenderAvatar({ gender, name, size = 'md', src, className }: GenderAvatarProps) {
  const key = gender === 'MALE' || gender === 'FEMALE' ? gender : 'UNKNOWN';
  const text = initials(name) || '?';
  return (
    <Avatar className={cn(SIZE[size], className)} title={name}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={cn('font-semibold', COLOR[key])} delayMs={src ? 300 : undefined} aria-label={name}>
        {text}
      </AvatarFallback>
    </Avatar>
  );
}

'use client';

import * as React from 'react';
import { cn, initials } from '@/lib/utils';
import { hexToRgba, ringStyle, safeHex } from '@/lib/staff/color';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export type StaffAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<StaffAvatarSize, string> = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-2xl',
};

export interface StaffAvatarProps {
  name: string;
  color: string;
  size?: StaffAvatarSize;
  /** Rangli halqa + nur */
  ring?: boolean;
  /** Nofaol — xira */
  dimmed?: boolean;
  className?: string;
}

/** Xodim avatari: initsiallar, xodim rangi bilan halqa va yumshoq nur */
export function StaffAvatar({ name, color, size = 'md', ring = true, dimmed = false, className }: StaffAvatarProps) {
  const hex = safeHex(color);
  return (
    <Avatar
      className={cn(SIZE[size], 'shrink-0', dimmed && 'opacity-60 grayscale', className)}
      style={ring ? ringStyle(hex) : undefined}
      title={name}
    >
      <AvatarFallback
        aria-label={name}
        className="font-heading font-bold"
        style={{ color: hex, backgroundColor: hexToRgba(hex, 0.12), borderColor: hexToRgba(hex, 0.3) }}
      >
        {initials(name) || '?'}
      </AvatarFallback>
    </Avatar>
  );
}

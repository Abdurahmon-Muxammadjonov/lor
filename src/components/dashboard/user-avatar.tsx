'use client';

import * as React from 'react';
import { cn, initials } from '@/lib/utils';
import { hexAlpha, safeHex } from '@/lib/dashboard/color';

export interface UserAvatarProps {
  name: string;
  /** Xodim rangi (User.color) */
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Faol (onlayn) belgisi */
  online?: boolean;
}

const SIZE = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
} as const;

/** Xodim avatari — initsiallar, User.color asosidagi rang */
export function UserAvatar({ name, color, size = 'md', className, online = false }: UserAvatarProps) {
  const hex = safeHex(color);
  return (
    <span
      className={cn('relative inline-flex shrink-0 select-none items-center justify-center rounded-full border font-semibold uppercase', SIZE[size], className)}
      style={{ backgroundColor: hexAlpha(hex, 0.16), borderColor: hexAlpha(hex, 0.45), color: hex }}
      aria-hidden="true"
    >
      {initials(name) || '?'}
      {online ? (
        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-bg-elevated bg-[#00FFB2]" />
      ) : null}
    </span>
  );
}

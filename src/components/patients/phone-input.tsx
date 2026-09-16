'use client';

import * as React from 'react';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, type InputProps } from '@/components/ui/input';
import { formatPhoneMask, PHONE_MASK_PLACEHOLDER } from '@/lib/patients/phone-mask';

export interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Telefon maydoni: +998 XX XXX XX XX maskasi bilan. Qiymat — koʻrinishdagi satr
 * (yuborishdan oldin `toPatientPayload` uni raqamlarga keltiradi).
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, className, placeholder, ...props }, ref) => {
    return (
      <div className="relative">
        <Phone
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(e) => onChange(formatPhoneMask(e.target.value))}
          placeholder={placeholder ?? PHONE_MASK_PLACEHOLDER}
          className={cn('tabular pl-9', className)}
          maxLength={17}
          {...props}
        />
      </div>
    );
  },
);
PhoneInput.displayName = 'PhoneInput';

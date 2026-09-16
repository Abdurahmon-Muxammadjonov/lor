import * as React from 'react';
import { Phone } from 'lucide-react';
import { cn, formatPhone, normalizePhone } from '@/lib/utils';

export interface PhoneLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  phone: string | null | undefined;
  /** Chapda telefon ikonkasi */
  withIcon?: boolean;
  /** Boʻsh boʻlganda matn (default "—") */
  emptyText?: string;
  className?: string;
}

/**
 * Telefon raqami — `+998 90 123 45 67` koʻrinishida, `tel:` havola.
 *
 *   <PhoneLink phone={patient.phone} withIcon />
 */
export const PhoneLink = React.forwardRef<HTMLAnchorElement, PhoneLinkProps>(
  ({ phone, withIcon = false, emptyText = '—', className, ...props }, ref) => {
    if (!phone) return <span className={cn('text-text-muted', className)}>{emptyText}</span>;
    const normalized = normalizePhone(phone);
    const display = formatPhone(normalized) || phone;
    return (
      <a
        ref={ref}
        href={`tel:${normalized || phone}`}
        dir="ltr"
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm tabular text-text underline-offset-4 transition-colors hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        {...props}
      >
        {withIcon ? <Phone className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" /> : null}
        {display}
      </a>
    );
  },
);
PhoneLink.displayName = 'PhoneLink';

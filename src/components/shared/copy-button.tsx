'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** Nusxalanadigan matn */
  text: string;
  /** Ikonka yonidagi matn (ixtiyoriy) */
  label?: React.ReactNode;
  /** Toast koʻrsatish (default true) */
  withToast?: boolean;
  /** Muvaffaqiyatli nusxalashdan keyin */
  onCopied?: () => void;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // quyidagi zaxira usulga oʻtamiz
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Nusxalash tugmasi — bosilganda `text` buferga koʻchadi, 1.5 s davomida ✓ va toast "Nusxalandi".
 *
 *   <CopyButton text={patient.phone} />
 */
export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ text, label, withToast = true, onCopied, className, variant = 'ghost', size, ...props }, ref) => {
    const t = useT();
    const [copied, setCopied] = React.useState(false);
    const timer = React.useRef<number>(0);

    React.useEffect(() => () => window.clearTimeout(timer.current), []);

    const handleClick = async () => {
      const ok = await copyToClipboard(text);
      if (!ok) {
        toast.error(t('common.error'));
        return;
      }
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
      if (withToast) toast.success(t('common.copied'));
      onCopied?.();
    };

    const Icon = copied ? Check : Copy;

    return (
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size ?? (label ? 'sm' : 'icon')}
        onClick={handleClick}
        aria-label={label ? undefined : t('common.copy')}
        title={t('common.copy')}
        data-copied={copied || undefined}
        className={cn(!label && 'size-8', copied && 'text-[#00FFB2]', className)}
        {...props}
      >
        <Icon aria-hidden="true" />
        {label}
      </Button>
    );
  },
);
CopyButton.displayName = 'CopyButton';

'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Button } from '@/components/ui/button';

export interface SaveBarProps {
  /** Forma oʻzgarganmi */
  dirty: boolean;
  saving: boolean;
  /** Formada xato bor (tugma oʻchirilmaydi, lekin ogohlantiriladi) */
  hasErrors?: boolean;
  onDiscard: () => void;
  /** Saqlash — forma submit orqali (`form` atributi) yoki toʻgʻridan-toʻgʻri */
  onSave?: () => void;
  formId?: string;
  className?: string;
}

/**
 * Pastda yopishqoq "saqlanmagan oʻzgarishlar" paneli. Faqat forma dirty boʻlganda chiqadi.
 * Klaviatura: Ctrl/Cmd+S — saqlash (forma ichida).
 */
export function SaveBar({ dirty, saving, hasErrors = false, onDiscard, onSave, formId, className }: SaveBarProps) {
  const t = useT();
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {dirty ? (
        <motion.div
          key="save-bar"
          role="region"
          aria-live="polite"
          aria-label={t('settings.saveBar.unsaved')}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
          className={cn('sticky bottom-3 z-30 mt-6 sm:bottom-4', className)}
        >
          <div className="glass-strong flex flex-col gap-3 rounded-xl border border-line px-4 py-3 shadow-glow sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={cn('size-2 shrink-0 rounded-full', hasErrors ? 'bg-danger' : 'bg-accent shadow-[0_0_0_4px_rgba(0,212,255,0.18)]')}
              />
              <span className="truncate text-text">{hasErrors ? t('settings.saveBar.fix') : t('settings.saveBar.unsaved')}</span>
              {hasErrors ? <AlertCircle className="size-4 shrink-0 text-danger" aria-hidden="true" /> : null}
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {t('settings.saveBar.discard')}
              </Button>
              <Button type={formId ? 'submit' : 'button'} form={formId} variant="gradient" size="sm" loading={saving} onClick={formId ? undefined : onSave}>
                {saving ? null : <Save className="size-4" aria-hidden="true" />}
                {t('settings.saveBar.save')}
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Sozlamalar formalari uchun umumiy elementlar: maydon (label + xato/hint), boʻlim sarlavhasi,
 * switch qatori va karta. Xato matnlari — i18n kalitlari (`t(error)`).
 */

export interface FieldProps {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  /** i18n kaliti (zod message) */
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Field({ id, label, required, error, hint, className, children }: FieldProps) {
  const t = useT();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Maydon uchun aria atributlari (xato/hint bogʻlash) */
export function fieldAria(id: string, error?: string, hint?: boolean): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  if (error) return { 'aria-invalid': true, 'aria-describedby': `${id}-error` };
  if (hint) return { 'aria-describedby': `${id}-hint` };
  return {};
}

export function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('col-span-full flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted', className)}>
      <span className="shrink-0">{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </h3>
  );
}

export interface SwitchRowProps {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function SwitchRow({ id, label, hint, checked, onCheckedChange, disabled, className }: SwitchRowProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 rounded-lg border border-line bg-bg-elevated/60 px-4 py-3', className)}>
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-5">
          {label}
        </Label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined} className="mt-0.5" />
    </div>
  );
}

export interface FormCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function FormCard({ title, description, actions, children, className, contentClassName }: FormCardProps) {
  return (
    <Card className={cn('glass overflow-hidden', className)}>
      <CardHeader className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn('p-5 pt-0 sm:p-6 sm:pt-0', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

/** Kiritish maydoni yonidagi birlik (mm, daqiqa …) */
export function InputWithUnit({ unit, children, className }: { unit: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <span className="shrink-0 text-sm text-text-muted">{unit}</span>
    </div>
  );
}

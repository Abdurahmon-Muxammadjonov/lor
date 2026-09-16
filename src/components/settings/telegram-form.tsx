'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Bot, FileBarChart, Plus, Send, Trash2, Users } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  TelegramFormSchema,
  TelegramTestSchema,
  zChatId,
  type TelegramFormValues,
  type TelegramPatch,
  type TelegramTestInput,
} from '@/lib/settings/schemas';
import { ConfigBadge } from './config-badge';
import { Field, FormCard, SectionHeading, SwitchRow, fieldAria } from './form-field';
import { SaveBar } from './save-bar';
import { settingsErrorMessage, useTelegramSection, useTelegramTest, useUpdateTelegramSection } from './use-settings';

export interface TelegramFormProps {
  canWrite: boolean;
}

const FORM_ID = 'settings-telegram-form';
const MAX_CHAT_IDS = 20;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function toPatch(values: TelegramFormValues, base: TelegramFormValues): TelegramPatch {
  const patch: TelegramPatch = {};
  for (const key of Object.keys(values) as (keyof TelegramFormValues)[]) {
    if (JSON.stringify(values[key]) !== JSON.stringify(base[key])) (patch as Record<string, unknown>)[key] = values[key];
  }
  return patch;
}

/** Telegram boʻlimi: yoqish, admin chat ID lari, kunlik hisobot soati, bemor eslatmalari va test yuborish */
export function TelegramForm({ canWrite }: TelegramFormProps) {
  const { t, locale } = useLocale();
  const query = useTelegramSection();
  const update = useUpdateTelegramSection();
  const [testOpen, setTestOpen] = React.useState(false);

  const form = useForm<TelegramFormValues>({
    resolver: zodResolver(TelegramFormSchema),
    mode: 'onTouched',
    defaultValues: query.data?.telegram,
  });
  const { control, handleSubmit, reset, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;

  React.useEffect(() => {
    if (query.data && !isDirty) reset(query.data.telegram);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  React.useEffect(() => {
    if (query.isError) toast.error(settingsErrorMessage(query.error, t, locale), { id: 'settings-telegram-load' });
  }, [query.isError, query.error, t, locale]);

  const onSubmit = handleSubmit(async (vals) => {
    if (!query.data) return;
    const patch = toPatch(vals, query.data.telegram);
    if (Object.keys(patch).length === 0) {
      reset(vals);
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      reset(saved.telegram);
      toast.success(t('settings.toast.saved'));
    } catch (e) {
      toast.error(settingsErrorMessage(e, t, locale));
    }
  });

  const disabled = !canWrite || update.isPending;
  const hasErrors = Object.keys(errors).length > 0;

  if (query.isPending) return <TelegramFormSkeleton />;
  if (!query.data) return null;

  const { configured, botUsername } = query.data;

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <FormCard
          title={t('settings.telegram.title')}
          description={t('settings.telegram.description')}
          actions={
            <>
              <Badge variant="outline" className="font-mono">
                {botUsername ? `@${botUsername}` : t('settings.telegram.botUnknown')}
              </Badge>
              <ConfigBadge configured={configured} />
            </>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3 md:col-span-2">
              <Controller
                control={control}
                name="enabled"
                render={({ field }) => (
                  <SwitchRow
                    id="tg-enabled"
                    label={t('settings.telegram.enabled')}
                    hint={t('settings.telegram.description')}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={disabled}
                  />
                )}
              />
              {!configured ? (
                <p className="text-xs text-warning" role="status">
                  {t('settings.telegram.envHint')} — {t('settings.status.envHint')}
                </p>
              ) : null}
            </div>

            <SectionHeading>
              <Users className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.telegram.adminChatIds')}
            </SectionHeading>

            <div className="md:col-span-2">
              <Controller
                control={control}
                name="adminChatIds"
                render={({ field, fieldState }) => (
                  <ChatIdEditor
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                    error={fieldState.error?.message}
                    itemErrors={Array.isArray(errors.adminChatIds) ? errors.adminChatIds.map((e) => e?.message) : []}
                  />
                )}
              />
            </div>

            <SectionHeading>
              <FileBarChart className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.telegram.dailyReportHour')}
            </SectionHeading>

            <Field
              id="tg-report-hour"
              label={t('settings.telegram.dailyReportHour')}
              error={errors.dailyReportHour?.message}
              hint={t('settings.telegram.dailyReportHint')}
            >
              <Controller
                control={control}
                name="dailyReportHour"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} disabled={disabled}>
                    <SelectTrigger id="tg-report-hour" className="tabular" {...fieldAria('tg-report-hour', errors.dailyReportHour?.message, true)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h} value={String(h)} className="tabular">
                          {hourLabel(h)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="md:pt-6">
              <Controller
                control={control}
                name="patientReminders"
                render={({ field }) => (
                  <SwitchRow
                    id="tg-patient-reminders"
                    label={t('settings.telegram.patientReminders')}
                    hint={t('settings.telegram.patientRemindersHint')}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={disabled}
                  />
                )}
              />
            </div>
          </div>
        </FormCard>
      </fieldset>

      <FormCard
        title={t('settings.telegram.test.title')}
        description={t('settings.telegram.test.description')}
        actions={
          <Button type="button" variant="gradient" onClick={() => setTestOpen(true)} disabled={!canWrite || !configured}>
            <Send aria-hidden="true" />
            {t('settings.telegram.test.send')}
          </Button>
        }
      >
        <p className="text-xs text-text-muted">{t('settings.telegram.chatIdHint')}</p>
      </FormCard>

      <TelegramTestDialog open={testOpen} onOpenChange={setTestOpen} />

      {canWrite ? <SaveBar dirty={isDirty} saving={isSubmitting || update.isPending} hasErrors={hasErrors} onDiscard={() => reset()} formId={FORM_ID} /> : null}
    </form>
  );
}

interface ChatIdEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Massiv darajasidagi xato (i18n kaliti) */
  error?: string;
  itemErrors: (string | undefined)[];
}

/** Chat ID roʻyxati muharriri: qoʻshish (validatsiya bilan) va oʻchirish */
function ChatIdEditor({ value, onChange, disabled, error, itemErrors }: ChatIdEditorProps) {
  const t = useLocale().t;
  const [draft, setDraft] = React.useState('');
  const [draftError, setDraftError] = React.useState<string | null>(null);

  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    if (value.length >= MAX_CHAT_IDS) {
      setDraftError('settings.validation.tooMany');
      return;
    }
    const parsed = zChatId.safeParse(raw);
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message ?? 'settings.validation.chatId');
      return;
    }
    setDraftError(null);
    setDraft('');
    if (value.includes(parsed.data)) return;
    onChange([...value, parsed.data]);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="tg-chat-id-input">{t('settings.telegram.adminChatIds')}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="tg-chat-id-input"
          inputMode="numeric"
          placeholder={t('settings.telegram.chatIdPlaceholder')}
          className="font-mono sm:flex-1"
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            setDraftError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          aria-invalid={draftError ? true : undefined}
          aria-describedby={draftError ? 'tg-chat-id-error' : 'tg-chat-id-hint'}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={disabled} className="sm:w-auto">
          <Plus aria-hidden="true" />
          {t('settings.telegram.addChatId')}
        </Button>
      </div>
      {draftError ? (
        <p id="tg-chat-id-error" role="alert" className="text-xs font-medium text-danger">
          {t(draftError)}
        </p>
      ) : (
        <p id="tg-chat-id-hint" className="text-xs text-text-muted">
          {t('settings.telegram.chatIdHint')}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {t(error)}
        </p>
      ) : null}

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-text-muted">{t('settings.telegram.noChatIds')}</p>
      ) : (
        <ul className="space-y-2" aria-label={t('settings.telegram.adminChatIds')}>
          {value.map((id, i) => (
            <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg-elevated/60 px-3 py-2">
              <span className="min-w-0 space-y-0.5">
                <span className="tabular block truncate font-mono text-sm text-text">{id}</span>
                {itemErrors[i] ? (
                  <span role="alert" className="block text-xs font-medium text-danger">
                    {t(itemErrors[i] ?? '')}
                  </span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-text-muted hover:text-danger"
                onClick={() => onChange(value.filter((v) => v !== id))}
                disabled={disabled}
                aria-label={`${t('settings.telegram.removeChatId')} ${id}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TelegramTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Test: qisqa xabar yoki bugungi kunlik hisobot (bitta chatga yoki barcha adminlarga) */
function TelegramTestDialog({ open, onOpenChange }: TelegramTestDialogProps) {
  const { t, locale } = useLocale();
  const send = useTelegramTest();
  const [mode, setMode] = React.useState<'message' | 'report'>('message');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TelegramTestInput>({ resolver: zodResolver(TelegramTestSchema), mode: 'onTouched', defaultValues: { chatId: '' } });

  React.useEffect(() => {
    if (!open) {
      reset({ chatId: '' });
      setMode('message');
    }
  }, [open, reset]);

  const submit = (report: boolean) =>
    handleSubmit(async (vals) => {
      setMode(report ? 'report' : 'message');
      try {
        const result = await send.mutateAsync({ chatId: vals.chatId?.trim() ? vals.chatId.trim() : undefined, report });
        toast.success(t('settings.telegram.test.sent', { n: result.sent }), {
          description: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        });
        onOpenChange(false);
      } catch (e) {
        toast.error(settingsErrorMessage(e, t, locale));
      }
    });

  return (
    <Dialog open={open} onOpenChange={(o) => (send.isPending ? undefined : onOpenChange(o))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.telegram.test.title')}</DialogTitle>
          <DialogDescription>{t('settings.telegram.test.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit(false)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tg-test-chat">{t('settings.telegram.test.toChat')}</Label>
            <Input
              id="tg-test-chat"
              inputMode="numeric"
              placeholder={t('settings.telegram.chatIdPlaceholder')}
              className="font-mono"
              {...register('chatId')}
              {...fieldAria('tg-test-chat', errors.chatId?.message, true)}
            />
            {errors.chatId?.message ? (
              <p id="tg-test-chat-error" role="alert" className="text-xs font-medium text-danger">
                {t(errors.chatId.message)}
              </p>
            ) : (
              <p id="tg-test-chat-hint" className="text-xs text-text-muted">
                {t('settings.telegram.chatIdHint')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void submit(true)()}
              loading={send.isPending && mode === 'report'}
              disabled={send.isPending}
            >
              {send.isPending && mode === 'report' ? null : <FileBarChart aria-hidden="true" />}
              {t('settings.telegram.test.sendReport')}
            </Button>
            <Button type="submit" variant="gradient" loading={send.isPending && mode === 'message'} disabled={send.isPending}>
              {send.isPending && mode === 'message' ? null : <Bot aria-hidden="true" />}
              {t('settings.telegram.test.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TelegramFormSkeleton() {
  return (
    <div className="card-surface space-y-5 p-6" aria-busy="true" aria-hidden="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}

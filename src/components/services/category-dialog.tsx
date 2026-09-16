'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/shared/empty-state';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { CATEGORY_ICONS, CategorySchema, type CategoryInput } from '@/lib/services/schemas';
import type { CategoryDTO } from '@/lib/services/types';
import { CATEGORY_ICON_MAP, CategoryIcon } from './category-icon';
import {
  serviceErrorMessage,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from './use-services';

export interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryDTO[];
}

type Editing = { mode: 'create' } | { mode: 'edit'; id: string } | null;

/** Kategoriyalar boshqaruvi: qoʻshish, nomini/ikonkasini oʻzgartirish, tartib (yuqoriga/pastga), boʻshini oʻchirish */
export function CategoryDialog({ open, onOpenChange, categories }: CategoryDialogProps) {
  const { t, locale } = useLocale();
  const [editing, setEditing] = React.useState<Editing>(null);
  const [confirm, confirmElement] = useConfirm();
  const remove = useDeleteCategory();
  const reorder = useReorderCategories();

  const sorted = React.useMemo(() => [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)), [categories]);

  React.useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const ids = sorted.map((c) => c.id);
    const a = ids[index];
    const b = ids[target];
    if (a === undefined || b === undefined) return;
    ids[index] = b;
    ids[target] = a;
    reorder.mutate(ids, { onError: (e) => toast.error(serviceErrorMessage(e, t)) });
  };

  const onDelete = async (c: CategoryDTO) => {
    const okConfirm = await confirm({
      title: t('services.category.deleteTitle'),
      description: t('services.category.deleteDescription', { name: locale === 'ru' ? c.nameRu : c.name }),
      destructive: true,
    });
    if (!okConfirm) return;
    try {
      await remove.mutateAsync(c.id);
      toast.success(t('services.category.deleted'));
      if (editing?.mode === 'edit' && editing.id === c.id) setEditing(null);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLICT') {
        toast.error(t('services.category.deleteBlocked', { n: c.servicesCount }));
        return;
      }
      toast.error(serviceErrorMessage(e, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="size-5 text-accent" aria-hidden="true" />
            {t('services.category.title')}
          </DialogTitle>
          <DialogDescription>{t('services.category.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sorted.length === 0 && editing?.mode !== 'create' ? (
            <EmptyState
              compact
              icon={FolderPlus}
              title={t('services.category.empty')}
              action={
                <Button size="sm" onClick={() => setEditing({ mode: 'create' })}>
                  <Plus aria-hidden="true" />
                  {t('services.category.add')}
                </Button>
              }
            />
          ) : (
            <ol className="max-h-[50vh] space-y-2 overflow-y-auto pr-1 scrollbar-thin" aria-label={t('services.category.list')}>
              {sorted.map((c, i) => {
                const isEditing = editing?.mode === 'edit' && editing.id === c.id;
                const name = locale === 'ru' ? c.nameRu : c.name;
                const secondary = locale === 'ru' ? c.name : c.nameRu;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      'rounded-xl border bg-surface transition-colors',
                      isEditing ? 'border-primary/40 shadow-glow' : 'border-line',
                    )}
                  >
                    {isEditing ? (
                      <CategoryForm
                        category={c}
                        onDone={() => setEditing(null)}
                        onCancel={() => setEditing(null)}
                        className="p-3"
                      />
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg-elevated text-accent">
                          <CategoryIcon name={c.icon} className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-text">{name}</span>
                            <Badge variant="outline" className="px-2 py-0 text-[10px]">
                              {t('services.category.count', { n: c.servicesCount })}
                            </Badge>
                          </div>
                          {secondary && secondary !== name ? (
                            <div className="truncate text-xs text-text-muted">{secondary}</div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`${t('services.category.moveUp')}: ${name}`}
                            disabled={i === 0 || reorder.isPending}
                            onClick={() => move(i, -1)}
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`${t('services.category.moveDown')}: ${name}`}
                            disabled={i === sorted.length - 1 || reorder.isPending}
                            onClick={() => move(i, 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`${t('services.category.edit')}: ${name}`}
                            onClick={() => setEditing({ mode: 'edit', id: c.id })}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          {c.servicesCount > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-text-muted"
                                    aria-label={`${t('common.delete')}: ${name}`}
                                    disabled
                                  >
                                    <Trash2 aria-hidden="true" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left">{t('services.category.deleteBlocked', { n: c.servicesCount })}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-danger hover:text-danger"
                              aria-label={`${t('common.delete')}: ${name}`}
                              loading={remove.isPending && remove.variables === c.id}
                              onClick={() => void onDelete(c)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {editing?.mode === 'create' ? (
            <div className="rounded-xl border border-primary/40 bg-surface shadow-glow">
              <CategoryForm onDone={() => setEditing(null)} onCancel={() => setEditing(null)} className="p-3" />
            </div>
          ) : sorted.length > 0 ? (
            <Button variant="outline" className="w-full border-dashed" onClick={() => setEditing({ mode: 'create' })}>
              <Plus aria-hidden="true" />
              {t('services.category.add')}
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
        {confirmElement}
      </DialogContent>
    </Dialog>
  );
}

interface CategoryFormProps {
  /** Berilsa — tahrirlash, aks holda yangi */
  category?: CategoryDTO;
  onDone: () => void;
  onCancel: () => void;
  className?: string;
}

const NO_ICON = '__none__';

function CategoryForm({ category, onDone, onCancel, className }: CategoryFormProps) {
  const { t } = useLocale();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const isEdit = Boolean(category);
  const uid = React.useId();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput>({
    resolver: zodResolver(CategorySchema),
    defaultValues: {
      name: category?.name ?? '',
      nameRu: category?.nameRu ?? '',
      icon: category?.icon && (CATEGORY_ICONS as readonly string[]).includes(category.icon) ? (category.icon as CategoryInput['icon']) : null,
      order: category?.order ?? 0,
    },
    mode: 'onBlur',
  });

  const err = (key: 'name' | 'nameRu' | 'icon') => {
    const m = errors[key]?.message;
    if (!m) return null;
    const raw = String(m);
    const translated = t(raw);
    return translated === raw && /\s/.test(raw) ? t('common.validation.invalid') : translated;
  };

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = CategorySchema.safeParse(raw);
    if (!parsed.success) return;
    const values = parsed.data;
    try {
      if (category) {
        await update.mutateAsync({ id: category.id, patch: { name: values.name, nameRu: values.nameRu, icon: values.icon ?? null } });
        toast.success(t('services.category.updated'));
      } else {
        await create.mutateAsync({ name: values.name, nameRu: values.nameRu, icon: values.icon ?? null, order: 0 });
        toast.success(t('services.category.created'));
      }
      onDone();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'CONFLICT') {
        setError('name', { type: 'server', message: 'services.errors.nameExists' });
        return;
      }
      toast.error(serviceErrorMessage(e, t));
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('space-y-3', className)}
      aria-label={isEdit ? t('services.category.editTitle') : t('services.category.addTitle')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {isEdit ? t('services.category.editTitle') : t('services.category.addTitle')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-name`} required>
            {t('services.category.name')}
          </Label>
          <Input id={`${uid}-name`} autoFocus aria-invalid={Boolean(errors.name) || undefined} {...register('name')} />
          {err('name') ? (
            <p role="alert" className="text-xs text-danger">
              {err('name')}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-nameRu`} required>
            {t('services.category.nameRu')}
          </Label>
          <Input id={`${uid}-nameRu`} aria-invalid={Boolean(errors.nameRu) || undefined} {...register('nameRu')} />
          {err('nameRu') ? (
            <p role="alert" className="text-xs text-danger">
              {err('nameRu')}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-icon`}>{t('services.category.icon')}</Label>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <Select value={field.value ?? NO_ICON} onValueChange={(v) => field.onChange(v === NO_ICON ? null : v)}>
              <SelectTrigger id={`${uid}-icon`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NO_ICON}>
                  <span className="inline-flex items-center gap-2 text-text-muted">
                    <CategoryIcon name={null} />
                    {t('services.category.noIcon')}
                  </span>
                </SelectItem>
                {CATEGORY_ICONS.map((name) => {
                  const Icon = CATEGORY_ICON_MAP[name];
                  return (
                    <SelectItem key={name} value={name}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="size-4 text-accent" aria-hidden="true" />
                        <span className="font-mono text-xs">{name}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          {t('services.category.cancelEdit')}
        </Button>
        <Button type="submit" size="sm" variant="gradient" loading={isSubmitting}>
          {isEdit ? t('common.save') : t('common.create')}
        </Button>
      </div>
    </form>
  );
}

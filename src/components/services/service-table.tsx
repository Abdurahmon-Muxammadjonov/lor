'use client';

import * as React from 'react';
import { Clock, History, MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, pickLang } from '@/i18n/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import type { PriceField, ServiceUpdateInput } from '@/lib/services/schemas';
import type { ServiceDTO } from '@/lib/services/types';
import { PriceGrid } from './price-grid';

export interface ServiceTableProps {
  services: ServiceDTO[];
  loading?: boolean;
  canEdit: boolean;
  selected: ReadonlySet<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onPatch: (service: ServiceDTO, patch: ServiceUpdateInput, kind: 'price' | 'toggle' | 'active') => Promise<void>;
  onEdit: (service: ServiceDTO) => void;
  onHistory: (service: ServiceDTO) => void;
  onDelete: (service: ServiceDTO) => void;
  emptyText?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  className?: string;
}

/** Xizmatlar jadvali: kod, nom, birlik, 2×2 narx, sozlamalar, davomiylik, faollik, amallar */
export function ServiceTable({
  services,
  loading = false,
  canEdit,
  selected,
  onToggleSelect,
  onToggleAll,
  onPatch,
  onEdit,
  onHistory,
  onDelete,
  emptyText,
  emptyDescription,
  emptyAction,
  className,
}: ServiceTableProps) {
  const { t, locale } = useLocale();

  const allIds = React.useMemo(() => services.map((s) => s.id), [services]);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;
  const headerChecked: boolean | 'indeterminate' =
    selectedCount === 0 ? false : selectedCount === allIds.length ? true : 'indeterminate';

  const columns = React.useMemo<DataTableColumn<ServiceDTO>[]>(() => {
    const cols: DataTableColumn<ServiceDTO>[] = [];

    if (canEdit) {
      cols.push({
        key: 'select',
        header: (
          <Checkbox
            aria-label={t('services.actions.selectAll')}
            checked={headerChecked}
            onCheckedChange={(v) => onToggleAll(allIds, v === true)}
            disabled={allIds.length === 0}
          />
        ),
        width: 36,
        className: 'pr-0',
        headerClassName: 'pr-0',
        cell: (s) => (
          <Checkbox
            aria-label={`${t('services.table.select')}: ${s.code}`}
            checked={selected.has(s.id)}
            onCheckedChange={(v) => onToggleSelect(s.id, v === true)}
          />
        ),
      });
    }

    cols.push(
      {
        key: 'code',
        header: t('services.table.code'),
        width: 84,
        cell: (s) => (
          <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-accent">
            {s.code}
          </span>
        ),
      },
      {
        key: 'name',
        header: t('services.table.name'),
        cell: (s) => {
          const primary = pickLang(s, locale);
          const secondary = locale === 'ru' ? s.name : s.nameRu;
          return (
            <div className="min-w-[10rem] max-w-[22rem]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-text">{primary}</span>
                {!s.isActive ? (
                  <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                    {t('services.table.inactiveBadge')}
                  </Badge>
                ) : null}
                {!s.medicineOptional ? (
                  <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
                    {t('services.table.medOnlyBadge')}
                  </Badge>
                ) : null}
              </div>
              {secondary && secondary !== primary ? (
                <div className="mt-0.5 text-xs text-text-muted">{secondary}</div>
              ) : null}
              {s.defaultOrgan ? (
                <div className="mt-0.5 text-[11px] text-text-muted">{t(`common.organ.${s.defaultOrgan}`)}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'unit',
        header: t('services.table.unit'),
        hideOnMobile: true,
        width: 72,
        cell: (s) => <span className="text-sm text-text-muted">{t(`services.units.${s.unit}`)}</span>,
      },
      {
        key: 'prices',
        header: t('services.table.prices'),
        align: 'right',
        width: 250,
        cell: (s) => (
          <PriceGrid
            service={s}
            canEdit={canEdit}
            onSave={(field: PriceField, value: number) => onPatch(s, { [field]: value }, 'price')}
          />
        ),
      },
      {
        key: 'options',
        header: t('services.table.options'),
        hideOnMobile: true,
        width: 150,
        cell: (s) => (
          <div className="flex flex-col gap-1.5">
            <OptionSwitch
              id={`half-${s.id}`}
              label={t('services.fields.allowHalf')}
              hint={t('services.fields.allowHalfHint')}
              checked={s.allowHalf}
              disabled={!canEdit}
              onChange={(v) => onPatch(s, { allowHalf: v }, 'toggle')}
            />
            <OptionSwitch
              id={`med-${s.id}`}
              label={t('services.fields.medicineOptional')}
              hint={t('services.fields.medicineOptionalHint')}
              checked={s.medicineOptional}
              disabled={!canEdit}
              onChange={(v) => onPatch(s, { medicineOptional: v }, 'toggle')}
            />
          </div>
        ),
      },
      {
        key: 'duration',
        header: t('services.table.duration'),
        hideOnMobile: true,
        width: 96,
        cell: (s) => (
          <span className="inline-flex items-center gap-1 text-sm text-text-muted tabular">
            <Clock className="size-3.5" aria-hidden="true" />
            {t('services.table.minutes', { n: s.durationMin })}
          </span>
        ),
      },
      {
        key: 'active',
        header: t('services.table.active'),
        align: 'center',
        width: 72,
        cell: (s) =>
          canEdit ? (
            <Switch
              aria-label={`${t('services.table.active')}: ${s.code}`}
              checked={s.isActive}
              onCheckedChange={(v) => void onPatch(s, { isActive: v }, 'active')}
            />
          ) : (
            <Badge variant={s.isActive ? 'success' : 'outline'} dot>
              {s.isActive ? t('common.active') : t('common.inactive')}
            </Badge>
          ),
      },
    );

    if (canEdit) {
      cols.push({
        key: 'actions',
        header: <span className="sr-only">{t('services.table.actions')}</span>,
        align: 'right',
        width: 48,
        cell: (s) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`${t('services.actions.rowMenu')}: ${s.code}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(s)}>
                <Pencil /> {t('services.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onHistory(s)}>
                <History /> {t('services.actions.history')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void onPatch(s, { isActive: !s.isActive }, 'active')}>
                {s.isActive ? <PowerOff /> : <Power />}
                {s.isActive ? t('services.actions.deactivate') : t('services.actions.activate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {s.linesCount > 0 ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem destructive disabled>
                        <Trash2 /> {t('services.actions.delete')}
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">{t('services.delete.blocked', { n: s.linesCount })}</TooltipContent>
                </Tooltip>
              ) : (
                <DropdownMenuItem destructive onSelect={() => onDelete(s)}>
                  <Trash2 /> {t('services.actions.delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    } else {
      cols.push({
        key: 'history',
        header: <span className="sr-only">{t('services.actions.history')}</span>,
        align: 'right',
        width: 48,
        cell: (s) => (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`${t('services.actions.history')}: ${s.code}`}
            onClick={() => onHistory(s)}
          >
            <History aria-hidden="true" />
          </Button>
        ),
      });
    }

    return cols;
  }, [t, locale, canEdit, selected, allIds, headerChecked, onToggleAll, onToggleSelect, onPatch, onEdit, onHistory, onDelete]);

  return (
    <DataTable
      columns={columns}
      data={services}
      rowKey={(s) => s.id}
      loading={loading}
      skeletonRows={5}
      dense
      caption={t('services.table.caption')}
      emptyText={emptyText}
      emptyDescription={emptyDescription}
      emptyAction={emptyAction}
      isRowSelected={(s) => selected.has(s.id)}
      rowClassName={(s) => (s.isActive ? undefined : 'opacity-60')}
      className={cn('bg-card/60', className)}
    />
  );
}

interface OptionSwitchProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => Promise<void>;
}

function OptionSwitch({ id, label, hint, checked, disabled, onChange }: OptionSwitchProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label htmlFor={id} className={cn('inline-flex w-fit cursor-pointer items-center gap-2', disabled && 'cursor-default')}>
          <Switch
            id={id}
            checked={checked}
            disabled={disabled}
            onCheckedChange={(v) => void onChange(v)}
            className="h-5 w-9 [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-4"
          />
          <span className="text-xs text-text-muted">{label}</span>
        </label>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

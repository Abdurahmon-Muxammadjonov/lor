'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Eraser, History, ScrollText } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/date';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { CopyButton } from '@/components/shared/copy-button';
import { useStaffList } from '@/components/staff/use-staff';
import { AUDIT_ACTIONS, type AuditItemDTO, type AuditQuery } from '@/lib/settings/schemas';
import { changedKeys, diffRows, formatValue, hasDiffPayload, mergeUserOptions, prettyJson } from '@/lib/settings/audit-diff';
import { FormCard } from './form-field';
import { settingsErrorMessage, useAuditLog } from './use-settings';

const ALL = '__all__';
const PAGE_SIZE = 20;

const ACTION_VARIANT: Record<string, BadgeProps['variant']> = {
  CREATE: 'success',
  UPDATE: 'accent',
  DELETE: 'danger',
  LOGIN: 'secondary',
  PRICE_CHANGE: 'warning',
  PAYMENT: 'success',
  REFUND: 'danger',
  SHIFT_OPEN: 'outline',
  SHIFT_CLOSE: 'outline',
  VISIT_COMPLETE: 'success',
  VISIT_CANCEL: 'danger',
  QUEUE_CALL: 'secondary',
  SETTINGS: 'accent',
  PASSWORD_RESET: 'warning',
};

interface Filters {
  entity: string;
  userId: string;
  action: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { entity: '', userId: '', action: '', from: '', to: '' };

function isKnownAction(action: string): boolean {
  return (AUDIT_ACTIONS as readonly string[]).includes(action);
}

/** Audit jurnali: filtrlar, jadval va "Farq" (before/after) oynasi */
export function AuditLog() {
  const { t, locale } = useLocale();
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<AuditItemDTO | null>(null);

  const params = React.useMemo<Partial<AuditQuery>>(() => {
    const p: Partial<AuditQuery> = { page, pageSize: PAGE_SIZE };
    if (filters.entity) p.entity = filters.entity;
    if (filters.userId) p.userId = filters.userId;
    if (filters.action) p.action = filters.action;
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = filters.to;
    return p;
  }, [filters, page]);

  const query = useAuditLog(params);
  const staff = useStaffList({});

  React.useEffect(() => {
    if (query.isError) toast.error(t('settings.audit.loadError'), { id: 'settings-audit-load', description: settingsErrorMessage(query.error, t, locale) });
  }, [query.isError, query.error, t, locale]);

  const setFilter = (key: keyof Filters, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const userOptions = React.useMemo(
    () => mergeUserOptions(staff.data?.items.map((u) => ({ id: u.id, fullName: u.fullName, role: u.role })), query.data?.users),
    [staff.data, query.data],
  );

  const entities = query.data?.entities ?? [];
  const hasFilters = Object.values(filters).some((v) => v !== '');

  const actionLabel = React.useCallback((action: string) => (isKnownAction(action) ? t(`settings.audit.actions.${action}`) : action), [t]);

  const columns = React.useMemo<DataTableColumn<AuditItemDTO>[]>(
    () => [
      {
        key: 'time',
        header: t('settings.audit.columns.time'),
        width: 150,
        cell: (r) => <span className="tabular whitespace-nowrap text-text-muted">{fmtDateTime(r.createdAt, locale)}</span>,
      },
      {
        key: 'user',
        header: t('settings.audit.columns.user'),
        cell: (r) =>
          r.user ? (
            <div className="min-w-0">
              <div className="truncate font-medium text-text">{r.user.fullName}</div>
              <div className="truncate text-xs text-text-muted">{t(`common.role.${r.user.role}`)}</div>
            </div>
          ) : (
            <span className="text-text-muted">{t('settings.audit.system')}</span>
          ),
      },
      {
        key: 'action',
        header: t('settings.audit.columns.action'),
        width: 170,
        cell: (r) => <Badge variant={ACTION_VARIANT[r.action] ?? 'outline'}>{actionLabel(r.action)}</Badge>,
      },
      {
        key: 'entity',
        header: t('settings.audit.columns.entity'),
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate text-sm text-text">{r.entity}</div>
            {r.entityId ? <code className="block truncate font-mono text-[11px] text-text-muted">{r.entityId}</code> : null}
          </div>
        ),
      },
      {
        key: 'ip',
        header: t('settings.audit.columns.ip'),
        hideOnMobile: true,
        width: 130,
        cell: (r) => <span className="tabular font-mono text-xs text-text-muted">{r.ip ?? '—'}</span>,
      },
      {
        key: 'changes',
        header: t('settings.audit.columns.changes'),
        align: 'right',
        width: 190,
        cell: (r) => {
          const n = changedKeys(r.before, r.after).length;
          if (!hasDiffPayload(r.before, r.after)) return <span className="text-xs text-text-muted">{t('settings.audit.noChanges')}</span>;
          return (
            <div className="flex items-center justify-end gap-2">
              {n > 0 ? <span className="tabular text-xs text-text-muted">{t('settings.audit.changedFields', { n })}</span> : null}
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(r)}>
                <History aria-hidden="true" />
                {t('settings.audit.diff.view')}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, locale, actionLabel],
  );

  return (
    <div className="space-y-5">
      <FormCard title={t('settings.audit.title')} description={t('settings.audit.description')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="audit-entity">{t('settings.audit.filters.entity')}</Label>
            <Select value={filters.entity || ALL} onValueChange={(v) => setFilter('entity', v === ALL ? '' : v)}>
              <SelectTrigger id="audit-entity">
                <SelectValue placeholder={t('settings.audit.filters.allEntities')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('settings.audit.filters.allEntities')}</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audit-user">{t('settings.audit.filters.user')}</Label>
            <Select value={filters.userId || ALL} onValueChange={(v) => setFilter('userId', v === ALL ? '' : v)}>
              <SelectTrigger id="audit-user">
                <SelectValue placeholder={t('settings.audit.filters.allUsers')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('settings.audit.filters.allUsers')}</SelectItem>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audit-action">{t('settings.audit.filters.action')}</Label>
            <Select value={filters.action || ALL} onValueChange={(v) => setFilter('action', v === ALL ? '' : v)}>
              <SelectTrigger id="audit-action">
                <SelectValue placeholder={t('settings.audit.filters.allActions')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('settings.audit.filters.allActions')}</SelectItem>
                {AUDIT_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`settings.audit.actions.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audit-from">{t('settings.audit.filters.from')}</Label>
            <Input id="audit-from" type="date" className="tabular" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="audit-to">{t('settings.audit.filters.to')}</Label>
            <Input id="audit-to" type="date" className="tabular" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
          </div>
        </div>

        {hasFilters ? (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              <Eraser aria-hidden="true" />
              {t('settings.audit.filters.clear')}
            </Button>
          </div>
        ) : null}
      </FormCard>

      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        rowKey={(r) => r.id}
        loading={query.isPending}
        emptyIcon={ScrollText}
        emptyText={t('settings.audit.empty.title')}
        emptyDescription={t('settings.audit.empty.description')}
        caption={t('settings.audit.title')}
        footer={
          query.data && query.data.total > PAGE_SIZE ? (
            <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.total} onChange={setPage} simple />
          ) : undefined
        }
      />

      <AuditDiffDialog item={selected} onOpenChange={(open) => (open ? undefined : setSelected(null))} />
    </div>
  );
}

interface AuditDiffDialogProps {
  item: AuditItemDTO | null;
  onOpenChange: (open: boolean) => void;
}

/** Oldin/keyin yonma-yon: jadval (oʻzgargan kalitlar ajratilgan) yoki xom JSON */
function AuditDiffDialog({ item, onOpenChange }: AuditDiffDialogProps) {
  const { t, locale } = useLocale();
  const [view, setView] = React.useState<'table' | 'json'>('table');

  React.useEffect(() => {
    if (item) setView('table');
  }, [item]);

  const rows = React.useMemo(() => (item ? diffRows(item.before, item.after) : []), [item]);
  const changed = React.useMemo(() => (item ? changedKeys(item.before, item.after) : []), [item]);

  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('settings.audit.diff.title')}</DialogTitle>
          <DialogDescription>
            {item ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="tabular">{fmtDateTime(item.createdAt, locale)}</span>
                <span aria-hidden="true">·</span>
                <span>{item.user ? item.user.fullName : t('settings.audit.system')}</span>
                <span aria-hidden="true">·</span>
                <span>{item.entity}</span>
                {item.entityId ? <code className="font-mono text-[11px]">{item.entityId}</code> : null}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant={ACTION_VARIANT[item.action] ?? 'outline'}>
                {(AUDIT_ACTIONS as readonly string[]).includes(item.action) ? t(`settings.audit.actions.${item.action}`) : item.action}
              </Badge>
              <Segmented<'table' | 'json'>
                value={view}
                onChange={setView}
                size="sm"
                ariaLabel={t('settings.audit.diff.title')}
                options={[
                  { value: 'table', label: t('settings.audit.diff.table') },
                  { value: 'json', label: t('settings.audit.diff.json') },
                ]}
              />
            </div>

            {changed.length > 0 ? (
              <p className="tabular text-xs text-text-muted">{t('settings.audit.changedFields', { n: changed.length })}</p>
            ) : null}

            {view === 'table' && rows.length > 0 ? (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      <th scope="col" className="w-1/4 py-2 pr-3 font-semibold">
                        {t('settings.audit.diff.field')}
                      </th>
                      <th scope="col" className="w-[37.5%] py-2 pr-3 font-semibold">
                        {t('settings.audit.diff.before')}
                      </th>
                      <th scope="col" className="w-[37.5%] py-2 font-semibold">
                        {t('settings.audit.diff.after')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key} className={cn('border-b border-line/60 align-top', row.changed && 'bg-primary/5')}>
                        <th scope="row" className="py-2 pr-3 text-left font-mono text-xs font-medium text-text">
                          {row.key}
                          {row.changed ? <span aria-hidden="true" className="ml-1 text-accent">•</span> : null}
                        </th>
                        <td className={cn('py-2 pr-3', row.changed ? 'text-danger' : 'text-text-muted')}>
                          <pre className="whitespace-pre-wrap break-words font-mono text-xs">{formatValue(row.before) || '—'}</pre>
                        </td>
                        <td className={cn('py-2', row.changed ? 'text-[#00FFB2]' : 'text-text-muted')}>
                          <pre className="whitespace-pre-wrap break-words font-mono text-xs">{formatValue(row.after) || '—'}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {view === 'json' || rows.length === 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <JsonPane title={t('settings.audit.diff.before')} value={item.before} emptyText={t('settings.audit.diff.empty')} />
                <JsonPane title={t('settings.audit.diff.after')} value={item.after} emptyText={t('settings.audit.diff.empty')} />
              </div>
            ) : null}

            <dl className="grid gap-2 border-t border-line pt-3 text-xs text-text-muted sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="font-medium">{t('settings.audit.columns.ip')}:</dt>
                <dd className="tabular font-mono">{item.ip ?? '—'}</dd>
              </div>
              <div className="flex min-w-0 gap-2">
                <dt className="shrink-0 font-medium">{t('settings.audit.diff.userAgent')}:</dt>
                <dd className="min-w-0 truncate">{item.userAgent ?? '—'}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function JsonPane({ title, value, emptyText }: { title: string; value: unknown; emptyText: string }) {
  const t = useLocale().t;
  const json = prettyJson(value);
  return (
    <section className="rounded-lg border border-line bg-bg-elevated/60">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{title}</h4>
        {json ? <CopyButton text={json} withToast label={t('settings.audit.diff.copy')} variant="ghost" /> : null}
      </header>
      <pre className="scrollbar-thin max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs text-text">
        {json || emptyText}
      </pre>
    </section>
  );
}

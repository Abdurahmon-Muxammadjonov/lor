'use client';

import * as React from 'react';
import { Eye, FileSpreadsheet, FolderCog, Plus, Sparkles, Stethoscope, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn, normalizeSearch } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { useHotkey } from '@/hooks/use-hotkey';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchInput } from '@/components/shared/search-input';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { ApiClientError } from '@/lib/api/client';
import type { ServiceUpdateInput } from '@/lib/services/schemas';
import type { CategoryDTO, ServiceDTO } from '@/lib/services/types';
import { BulkDialog } from './bulk-dialog';
import { CategoryDialog } from './category-dialog';
import { CategoryIcon } from './category-icon';
import { ALL_CATEGORIES, CategoryNav } from './category-nav';
import { HistorySheet } from './history-sheet';
import { ServiceDialog } from './service-dialog';
import { ServiceTable } from './service-table';
import { serviceErrorMessage, useCategoriesQuery, useDeleteService, usePatchService, useServicesQuery } from './use-services';

export interface ServicesPageProps {
  /** ADMIN — tahrirlash; boshqalar — faqat narxlar roʻyxati */
  canEdit: boolean;
  canExport: boolean;
}

type ServiceDialogState = { open: boolean; service: ServiceDTO | null; categoryId: string | null };

/** /dashboard/services — xizmatlar va 4 xil narx boshqaruvi (client qismi) */
export function ServicesPage({ canEdit, canExport }: ServicesPageProps) {
  const { t, locale } = useLocale();
  const servicesQuery = useServicesQuery();
  const categoriesQuery = useCategoriesQuery();
  const patch = usePatchService();
  const remove = useDeleteService();
  const [confirm, confirmElement] = useConfirm();

  const [categoryId, setCategoryId] = React.useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(false);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const [serviceDialog, setServiceDialog] = React.useState<ServiceDialogState>({ open: false, service: null, categoryId: null });
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [categoriesOpen, setCategoriesOpen] = React.useState(false);
  const [historyService, setHistoryService] = React.useState<ServiceDTO | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  useHotkey('/', () => searchRef.current?.focus());

  // Xato → toast (bir marta)
  React.useEffect(() => {
    if (servicesQuery.isError) toast.error(serviceErrorMessage(servicesQuery.error, t), { id: 'services-load' });
  }, [servicesQuery.isError, servicesQuery.error, t]);
  React.useEffect(() => {
    if (categoriesQuery.isError) toast.error(serviceErrorMessage(categoriesQuery.error, t), { id: 'categories-load' });
  }, [categoriesQuery.isError, categoriesQuery.error, t]);

  const services = React.useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const categories = React.useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  // Tanlangan kategoriya oʻchirilgan boʻlsa — "Barchasi"ga qaytish
  React.useEffect(() => {
    if (categoryId !== ALL_CATEGORIES && categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(ALL_CATEGORIES);
    }
  }, [categories, categoryId]);

  // Roʻyxatdan yoʻqolgan xizmatlarni tanlovdan olib tashlash
  React.useEffect(() => {
    if (selected.size === 0) return;
    const ids = new Set(services.map((s) => s.id));
    if (Array.from(selected).every((id) => ids.has(id))) return;
    setSelected(new Set(Array.from(selected).filter((id) => ids.has(id))));
  }, [services, selected]);

  const normalizedQuery = normalizeSearch(search);
  const visible = React.useMemo(() => {
    return services.filter((s) => {
      if (!showInactive && !s.isActive) return false;
      if (!normalizedQuery) return true;
      const hay = normalizeSearch(`${s.code} ${s.name} ${s.nameRu}`);
      return hay.includes(normalizedQuery);
    });
  }, [services, showInactive, normalizedQuery]);

  const countsByCategory = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const s of visible) m.set(s.categoryId, (m.get(s.categoryId) ?? 0) + 1);
    return m;
  }, [visible]);

  const sortedCategories = React.useMemo(
    () => [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [categories],
  );

  /** Koʻrsatiladigan boʻlimlar: tanlangan kategoriya yoki barchasi (qidiruvda boʻshlari yashiriladi) */
  const sections = React.useMemo(() => {
    const list = categoryId === ALL_CATEGORIES ? sortedCategories : sortedCategories.filter((c) => c.id === categoryId);
    return list
      .map((c) => ({ category: c, services: visible.filter((s) => s.categoryId === c.id) }))
      .filter((sec) => !normalizedQuery || sec.services.length > 0);
  }, [categoryId, sortedCategories, visible, normalizedQuery]);

  const loading = servicesQuery.isPending || categoriesQuery.isPending;
  const activeTotal = services.filter((s) => s.isActive).length;

  // ── Amallar ──
  const onPatch = React.useCallback(
    async (service: ServiceDTO, input: ServiceUpdateInput, kind: 'price' | 'toggle' | 'active') => {
      try {
        const row = await patch.mutateAsync({ id: service.id, patch: input });
        if (kind === 'price') toast.success(t('services.prices.saved', { code: row.code }));
        else if (kind === 'active') toast.success(t(row.isActive ? 'services.toggles.activated' : 'services.toggles.deactivated', { code: row.code }));
        else toast.success(t('services.toggles.updated', { code: row.code }));
      } catch (e) {
        toast.error(kind === 'price' ? `${t('services.prices.saveFailed')}: ${serviceErrorMessage(e, t)}` : serviceErrorMessage(e, t));
      }
    },
    [patch, t],
  );

  const onDelete = React.useCallback(
    async (service: ServiceDTO) => {
      const okConfirm = await confirm({
        title: t('services.delete.title'),
        description: t('services.delete.description', { name: locale === 'ru' ? service.nameRu : service.name, code: service.code }),
        destructive: true,
      });
      if (!okConfirm) return;
      try {
        await remove.mutateAsync(service.id);
        toast.success(t('services.delete.done', { code: service.code }));
      } catch (e) {
        if (e instanceof ApiClientError && e.code === 'CONFLICT') {
          const n =
            e.details && typeof e.details === 'object' && 'linesCount' in e.details
              ? Number((e.details as { linesCount?: unknown }).linesCount) || service.linesCount
              : service.linesCount;
          toast.error(t('services.delete.blocked', { n }));
          return;
        }
        toast.error(serviceErrorMessage(e, t));
      }
    },
    [confirm, remove, t, locale],
  );

  const openCreate = (catId?: string | null) =>
    setServiceDialog({ open: true, service: null, categoryId: catId ?? (categoryId === ALL_CATEGORIES ? null : categoryId) });
  const openEdit = React.useCallback((service: ServiceDTO) => setServiceDialog({ open: true, service, categoryId: null }), []);
  const openHistory = React.useCallback((service: ServiceDTO) => {
    setHistoryService(service);
    setHistoryOpen(true);
  }, []);

  const toggleSelect = React.useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const toggleAll = React.useCallback((ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const clearSelection = () => setSelected(new Set());

  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading(t('services.export.preparing'));
    try {
      const res = await fetch(`/api/services/export?all=${showInactive ? 1 : 0}&locale=${locale}`, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'lor-crm' },
      });
      if (!res.ok) throw new Error(t('services.export.failed'));
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = match?.[1] ?? 'narxlar.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t('services.export.done'), { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t('services.export.failed'), { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);
  const hasCategories = categories.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('services.title')}
        description={t('services.description')}
        leading={<Stethoscope aria-hidden="true" />}
        actions={
          <>
            {canExport ? (
              <Button variant="outline" onClick={() => void exportExcel()} loading={exporting} title={t('services.actions.exportTooltip')}>
                <FileSpreadsheet aria-hidden="true" />
                {t('services.actions.export')}
              </Button>
            ) : null}
            {canEdit ? (
              <>
                <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
                  <FolderCog aria-hidden="true" />
                  {t('services.actions.categories')}
                </Button>
                <Button variant="secondary" onClick={() => setBulkOpen(true)} disabled={services.length === 0}>
                  <Sparkles aria-hidden="true" />
                  {selected.size > 0 ? t('services.actions.bulkSelected', { n: selected.size }) : t('services.actions.bulk')}
                </Button>
                <Button variant="gradient" onClick={() => openCreate()} disabled={!hasCategories && !loading}>
                  <Plus aria-hidden="true" />
                  {t('services.actions.new')}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {!canEdit ? (
        <div role="note" className="flex items-center gap-2 rounded-xl border border-line bg-card/60 px-4 py-2.5 text-sm text-text-muted">
          <Eye className="size-4 shrink-0 text-accent" aria-hidden="true" />
          {t('services.readOnly')}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
        {/* Kategoriyalar */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="glass rounded-2xl p-2 lg:p-3">
            <div className="mb-2 hidden items-center justify-between px-1 lg:flex">
              <span className="font-heading text-sm font-semibold text-text">{t('services.category.title')}</span>
              <span className="text-xs text-text-muted tabular">{t('services.countActive', { active: activeTotal, total: services.length })}</span>
            </div>
            <CategoryNav
              categories={sortedCategories}
              counts={countsByCategory}
              totalCount={visible.length}
              value={categoryId}
              onChange={setCategoryId}
              loading={loading}
            />
          </div>
        </aside>

        {/* Kontent */}
        <section className="min-w-0 space-y-4" aria-label={t('services.title')}>
          <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
            <SearchInput
              ref={searchRef}
              value={search}
              onChange={setSearch}
              placeholder={t('services.search')}
              shortcut="/"
              className="sm:max-w-sm"
              loading={servicesQuery.isFetching && !servicesQuery.isPending}
            />
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-muted">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={t('services.showInactive')} />
              {t('services.showInactive')}
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              {selected.size > 0 ? (
                <>
                  <Badge variant="accent">{t('services.selected', { n: selected.size })}</Badge>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X aria-hidden="true" />
                    {t('services.actions.clearSelection')}
                  </Button>
                </>
              ) : (
                <span className="text-xs text-text-muted tabular">{t('services.count', { n: visible.length })}</span>
              )}
            </div>
          </div>

          {loading ? (
            <ServiceTable
              services={[]}
              loading
              canEdit={canEdit}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              onPatch={onPatch}
              onEdit={openEdit}
              onHistory={openHistory}
              onDelete={onDelete}
            />
          ) : servicesQuery.isError || categoriesQuery.isError ? (
            <EmptyState
              icon={Stethoscope}
              title={t('services.loadError')}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    void servicesQuery.refetch();
                    void categoriesQuery.refetch();
                  }}
                >
                  {t('common.retry')}
                </Button>
              }
            />
          ) : !hasCategories ? (
            <EmptyState
              icon={FolderCog}
              title={t('services.noCategories.title')}
              description={t('services.noCategories.description')}
              action={
                canEdit ? (
                  <Button variant="gradient" onClick={() => setCategoriesOpen(true)}>
                    <Plus aria-hidden="true" />
                    {t('services.noCategories.action')}
                  </Button>
                ) : undefined
              }
            />
          ) : sections.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title={t('services.noResults.title')}
              description={t('services.noResults.description')}
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setShowInactive(true);
                  }}
                >
                  {t('common.clear')}
                </Button>
              }
            />
          ) : (
            sections.map(({ category, services: rows }) => (
              <CategorySection
                key={category.id}
                category={category}
                count={rows.length}
                showHeader={categoryId === ALL_CATEGORIES || sections.length > 1}
                canEdit={canEdit}
                onAdd={() => openCreate(category.id)}
              >
                <ServiceTable
                  services={rows}
                  canEdit={canEdit}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleAll}
                  onPatch={onPatch}
                  onEdit={openEdit}
                  onHistory={openHistory}
                  onDelete={onDelete}
                  emptyText={normalizedQuery ? t('services.noResults.title') : t('services.empty.title')}
                  emptyDescription={normalizedQuery ? t('services.noResults.description') : t('services.empty.description')}
                  emptyAction={
                    canEdit && !normalizedQuery ? (
                      <Button size="sm" onClick={() => openCreate(category.id)}>
                        <Plus aria-hidden="true" />
                        {t('services.empty.action')}
                      </Button>
                    ) : undefined
                  }
                />
              </CategorySection>
            ))
          )}
        </section>
      </div>

      {canEdit ? (
        <>
          <ServiceDialog
            open={serviceDialog.open}
            onOpenChange={(o) => setServiceDialog((s) => ({ ...s, open: o }))}
            categories={sortedCategories}
            service={serviceDialog.service}
            defaultCategoryId={serviceDialog.categoryId}
          />
          <BulkDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            categories={sortedCategories}
            selectedIds={selectedIds}
            defaultCategoryId={categoryId === ALL_CATEGORIES ? null : categoryId}
            onApplied={clearSelection}
          />
          <CategoryDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={sortedCategories} />
        </>
      ) : null}
      <HistorySheet service={historyService} open={historyOpen} onOpenChange={setHistoryOpen} />
      {confirmElement}
    </div>
  );
}

interface CategorySectionProps {
  category: CategoryDTO;
  count: number;
  showHeader: boolean;
  canEdit: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}

function CategorySection({ category, count, showHeader, canEdit, onAdd, children }: CategorySectionProps) {
  const { t, locale } = useLocale();
  const name = locale === 'ru' ? category.nameRu : category.name;
  return (
    <section aria-label={name} className={cn('space-y-2')}>
      {showHeader ? (
        <header className="flex items-center gap-2 px-1">
          <span className="flex size-7 items-center justify-center rounded-lg border border-line bg-bg-elevated text-accent">
            <CategoryIcon name={category.icon} />
          </span>
          <h2 className="font-heading text-base font-semibold text-text">{name}</h2>
          <Badge variant="outline" className="px-2 py-0 text-[10px] tabular">
            {t('services.count', { n: count })}
          </Badge>
          {canEdit ? (
            <Button variant="ghost" size="sm" className="ml-auto h-8 text-text-muted" onClick={onAdd} aria-label={`${t('services.actions.new')}: ${name}`}>
              <Plus aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.add')}</span>
            </Button>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

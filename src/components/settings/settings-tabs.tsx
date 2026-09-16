'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Building2, ListOrdered, MessageSquareText, Printer, ScrollText, Settings2, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@prisma/client';
import { useT } from '@/i18n/client';
import { SETTINGS_TABS, settingsTabHref, type SettingsTab } from '@/lib/settings/tabs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/shared/page-header';
import { ClinicForm } from './clinic-form';
import { PrinterForm } from './printer-form';
import { SmsForm } from './sms-form';
import { TelegramForm } from './telegram-form';
import { QueueForm } from './queue-form';
import { RolesMatrix } from './roles-matrix';
import { AuditLog } from './audit-log';

export interface SettingsTabsProps {
  initialTab: SettingsTab;
  /** settings.write — boʻlmasa formalar faqat koʻrish uchun */
  canWrite: boolean;
  /** audit.view — boʻlmasa Audit tabi koʻrsatilmaydi */
  canAudit: boolean;
  clinicName: string;
  role: Role;
}

const TAB_ICON: Record<SettingsTab, LucideIcon> = {
  clinic: Building2,
  printer: Printer,
  sms: MessageSquareText,
  telegram: Bot,
  queue: ListOrdered,
  roles: ShieldCheck,
  audit: ScrollText,
};

/**
 * Sozlamalar sahifasi (client): tablar URL da saqlanadi (`?tab=`), klaviatura bilan boshqariladi
 * (Radix Tabs — strelkalar, Home/End), mobilda tab roʻyxati gorizontal aylanadi.
 */
export function SettingsTabs({ initialTab, canWrite, canAudit, clinicName, role }: SettingsTabsProps) {
  const t = useT();
  const router = useRouter();
  const tabs = React.useMemo(() => SETTINGS_TABS.filter((tab) => tab !== 'audit' || canAudit), [canAudit]);
  const [tab, setTab] = React.useState<SettingsTab>(() => (tabs.includes(initialTab) ? initialTab : 'clinic'));

  const onTabChange = (value: string) => {
    const next = tabs.find((x) => x === value) ?? 'clinic';
    setTab(next);
    router.replace(settingsTabHref(next), { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.description')} leading={<Settings2 aria-hidden="true" />} />

      {!canWrite ? (
        <Alert variant="info">
          <AlertDescription>{t('settings.readOnly')}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList aria-label={t('settings.title')} className="w-full max-w-full justify-start overflow-x-auto scrollbar-none lg:w-auto">
          {tabs.map((key) => {
            const Icon = TAB_ICON[key];
            return (
              <TabsTrigger key={key} value={key}>
                <Icon aria-hidden="true" />
                {t(`settings.tabs.${key}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="clinic" className="mt-5">
          <ClinicForm canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="printer" className="mt-5">
          <PrinterForm canWrite={canWrite} clinicName={clinicName} />
        </TabsContent>
        <TabsContent value="sms" className="mt-5">
          <SmsForm canWrite={canWrite} clinicName={clinicName} />
        </TabsContent>
        <TabsContent value="telegram" className="mt-5">
          <TelegramForm canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="queue" className="mt-5">
          <QueueForm canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="roles" className="mt-5">
          <RolesMatrix currentRole={role} />
        </TabsContent>
        {canAudit ? (
          <TabsContent value="audit" className="mt-5">
            <AuditLog />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

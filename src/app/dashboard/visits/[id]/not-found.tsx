import Link from 'next/link';
import { ClipboardX } from 'lucide-react';
import { getT } from '@/i18n/server';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

export default function VisitNotFound() {
  const t = getT();
  return (
    <div className="py-10">
      <EmptyState
        icon={ClipboardX}
        title={t('visits.errors.NOT_FOUND')}
        description={t('common.notFound.description')}
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/visits">{t('visits.title')}</Link>
          </Button>
        }
      />
    </div>
  );
}

import type { IntegrationStatusDTO } from '@/lib/settings/schemas';
import { isEskizConfigured } from './eskiz';
import { isTelegramConfigured } from './telegram';
import { isClickConfigured, isPaymeConfigured } from './payments/types';

/** Integratsiyalar env orqali sozlanganmi (sirlar qaytarilmaydi — faqat boolean) */
export function getIntegrationStatus(env: NodeJS.ProcessEnv = process.env): IntegrationStatusDTO {
  const cron = (env.CRON_SECRET ?? '').trim();
  return {
    eskiz: isEskizConfigured(),
    telegram: isTelegramConfigured(),
    click: isClickConfigured(),
    payme: isPaymeConfigured(),
    cron: cron !== '' && cron !== 'change-me',
  };
}

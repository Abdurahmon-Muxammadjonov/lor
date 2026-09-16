'use client';

import { useState, type ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LocaleProvider } from '@/i18n/client';
import type { Locale } from '@/i18n/config';

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider locale={locale}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster
            theme="dark"
            position="top-right"
            richColors
            closeButton
            toastOptions={{ className: 'font-sans' }}
          />
        </LocaleProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}

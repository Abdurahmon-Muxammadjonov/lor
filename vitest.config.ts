import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    // `tests/db/*` bitta umumiy Postgres bazasi ustida ishlaydi va hisobot testlari
    // API agregatlarini oʻsha paytdagi DB holati bilan solishtiradi. Fayllar parallel
    // ketsa, boshqa fayl yaratgan qabul/toʻlov oʻrtada qoʻshilib, taqqoslash buziladi
    // (flaky). Shu sabab test fayllari ketma-ket bajariladi.
    fileParallelism: false,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    coverage: { reporter: ['text'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});

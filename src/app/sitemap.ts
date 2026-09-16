import type { MetadataRoute } from 'next';
import { SITE } from '@/data/landing-content';

/** Ochiq sahifalar xaritasi (/sitemap.xml). Dashboard, kiosk, print va API kiritilmaydi. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL ?? SITE.url).replace(/\/$/, '');
  const lastModified = new Date(SITE.legalUpdated);
  return [
    { url: `${base}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/login`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.4 },
  ];
}

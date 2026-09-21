import type { MetadataRoute } from 'next';
import { getAllProgrammaticPages } from '@/data/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.inteldialix.online').replace(/\/+$/, '');
  const now = new Date();

  // Core static marketing pages
  const corePages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Programmatic directory hubs
  const hubPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/integrations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/solutions`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/templates`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // 310 curated programmatic pages across Integrations, Solutions, Comparisons, Templates
  const programmaticPages = getAllProgrammaticPages().map((page): MetadataRoute.Sitemap[number] => {
    const isHighPriority = page.type === 'integration' || page.type === 'solution';
    return {
      url: page.canonicalUrl,
      lastModified: new Date(page.lastModified),
      changeFrequency: 'weekly',
      priority: isHighPriority ? 0.8 : 0.7,
    };
  });

  return [...corePages, ...hubPages, ...programmaticPages];
}

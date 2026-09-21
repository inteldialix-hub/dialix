import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.inteldialix.online').replace(/\/+$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api/'],
      },
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: ['/dashboard', '/api/'],
      },
      {
        userAgent: 'Claude-Web',
        allow: '/',
        disallow: ['/dashboard', '/api/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/dashboard', '/api/'],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: ['/dashboard', '/api/'],
      },
      {
        userAgent: 'Applebot-Extended',
        allow: '/',
        disallow: ['/dashboard', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

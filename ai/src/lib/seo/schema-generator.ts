import type { ProgrammaticPageData } from '@/data/seo/types';

export const BASE_URL = 'https://www.inteldialix.online';

/**
 * Recursively cleans an object to remove null, undefined, or stringified 'null'/'undefined'
 * to guarantee compliance with Google Rich Results and strict JSON-LD validators.
 */
export function cleanJsonLd<T>(input: T): T {
  if (input === null || input === undefined || input === 'null' || input === 'undefined') {
    return undefined as unknown as T;
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => cleanJsonLd(item))
      .filter((item) => item !== undefined && item !== null) as unknown as T;
  }

  if (typeof input === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(input as Record<string, any>)) {
      if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        continue;
      }
      const cleanedValue = cleanJsonLd(value);
      if (cleanedValue !== undefined && cleanedValue !== null) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned as T;
  }

  return input;
}

/**
 * Global Organization schema representing Dialix brand identity.
 */
export function getOrganizationEntity() {
  return {
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'Dialix',
    url: BASE_URL,
    logo: `${BASE_URL}/dialix-logo.png`,
    description:
      'Enterprise-grade Voice AI platform and autonomous phone agent infrastructure.',
    sameAs: [
      'https://twitter.com/dialixai',
      'https://linkedin.com/company/dialix',
      'https://github.com/dialixai',
      'https://youtube.com/@dialixai',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@dialix.ai',
        availableLanguage: ['English'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'technical support',
        email: 'support@dialix.ai',
        availableLanguage: ['English'],
      },
    ],
  };
}

/**
 * WebSite schema representing Dialix website entity.
 */
export function getWebSiteEntity() {
  return {
    '@type': 'WebSite',
    '@id': `${BASE_URL}/#website`,
    url: BASE_URL,
    name: 'Dialix Voice AI',
    description:
      'Enterprise Voice AI Agents for Automated Inbound and Outbound Phone Calls',
    publisher: {
      '@id': `${BASE_URL}/#organization`,
    },
  };
}

/**
 * SoftwareApplication schema representing Dialix platform, features, rating, and pricing tiers.
 */
export function getSoftwareApplicationEntity() {
  return {
    '@type': 'SoftwareApplication',
    '@id': `${BASE_URL}/#software`,
    name: 'Dialix Voice AI Platform',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Cloud, WebRTC, SIP',
    author: {
      '@id': `${BASE_URL}/#organization`,
    },
    publisher: {
      '@id': `${BASE_URL}/#organization`,
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free tier with 100 free call minutes per month',
      },
      {
        '@type': 'Offer',
        name: 'Professional',
        price: '49',
        priceCurrency: 'USD',
        description:
          'Professional tier with 1,000 call minutes and 5 concurrent calls',
      },
      {
        '@type': 'Offer',
        name: 'Business',
        price: '149',
        priceCurrency: 'USD',
        description:
          'Business tier with 4,000 call minutes and 20 concurrent calls',
      },
      {
        '@type': 'Offer',
        name: 'Enterprise',
        price: '499',
        priceCurrency: 'USD',
        description:
          'Enterprise tier with unlimited minutes, dedicated SIP trunks, and custom SLAs',
      },
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: 4.9,
      reviewCount: 128,
      bestRating: 5,
      worstRating: 1,
    },
  };
}

/**
 * Standalone SoftwareApplication schema with @context.
 */
export function generateSoftwareApplicationSchema(): Record<string, any> {
  return cleanJsonLd({
    '@context': 'https://schema.org',
    ...getSoftwareApplicationEntity(),
  });
}

/**
 * Global @graph schema containing Organization, WebSite, SoftwareApplication,
 * default root BreadcrumbList, and primary FAQPage.
 * Injected in RootLayout (ai/src/app/layout.tsx).
 */
export function generateGlobalOrganizationSchema(): Record<string, any> {
  const rootBreadcrumbs = {
    '@type': 'BreadcrumbList',
    '@id': `${BASE_URL}/#breadcrumbs`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
    ],
  };

  const rootFaqs = {
    '@type': 'FAQPage',
    '@id': `${BASE_URL}/#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Dialix and how does it work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Dialix is an enterprise Voice AI platform that lets you build, deploy, and manage AI-powered phone agents. Our agents handle inbound and outbound calls using natural language processing, integrating with your existing tools and workflows.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does it take to deploy a voice agent?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Most enterprises go from pilot to production within 2-4 weeks. Our forward-deployed engineering team works alongside yours to configure, test, and launch agents tailored to your specific use case.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Dialix secure and compliant?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Dialix is certified across SOC 2, HIPAA, PCI DSS, and GDPR. We provide full encryption, detailed audit logs, role-based access controls, and region-based data hosting.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can Dialix integrate with my existing tools?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Absolutely. Dialix integrates natively with Salesforce, HubSpot, Zendesk, Freshworks, Calendly, and dozens more. We also offer a REST API and webhook support for custom integrations.',
        },
      },
      {
        '@type': 'Question',
        name: 'What languages does Dialix support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Dialix supports 30+ languages with native-quality pronunciation. Agents can switch languages mid-call and handle code-switching for multilingual customer bases.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is pricing structured?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pricing is based on usage — specifically the number of minutes handled by your AI agents. We offer starter, growth, and enterprise tiers with volume discounts. Contact sales for a custom quote.',
        },
      },
    ],
  };

  return cleanJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      getOrganizationEntity(),
      getWebSiteEntity(),
      getSoftwareApplicationEntity(),
      rootBreadcrumbs,
      rootFaqs,
    ],
  });
}

/**
 * Page-Specific @graph Schema Generator for Programmatic Pages.
 * Emits WebPage, TechArticle, BreadcrumbList, and FAQPage.
 */
export function generatePageSchema(
  data: ProgrammaticPageData
): Record<string, any> {
  const canonicalUrl = data.canonicalUrl.startsWith('http')
    ? data.canonicalUrl
    : `${BASE_URL}${data.canonicalUrl.startsWith('/') ? '' : '/'}${data.canonicalUrl}`;

  const articleId = `${canonicalUrl}#article`;
  const breadcrumbId = `${canonicalUrl}#breadcrumbs`;
  const faqId = `${canonicalUrl}#faq`;

  const webPageEntity = {
    '@type': 'WebPage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: data.metaTitle,
    description: data.metaDescription,
    inLanguage: 'en-US',
    isPartOf: {
      '@id': `${BASE_URL}/#website`,
    },
    breadcrumb: {
      '@id': breadcrumbId,
    },
    mainEntity: {
      '@id': articleId,
    },
  };

  const techArticleEntity = {
    '@type': 'TechArticle',
    '@id': articleId,
    url: canonicalUrl,
    headline: data.h1,
    name: data.metaTitle,
    description: data.metaDescription,
    inLanguage: 'en-US',
    mainEntityOfPage: canonicalUrl,
    datePublished: '2026-01-01T00:00:00Z',
    dateModified: data.lastModified,
    isPartOf: {
      '@id': `${BASE_URL}/#website`,
    },
    publisher: {
      '@id': `${BASE_URL}/#organization`,
    },
    author: {
      '@id': `${BASE_URL}/#organization`,
    },
    about: {
      '@type': 'Thing',
      name: data.entities.primaryEntity,
    },
    keywords: [
      data.entities.primaryEntity,
      ...data.entities.relatedEntities,
      ...data.entities.protocols,
      ...data.entities.supportedModels,
    ].join(', '),
  };

  const breadcrumbListEntity = {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: data.breadcrumbs.map((crumb, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: crumb.name,
      item: crumb.url.startsWith('http')
        ? crumb.url
        : `${BASE_URL}${crumb.url.startsWith('/') ? '' : '/'}${crumb.url}`,
    })),
  };

  const faqPageEntity = {
    '@type': 'FAQPage',
    '@id': faqId,
    mainEntity: data.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return cleanJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      webPageEntity,
      techArticleEntity,
      breadcrumbListEntity,
      faqPageEntity,
    ],
  });
}

/**
 * Directory Hub Schema Generator (for /integrations, /solutions, /compare, /templates).
 */
export function generateHubSchema(
  type: string,
  title: string,
  description: string,
  url: string
): Record<string, any> {
  const canonicalUrl = url.startsWith('http')
    ? url
    : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  const breadcrumbId = `${canonicalUrl}#breadcrumbs`;

  const typeLabel =
    type === 'integration'
      ? 'Integrations'
      : type === 'solution'
      ? 'Solutions'
      : type === 'comparison'
      ? 'Comparisons'
      : 'Templates';

  const collectionPageEntity = {
    '@type': 'CollectionPage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: title,
    description: description,
    inLanguage: 'en-US',
    isPartOf: {
      '@id': `${BASE_URL}/#website`,
    },
    breadcrumb: {
      '@id': breadcrumbId,
    },
  };

  const breadcrumbsEntity = {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: typeLabel,
        item: canonicalUrl,
      },
    ],
  };

  return cleanJsonLd({
    '@context': 'https://schema.org',
    '@graph': [collectionPageEntity, breadcrumbsEntity],
  });
}

/**
 * Pricing Page Schema Generator (/pricing).
 */
export function generatePricingSchema(): Record<string, any> {
  const canonicalUrl = `${BASE_URL}/pricing`;
  const breadcrumbId = `${canonicalUrl}#breadcrumbs`;
  const faqId = `${canonicalUrl}#faq`;

  const webPageEntity = {
    '@type': 'WebPage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: 'Pricing Plans — Scalable Voice AI for Teams & Enterprise',
    description:
      'Transparent pricing plans for Dialix Voice AI agents. From 100 free monthly calls to custom enterprise SLAs.',
    inLanguage: 'en-US',
    isPartOf: {
      '@id': `${BASE_URL}/#website`,
    },
    breadcrumb: {
      '@id': breadcrumbId,
    },
    mainEntity: {
      '@id': `${BASE_URL}/#software`,
    },
  };

  const breadcrumbsEntity = {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Pricing',
        item: canonicalUrl,
      },
    ],
  };

  const pricingFaqEntity = {
    '@type': 'FAQPage',
    '@id': faqId,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How is pricing calculated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pricing is based on active conversation minutes handled by your voice agents. All plans include standard telephony codecs and LLM inference.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I upgrade or downgrade anytime?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Plan upgrades take effect immediately with prorated billing, and downgrades take effect at the start of your next billing cycle.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do you offer an enterprise SLA?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Enterprise tiers include a 99.99% uptime SLA, dedicated SIP trunks, and a dedicated forward-deployed engineer.',
        },
      },
    ],
  };

  return cleanJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      webPageEntity,
      breadcrumbsEntity,
      getSoftwareApplicationEntity(),
      pricingFaqEntity,
    ],
  });
}

# Project: Dialix SEO, GEO, AEO, and Programmatic AI Discovery Architecture

## Architecture
- **Framework**: Next.js 15.5.15 (App Router), React 18.3.1, TypeScript 5.8.3, Tailwind CSS 3.4.17
- **Base Domain**: `https://www.inteldialix.online`
- **Programmatic Engine**: React Server Components (RSC) with `generateStaticParams` backed by typed in-memory registries in `ai/src/data/seo/`
- **Structured Data Engine**: Modular Schema.org `@graph` generator in `ai/src/lib/seo/schema-generator.ts` outputting linked entities: `Organization`, `WebSite`, `SoftwareApplication`, `WebPage`/`TechArticle`, `BreadcrumbList`, `FAQPage`
- **Discovery & Crawlers**:
  - Multi-tier dynamic XML sitemaps: core pages, integrations (100), solutions (100), comparisons (30), templates (80)
  - Unified `/robots.txt` permitting `GPTBot`, `Claude-Web`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, disallowing `/dashboard*` and `/api*`, pointing to `https://www.inteldialix.online/sitemap.xml`
  - Official LLM discovery endpoints: `/llms.txt` and `/llms-full.txt` (both dynamic App Router Route Handlers and static `public/` mirrors)
- **GEO / AEO Content Architecture**: Inverted pyramid factual answers (first 2-3 sentences), technical architecture diagrams, hard benchmarks (sub-200ms latency, 99.99% uptime, Opus/G.711 codecs, 34 languages), code snippets, and 1:1 visible FAQ accordions matching JSON-LD.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dynamic Multi-Tier XML Sitemap | `/sitemap.xml` sitemap index indexing core static pages + all 310 programmatic pages with ISO 8601 lastmod, optimal changefreq, accurate priority, and canonical URLs. Omit noindexed auth routes. | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Reconciled Robots.txt & AI Bot Permissions | Resolve `public/robots.txt` shadowing conflict, correct domain to `https://www.inteldialix.online`, permit GPTBot, Claude-Web, PerplexityBot, Google-Extended, disallow `/dashboard*` and `/api*`. | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Canonical URL Infrastructure | Automated self-referential absolute canonical tags across root layout, static marketing pages, and programmatic pages. | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Programmatic Data Model & Types | Strict TypeScript contracts (`ProgrammaticPageData`) supporting integrations, solutions, comparisons, and templates. | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Curated 310 Programmatic Keyword Registry | 100 Tools/Frameworks/Model integrations, 100 Solutions/Verticals, 30 Comparisons, 80 Templates targeting high-intent telephony & AI terms. | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Programmatic Routing & RSC Hubs | `/integrations`, `/integrations/[slug]`, `/solutions`, `/solutions/[slug]`, `/compare`, `/compare/[slug]`, `/templates`, `/templates/[slug]` with `generateStaticParams`. | M2 | ORIGINAL_REQUEST §R2 |
| 7 | GEO/AEO Content & Inverted Pyramid | First 2-3 sentences provide direct factual answers; include architecture diagrams, real benchmarks, and code snippets per page. | M2 | ORIGINAL_REQUEST §R4 |
| 8 | Reusable SEO Components | Dark-glass programmatic layout, breadcrumbs, code block with copy, comparison table, benchmark cards, and FAQ accordion. | M2 | ORIGINAL_REQUEST §R2, §R4 |
| 9 | Schema.org `@graph` JSON-LD Generator | Automated linked graph for `Organization`, `WebSite`, `SoftwareApplication`, `WebPage`/`TechArticle`, `BreadcrumbList`, and `FAQPage`. | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Global & Page-Level Schema Integration | Server component injecting validated JSON-LD into RootLayout, core pages (`/`, `/pricing`, `/about`, etc.) and all programmatic pages. | M3 | ORIGINAL_REQUEST §R3 |
| 11 | `/llms.txt` Official Standard | Concise markdown summary of Dialix platform, architecture, APIs, voice providers, benchmarks, and key links. | M4 | ORIGINAL_REQUEST §R5 |
| 12 | `/llms-full.txt` RAG Documentation Feed | Complete technical documentation feed for LLM ingestion indexing all 310 integrations, solutions, comparisons, and guides. | M4 | ORIGINAL_REQUEST §R5 |
| 13 | Full E2E Build & Validation | `npx next build` in `ai/` succeeds with 0 errors; verify sitemaps, robots.txt, JSON-LD, llms.txt, and 200 HTTP responses. | M5 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Sitemap, Robots & Canonical Foundation | Reconcile `robots.txt` & `app/robots.ts`, build dynamic sitemap generator with canonicals, fix metadata on `/` and `/pricing`. | none | DONE |
| M2 | Programmatic AI Pages & GEO/AEO Engine (310 Pages) | Build types, 310-page data registries, shared programmatic layout, and dynamic routes for integrations, solutions, comparisons, templates. | M1 | DONE |
| M3 | Rich Schema.org `@graph` JSON-LD System | Build JSON-LD generator helper and inject structured data across root layout, core pages, and all programmatic routes. | M2 | DONE |
| M4 | Official LLM Discovery Standards (`/llms.txt` & `/llms-full.txt`) | Implement Route Handlers and static public files for `/llms.txt` and `/llms-full.txt`. | M2 | DONE |
| M5 | Production Build & Comprehensive E2E Verification | Execute full production build in `ai/`, validate all routes, schemas, XML sitemaps, robots, and LLM text outputs. | M1, M2, M3, M4 | DONE |

## Interface Contracts

### Programmatic Data Contract (`ai/src/data/seo/types.ts`)
```ts
export interface ProgrammaticPageData {
  slug: string;
  type: 'integration' | 'solution' | 'comparison' | 'template';
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  lastModified: string;
  category: string;
  badge: string;
  h1: string;
  tagline: string;
  directAnswer: string; // 2-3 factual sentences for GEO/AEO
  entities: {
    primaryEntity: string;
    relatedEntities: string[];
    protocols: string[];
    supportedModels: string[];
  };
  architecture: {
    summary: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      technicalDetails: string;
    }>;
  };
  benchmarks: Array<{
    label: string;
    value: string;
    comparisonNote: string;
  }>;
  codeExample?: {
    language: string;
    filename: string;
    code: string;
    explanation: string;
  };
  comparisonMatrix?: {
    competitorName: string;
    rows: Array<{
      feature: string;
      dialixValue: string | boolean;
      competitorValue: string | boolean;
      explanation: string;
    }>;
  };
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  breadcrumbs: Array<{
    name: string;
    url: string;
  }>;
  relatedPages: Array<{
    title: string;
    slug: string;
    type: string;
    description: string;
  }>;
}
```

### Schema Generator Contract (`ai/src/lib/seo/schema-generator.ts`)
```ts
export function generatePageSchema(data: ProgrammaticPageData): Record<string, any>;
export function generateGlobalOrganizationSchema(): Record<string, any>;
export function generateSoftwareApplicationSchema(): Record<string, any>;
```

## Code Layout
- `ai/src/data/seo/`
  - `types.ts`: Core data types
  - `integrations.ts`: 100 tool & model integration definitions
  - `solutions.ts`: 100 telephony & vertical solution definitions
  - `comparisons.ts`: 30 competitor & architectural comparison definitions
  - `templates.ts`: 80 workflow blueprint definitions
  - `index.ts`: Unified registry & fast lookup utilities
- `ai/src/lib/seo/`
  - `schema-generator.ts`: Schema.org `@graph` JSON-LD generator
  - `metadata-helpers.ts`: Title, description, and canonical helpers
- `ai/src/components/seo/`
  - `JsonLd.tsx`: Server component rendering `<script type="application/ld+json">`
  - `Breadcrumbs.tsx`: Visual breadcrumbs matching schema
  - `CodeBlock.tsx`: Syntax highlighted code snippet with copy button
  - `ProgrammaticLayout.tsx`: Shared dark-glass layout for programmatic pages
- `ai/src/app/`
  - `sitemap.ts`: Dynamic multi-tier XML sitemap
  - `robots.ts`: Reconciled robots directives
  - `llms.txt/route.ts`: LLM discovery route handler
  - `llms-full.txt/route.ts`: RAG full documentation feed handler
  - `integrations/`: Integrations directory hub and `[slug]/page.tsx`
  - `solutions/`: Solutions directory hub and `[slug]/page.tsx`
  - `compare/`: Comparison directory hub and `[slug]/page.tsx`
  - `templates/`: Templates directory hub and `[slug]/page.tsx`
- `ai/public/`
  - `robots.txt`: Synchronized static mirror of robots.txt
  - `llms.txt`: Static mirror of llms.txt
  - `llms-full.txt`: Static mirror of llms-full.txt

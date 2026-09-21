# TEST READY: Dialix SEO, GEO, AEO, & AI Discovery Verification Suite

The automated End-to-End (E2E) test suite for SEO, GEO, AEO, XML sitemaps, robots.txt, Schema.org JSON-LD, and LLM standards (`/llms.txt`, `/llms-full.txt`) is ready and operational.

---

## 1. Test Suite Deliverables

- **Executable Test Runner**: `ai/scripts/verify-seo.mjs`
- **Architecture & Coverage Documentation**: `TEST_INFRA.md`
- **Runtime Dependencies**: Zero external dependencies (runs directly on native Node.js 20+ / 24+ ESM).

---

## 2. Current Baseline Results (Milestone M1)

Running `node ai/scripts/verify-seo.mjs --milestone=m1` produces:

```text
============================================================
   Dialix SEO, GEO, AEO, & AI Discovery E2E Verification    
============================================================
  Execution Mode : STATIC INSPECTION
  Milestone Filter: M1
  
=== TIER 1: Feature Coverage (Core Requirements in Isolation) ===
  [PASS] T1 [M1] T1.1_ROBOTS_TXT_STATUS: robots.txt configuration file exists in project
  [PASS] T1 [M1] T1.2_ROBOTS_TXT_AI_AGENTS: robots.txt permits major AI bots (GPTBot, Claude-Web, PerplexityBot, Google-Extended)
  [PASS] T1 [M1] T1.3_ROBOTS_TXT_DISALLOW: robots.txt disallows /dashboard and /api routes
  [PASS] T1 [M1] T1.4_ROBOTS_TXT_SITEMAP_DIRECTIVE: robots.txt declares canonical sitemap (https://www.inteldialix.online/sitemap.xml)
  [PASS] T1 [M1] T1.5_ROBOTS_TXT_NO_CONFLICT: robots.txt has no stale domain shadowing conflicts between public/ and app/
  [PASS] T1 [M1] T1.6_SITEMAP_XML_STATUS: sitemap generator exists in ai/src/app/sitemap.ts
  [PASS] T1 [M1] T1.7_SITEMAP_CANONICAL_DOMAIN: All sitemap URLs use canonical domain (https://www.inteldialix.online)
  [PASS] T1 [M1] T1.8_SITEMAP_AUTH_EXCLUSIONS: sitemap.xml omits noindexed auth routes (/login, /signup, /dashboard)
  [PASS] T1 [M1] T1.9_SITEMAP_CORE_PAGES: sitemap.xml includes all core marketing pages

=== TIER 2: Boundary & Corner Cases ===
  [SKIP] T2 [M1] T2.2_TRAILING_SLASH_HANDLING: Trailing slash handling resolves cleanly without crash
  [PASS] T2 [M1] T2.4_ISO8601_TIMESTAMP_VALIDITY: All sitemap timestamps conform to ISO 8601 and represent valid non-future dates

=== TIER 3: Cross-Feature Combinations & Consistency ===
  [SKIP] T3 [M1] T3.1_SITEMAP_CANONICAL_CONSISTENCY: Sitemap vs canonical tag validation

============================================================
  Total Tests Run : 12
  Passed          : 10
  Failed          : 0
  Skipped/Pending : 2
============================================================
Status: ALL EXECUTED TESTS COMPLIANT WITH SPECIFICATION
```

---

## 3. How to Execute Tests by Milestone

As each milestone worker completes their work, the team can verify compliance immediately:

| Milestone | Command | What It Verifies |
|-----------|---------|------------------|
| **M1: Robots & Sitemap** | `node ai/scripts/verify-seo.mjs --milestone=m1` | Permitted AI bots, canonical sitemap directive, no stale `dialix.ai` domains, auth routes (`/login`, `/signup`) omitted from sitemap. |
| **M2: Programmatic Hubs & Pages** | `node ai/scripts/verify-seo.mjs --milestone=m2` | Directory hubs (`/integrations`, `/solutions`, `/compare`, `/templates`), 404 responses for invalid slugs, GEO/AEO direct answers. |
| **M3: Schema.org JSON-LD** | `node ai/scripts/verify-seo.mjs --milestone=m3` | `@graph` generator with `Organization`, `SoftwareApplication`, `BreadcrumbList`, and `FAQPage`. Verifies zero null or undefined fields. |
| **M4: LLM Standards** | `node ai/scripts/verify-seo.mjs --milestone=m4` | `/llms.txt` and `/llms-full.txt` markdown formatting, platform summary, technical documentation depth, internal link validation. |
| **M5: Production E2E** | `node ai/scripts/verify-seo.mjs` | Full 4-tier suite testing across live or built endpoints, including simulated AI crawlers (Perplexity, GPTBot, Claude-Web, Gemini). |

---

## 4. Test Reporting Options

- **Terminal Pretty Print**: `node ai/scripts/verify-seo.mjs`
- **Markdown Report**: `node ai/scripts/verify-seo.mjs --markdown`
- **JSON Data**: `node ai/scripts/verify-seo.mjs --json`
- **Stop on Failure**: `node ai/scripts/verify-seo.mjs --bail`
- **Verbose Diagnostics**: `node ai/scripts/verify-seo.mjs --verbose`

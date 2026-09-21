# Dialix SEO, GEO, AEO, and AI Discovery Test Infrastructure

Welcome to the automated End-to-End (E2E) verification suite for Dialix. 

## What Is This Test Suite and Why Does It Exist?

Think of search engines and AI assistants like tourists exploring a new city. 
- **`robots.txt`** is like the city guidebook map rules, telling friendly tour guides (like Google, ChatGPT, and Claude) which public monuments they can visit and which private government facilities (like our `/dashboard` or `/api`) are off-limits.
- **`sitemap.xml`** is like an official city registry that lists every single public landmark so visitors don't miss anything.
- **`Schema.org JSON-LD`** is like clear labels and museum plaques that translate our web pages into structured knowledge that computers can easily understand.
- **`/llms.txt` and `/llms-full.txt`** are like an executive summary and encyclopedia prepared specifically for Artificial Intelligence models to quickly learn who Dialix is, how fast our voice agents are (sub-200ms latency), and how to connect to our platform.

This test runner operates like a **mystery shopper**: it interacts with our site from the outside (an "opaque box"), sending real requests and inspecting the answers just like an AI crawler or search engine would.

---

## 4-Tier Test Architecture

The verification runner (`ai/scripts/verify-seo.mjs`) implements four distinct testing tiers:

```
+-------------------------------------------------------------------------+
|                  DIALIX 4-TIER E2E VERIFICATION SUITE                   |
+-------------------------------------------------------------------------+
|  Tier 1: Feature Coverage (Core Requirements in Isolation)              |
|  - robots.txt permissions & sitemap directive                           |
|  - sitemap.xml structure, canonicals, & auth route exclusions           |
|  - /llms.txt & /llms-full.txt standard compliance                      |
|  - Schema.org JSON-LD @graph entities (Org, App, Breadcrumbs, FAQs)     |
|  - Programmatic directory hubs (/integrations, /solutions, etc.)        |
+-------------------------------------------------------------------------+
|  Tier 2: Boundary & Corner Cases                                        |
|  - Non-existent dynamic slugs correctly return HTTP 404                 |
|  - Trailing slash resolution (/pricing/ -> 200 or 308 redirect)         |
|  - Zero null, undefined, or empty string values in structured schemas   |
|  - Strict ISO 8601 timestamp validity (no invalid or future dates)      |
|  - GEO/AEO direct answer word-count & factual density (20-120 words)    |
+-------------------------------------------------------------------------+
|  Tier 3: Cross-Feature Combinations & Consistency                       |
|  - Sitemap <loc> matches rendered HTML canonical tag byte-for-byte      |
|  - Every internal link in /llms.txt exists in sitemap & returns 200     |
|  - /llms.txt never links to disallowed auth or dashboard routes        |
|  - Schema.org FAQPage questions match visible accordion text 1:1        |
+-------------------------------------------------------------------------+
|  Tier 4: Real-World AI Discovery Scenarios (Simulated AI Crawlers)      |
|  - PerplexityBot crawler emulation                                      |
|  - OpenAI GPTBot crawler emulation                                      |
|  - Anthropic Claude-Web crawler emulation                               |
|  - Google-Extended & Applebot-Extended crawler emulation                |
|  - Initial server-rendered HTML contains hard performance benchmarks    |
+-------------------------------------------------------------------------+
```

---

## How to Run the Tests

The test runner is completely self-contained in Node.js ESM. It requires **zero third-party dependencies** and runs on any standard Node.js or Bun installation.

### Quick Start
From the project root:
```bash
# Run the complete test suite (auto-detects live server or static fallback)
node ai/scripts/verify-seo.mjs
```

Or from the `ai/` folder:
```bash
node scripts/verify-seo.mjs
```

### Progressive Milestone Testing
During development, implementers can test their specific milestone without failing on unbuilt downstream features:

```bash
# Test Milestone 1 (Robots, Sitemap baseline, Canonicals)
node ai/scripts/verify-seo.mjs --milestone=m1

# Test Milestone 2 (310 Programmatic Pages & Keyword Registries)
node ai/scripts/verify-seo.mjs --milestone=m2

# Test Milestone 3 (Schema.org @graph JSON-LD Generator)
node ai/scripts/verify-seo.mjs --milestone=m3

# Test Milestone 4 (LLM Standards: /llms.txt & /llms-full.txt)
node ai/scripts/verify-seo.mjs --milestone=m4

# Test Milestone 5 (Production Build & AI Crawler E2E Integration)
node ai/scripts/verify-seo.mjs --milestone=m5
```

### Filtering by Tier or Feature
```bash
# Run only Tier 1 (Feature Coverage)
node ai/scripts/verify-seo.mjs --tier=1

# Run Tiers 1 and 2
node ai/scripts/verify-seo.mjs --tier=1,2

# Test a specific feature
node ai/scripts/verify-seo.mjs --feature=robots
node ai/scripts/verify-seo.mjs --feature=sitemap
node ai/scripts/verify-seo.mjs --feature=llms
node ai/scripts/verify-seo.mjs --feature=schema
node ai/scripts/verify-seo.mjs --feature=programmatic
node ai/scripts/verify-seo.mjs --feature=crawlers
```

### Testing Against Live or Staging Servers
```bash
# Test local dev server on port 3000
node ai/scripts/verify-seo.mjs --url=http://localhost:3000

# Test production deployment
node ai/scripts/verify-seo.mjs --url=https://www.inteldialix.online
```

### Machine-Readable Reporting (CI/CD)
```bash
# JSON output for automated pipelines
node ai/scripts/verify-seo.mjs --json

# Markdown output for pull request comments
node ai/scripts/verify-seo.mjs --markdown
```

---

## Authoritative Specifications & Invariants

| Invariant | Authoritative Requirement | Rationale |
|-----------|---------------------------|-----------|
| **Base Domain** | `https://www.inteldialix.online` | Dialix production canonical domain. Never use `dialix.ai` or `localhost` in production metadata. |
| **AI Bot Permissions** | Explicit `Allow: /` for `GPTBot`, `Claude-Web`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended` | Ensures Dialix voice AI benchmarks are indexed and cited by modern LLMs and search engines. |
| **Protected Directives** | `Disallow: /dashboard/` and `Disallow: /api/` | Safeguards private administrative control panels and internal API endpoints from public crawlers. |
| **Sitemap Exclusions** | `/login`, `/signup`, `/dashboard*`, `/api*` | Prevents indexation of login gates and non-canonical pages. |
| **Core Pages** | `/`, `/pricing`, `/about`, `/blog`, `/contact`, `/careers`, `/privacy`, `/terms` | Fundamental marketing pages required for complete site coverage. |
| **Programmatic Scale** | 310 pages (100 Integrations, 100 Solutions, 30 Comparisons, 80 Templates) | Programmatic SEO engine capturing high-intent voice telephony queries. |
| **Schema Integrity** | Linked `@graph` with `Organization`, `SoftwareApplication`, `BreadcrumbList`, `FAQPage` | Required for Google Rich Snippets and SERP breadcrumb displays. Zero null/undefined values allowed. |
| **LLM Standards** | `/llms.txt` and `/llms-full.txt` (both Route Handlers and static `public/` files) | Direct machine discovery for RAG and autonomous AI agents. |

---

## Dual Mode Execution: Live vs. Static

The test runner intelligently detects its environment:
1. **Live HTTP Mode**: When a server is running at the target URL (`http://localhost:3000` or production), the test runner conducts true network requests. It validates HTTP status codes, headers (e.g. `Content-Type`), rendered HTML tags, and simulated AI crawler responses.
2. **Static Inspection Mode**: When no live server is reachable (such as during pre-build checks or offline authoring), the runner inspects `public/`, `src/app/`, and `src/data/` files directly. It validates syntax, regex patterns, date structures, and file locations without throwing connection errors.

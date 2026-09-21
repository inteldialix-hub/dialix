# Original User Request

## 2026-09-13T00:55:39Z

Implement production-ready capabilities for Dialix voice AI SaaS: Live Provider Sync, Agent Knowledge Base & Tools, Settings Suite, Campaign Dialing Worker, and Real-Time Error Telemetry with AI Bug Tracking.

Working directory: c:\Users\ITASH\OneDrive\Desktop\dialix 3
Integrity mode: development

## Requirements

### R1. Live Provider Synchronization
- Maintain bidirectional state between Dialix and voice provider APIs (ElevenLabs, Vapi, Gemini).
- When an agent is opened or when the user clicks "Sync with Provider", fetch the live configuration directly from the provider API.
- Any changes saved in Dialix must be immediately pushed to the provider API.

### R2. Native Agent Knowledge Base & Tools
- Support document uploads (PDF, TXT, DOCX) and website documentation URLs passed natively to the provider's Knowledge Base API (ElevenLabs `/v1/convai/knowledge-base` or Vapi `/file`).
- Support live calling tools: pre-built action templates (Transfer Call, End Call) and custom webhook tools passed natively to provider prompt tools (`conversation_config.agent.prompt.tools` or Vapi `model.tools`).
- Manage both directly inside the Agent edit page (`/dashboard/agents/[id]`).

### R3. Settings Dashboard Suite
- Team Management: Invite team members, select roles (Owner, Admin, Manager, Viewer), list active members, and generate direct copyable invite links.
- API Keys: List active keys, create new API key with granular scopes, and revoke keys.
- Webhooks: List customer webhook endpoints, subscribe to events, and test ping.
- System Health: View captured runtime errors and their resolution status.

### R4. Automated Campaign Dialing Worker
- Server-side in-process background worker running on the Node.js backend.
- Monitors running campaigns, checks allowed calling hours and days, enforces concurrency limits (max concurrent active calls), and checks DNC suppression.
- Dials contacts via provider outbound APIs and updates campaign counters (`calls_completed`, `calls_answered`).

### R5. Real-Time Error Telemetry & AI Bug Tracking
- Global UI crash catcher (React Error Boundary + `window.onerror` + unhandled rejection listeners) that intercepts errors and reports them to `POST /api/telemetry/errors`.
- Backend logs errors to database and appends to an actionable `agent_bug_inbox.json` file for the agent team to review and fix automatically.

## Acceptance Criteria

### Build & Integrity
- [ ] Next.js frontend builds cleanly (`npm run build` in `ai/`) with 0 errors.
- [ ] Backend starts cleanly and health check `/api/health` returns status `ok`.
- [ ] Database migrations execute safely on both SQLite and PostgreSQL.

### Agent Knowledge & Tools
- [ ] "Sync with Provider" button refreshes agent configuration from provider API.
- [ ] Knowledge files and URLs can be attached to agents.
- [ ] Tool calling configurations are saved and passed to provider API.

### Settings & Team
- [ ] Team invite generates an instant copyable link.
- [ ] API keys can be created, displayed once, and revoked.
- [ ] Webhook subscriptions can be created and viewed.

### Campaign Dialing
- [ ] Running campaigns automatically dial queued contacts during allowed hours without exceeding concurrency limits.
- [ ] Contacts marked as DNC are skipped.

### Error Telemetry
- [ ] Frontend errors are caught and logged to `POST /api/telemetry/errors` and recorded in `agent_bug_inbox.json`.

## 2026-09-13T03:06:20Z

Unify and elevate the entire Dialix dashboard UI into a cohesive, museum-grade voice AI command center inspired by 21st.dev, ElevenLabs, and Linear dark-glass aesthetics. Standardize all buttons, search inputs, data grids, cards, status pills, and tab navigations across every dashboard page (`/dashboard`, `/dashboard/agents`, `/dashboard/agents/[id]`, `/dashboard/campaigns`, `/dashboard/contacts`, `/dashboard/history`, `/dashboard/billing`, `/dashboard/settings`, `/dashboard/phone-numbers`) to establish a single, consistent design language.

Working directory: c:\Users\ITASH\OneDrive\Desktop\dialix 3
Integrity mode: development

## Requirements

### R1. Unified Design Tokens & Base Components (`ai/src/styles/dashboard.css`)
- Reconcile and clean up duplicate and conflicting CSS declarations in `dashboard.css` (e.g. duplicate `.form-input` definitions, inconsistent button declarations).
- Standardize the primary, secondary, ghost, and danger button styles:
  - Height & padding: consistent compact sizing (36px default height, 8px 16px padding, 5px 12px for `.btn-sm`).
  - Tactile micro-interactions: smooth 150ms transitions, subtle hover luminescence, and active scale-down (`active:scale-[0.98]`).
  - Color harmony: crisp white-on-dark primary buttons, frosted semi-transparent glass secondary buttons with subtle 1px border (`border-white/[0.08]`).
- Standardize all search inputs and filter controls:
  - Dedicated search input container with guaranteed 38px left padding for the icon, matching height, frosted dark background (`bg-input`), and subtle accent focus glow.

### R2. Global Tab & Navigation Harmonization
- Replace differing tab designs (`.config-tab`, `.analysis-tab`, inline-styled tab buttons) with a standardized segmented pill tab component:
  - Consistent padding, smooth hover feedback, and unified active indicator.
  - Apply across Settings, Agent Edit (`/dashboard/agents/[id]`), Call History (`/dashboard/history`), and Admin Pricing.

### R3. Card Grids & Metric Displays (21st.dev Aesthetic)
- Upgrade stat cards across `/dashboard`, `/dashboard/campaigns`, and `/dashboard/billing`:
  - Frosted dark glass container with 1px border (`border-white/[0.08]`) and subtle inner highlight (`shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`).
  - Clear typographic hierarchy: subdued uppercase label, bold prominent metric value, and auto-sized compact trend pill badges (`align-self: flex-start`).
  - Responsive grid layouts with balanced gaps (`gap-4` or `gap-6`) across all breakpoints.

### R4. Table, List & Empty State Consistency
- Standardize data table containers across Contacts, Audit Logs, History, and API Keys:
  - Consistent header row height, uppercase subtle typography (`text-xs font-semibold tracking-wider text-secondary`), crisp row divider borders, and hover highlighting.
  - Unified empty-state component layout with centered muted icon, clear heading, brief explanation, and primary call-to-action button.

### R5. Autonomous Browser & Visual Verification
- Use Playwright browser automation to screenshot and visually inspect all 9 dashboard pages.
- Verify zero visual overlap, no misaligned search icons, no broken tab states, and zero console errors.
- Ensure `npm run build` in `ai/` compiles with 0 errors.

## Acceptance Criteria

### Visual & Component Consistency
- [ ] Every button across all 9 dashboard views matches the unified `.btn`, `.btn-primary`, and `.btn-secondary` specifications.
- [ ] Every search input has 38px icon clearance, consistent height, and matching focus glow.
- [ ] All tab bars (Settings, Agent Editor, History) use the identical segmented pill style.
- [ ] Stat cards on `/dashboard`, `/campaigns`, and `/billing` have identical padding, border treatment, and compact badges.

### Quality & Anti-Slop
- [ ] No stretched 100%-width trend badges or clunky rectangular banners.
- [ ] Clean typographic hierarchy adhering to anti-slop principles (no sterile generic placeholders, no conflicting font sizes).
- [ ] Consistent dark-glass surface treatments (`bg-[#0a0a0a]` / `bg-[#111317]` with `border-white/[0.08]`).

### Build & Telemetry
- [ ] Next.js production build (`npm run build` in `ai/`) succeeds with 0 errors.
- [ ] All pages load without console errors in production deployment.
- [ ] Playwright visual screenshots verify layout integrity across all pages.

## 2026-09-20T23:10:07Z

Build an enterprise-grade SEO, GEO (Generative Engine Optimization), AEO (Answer Engine Optimization), and Programmatic AI discovery architecture for Dialix (https://www.inteldialix.online). Target the complete spectrum of AI telephony keywords (n8n, OpenAI, ChatGPT, LLMs, model training/fine-tuning, voice agents, call automation), support scalable programmatic page generation (up to 300+ keyword-targeted integration & solution pages), provide dynamic XML sitemaps for Google Search Console, embed rich JSON-LD schemas, and implement the `/llms.txt` standard for AI engines.

Working directory: `c:\Users\ITASH\OneDrive\Desktop\dialix 3\ai`
Integrity mode: development

## Requirements

### R1. Dynamic XML Sitemap & Search Console Indexing
- Generate a dynamic, multi-tier XML sitemap (`/sitemap.xml` / sitemap index) that automatically indexes all core static pages and any programmatically generated landing pages (scalable up to hundreds of URLs).
- Each sitemap entry must include valid ISO 8601 `lastmod`, optimal `changefreq`, accurate `priority`, and absolute canonical production URLs (`https://www.inteldialix.online/...`).
- Configure `/robots.txt` to point to the sitemap index, permit legitimate AI crawlers (GPTBot, Claude-Web, PerplexityBot, Google-Extended), and disallow private dashboard and API endpoints.

### R2. Programmatic AI Keyword & Integration Architecture (Scalable to 300+ Pages)
- Build a programmatic routing and metadata system targeting high-intent AI and telephony keywords:
  - Tool & Framework Integrations: n8n Voice AI workflows, Zapier telephony, Make.com, LangChain, CrewAI, AutoGen.
  - Model Providers: OpenAI / ChatGPT real-time audio, Anthropic Claude voice assistants, Google Gemini 3.8 Live agents, ElevenLabs conversational AI, Deepgram, Vapi.
  - Telephony Use Cases: Inbound customer support, outbound qualification, appointment booking, debt collection, real estate lead triage, healthcare intake, 24/7 AI receptionist.
- Ensure every programmatic page has unique, high-value content: distinct value propositions, workflow architecture diagrams, feature comparison tables, FAQ sections, and technical specifications to prevent duplicate content penalties.

### R3. Schema.org Structured Data (JSON-LD) for Google Rich Results
- Implement automated `@graph` JSON-LD structured data on all pages:
  - `Organization`: Dialix identity, logo, verified contact points, sameAs social links.
  - `SoftwareApplication`: Voice AI Agent Platform, operating systems, feature list, rating, pricing tiers.
  - `FAQPage`: Rich snippet Q&A pairs for both Google search accordions and LLM extraction.
  - `BreadcrumbList`: Structural hierarchy for clean SERP navigation breadcrumbs.
  - `TechArticle` / `WebPage`: Entity-rich metadata referencing AI keywords, models, and protocols.

### R4. GEO (Generative Engine Optimization) & AEO (Answer Engine Optimization)
- Format page content specifically to be cited and quoted by AI answer engines (Perplexity, ChatGPT Search, Gemini, Claude):
  - Inverted pyramid structure: direct, factual answers in the first 2-3 sentences of each section.
  - Comparison matrices (Dialix vs traditional IVR vs Twilio custom code vs Retell vs Vapi).
  - Concrete technical statistics and benchmarks (latency, uptime, supported languages, voice codecs).
  - Entity optimization establishing Dialix as the authoritative entity for enterprise voice AI and automated phone agents.

### R5. LLM Standards (`/llms.txt` & `/llms-full.txt`)
- Serve `/llms.txt` adhering to the official standard: concise, high-density markdown summary of Dialix, architecture, APIs, capabilities, supported LLM providers, and primary documentation links.
- Serve `/llms-full.txt`: comprehensive documentation feed optimized for RAG embeddings and LLM ingestion.

## Acceptance Criteria

### Technical & Sitemap Verification
- [ ] `/sitemap.xml` returns valid XML (HTTP 200) listing all static and programmatic URLs with valid `<loc>`, `<lastmod>`, `<changefreq>`, and `<priority>`.
- [ ] `/robots.txt` returns HTTP 200 with proper `Sitemap:` directive and AI bot permissions.
- [ ] All programmatic routes render successfully with distinct HTTP 200 status codes and unique metadata.

### Schema & Search Validation
- [ ] JSON-LD markup on core and programmatic pages parses as valid JSON with no missing required fields (`Organization`, `SoftwareApplication`, `FAQPage`, `BreadcrumbList`).
- [ ] Every page includes valid canonical tags pointing to `https://www.inteldialix.online/...`.

### AI & LLM Discovery Verification
- [ ] `/llms.txt` returns HTTP 200 with formatted markdown summarizing the platform and linking key endpoints.
- [ ] `/llms-full.txt` returns HTTP 200 with full technical documentation for LLM context retrieval.
- [ ] Next.js application builds cleanly (`npx next build`) with zero compilation or TypeScript errors.


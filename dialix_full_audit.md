# Dialix Platform — Full Audit Report

> **Date:** April 27, 2026  
> **Scope:** Dashboard, Landing Page, Backend API, Design System, Performance & Features  
> **Status:** Live at `https://dialix-frontend.fly.dev/`

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Design Audit — Dashboard](#design-audit--dashboard)
3. [Design Audit — Landing Page](#design-audit--landing-page)
4. [Feature Audit — New Features to Add](#feature-audit--new-features-to-add)
5. [Optimization & Debugging Audit](#optimization--debugging-audit)
6. [Premium Polish Items](#premium-polish-items)
7. [Priority Roadmap](#priority-roadmap)

---

## Executive Summary

Dialix is a voice AI platform powered by ElevenLabs. The codebase is well-structured — a Next.js 15 frontend with a standalone Express.js backend using SQLite. The dashboard already has strong functionality (agent CRUD, 8-tab config, test calls via WebSocket, call history, phone number management, webhooks, CSV/PDF export). The landing page has 15+ sections and multiple static info pages.

**The main gaps are in two areas:**
1. **Premium polish** — the dashboard feels functional but not *premium*. Small design tweaks will make it feel world-class.
2. **Missing features** — there's no analytics timeline, no real-time call monitoring, limited settings page, and no knowledge base management.

---

## Design Audit — Dashboard

### 🟢 What's Working Well
| Area | Detail |
|------|--------|
| **Design tokens** | Strong CSS variable system (`--accent`, `--bg-*`, `--text-*`, `--ease-spring`) in `dashboard.css` |
| **Agent detail** | 8-tab config is feature-rich and well-organized |
| **Test call modal** | Beautiful gradient avatar with real-time transcript |
| **Toast system** | Clean notification pattern with `ToastProvider` |
| **Skeleton loading** | Good use of skeleton states for perceived performance |
| **Dark theme** | Consistent dark-mode-first design with good contrast |

### 🟡 Needs Improvement

#### 1. Settings Page — Too Bare (Critical)
> [!WARNING]
> The Settings page only shows: System Status dot, Name/Email/Role, and an About blurb. This is **far below production quality** for a SaaS dashboard.

**What to add:**
- Change password section
- API key management (generate/revoke/copy)
- Notification preferences (email on call failure, daily digest)
- Theme toggle (dark/light)
- Billing/usage section (or a placeholder)
- Account deletion with confirmation

#### 2. Dashboard Home — No Time-Series Analytics
The home page has stat cards (Total Agents, Calls, Success Rate, Avg Duration, Quality) and a Doughnut chart. But there are **no time-series charts** — you can't see trends.

**What to add:**
- A 7-day / 30-day line chart of calls over time
- Success rate trend line
- Agent performance comparison bar chart
- Date range picker for all analytics

#### 3. Stat Cards — Missing Comparison Data
The stat cards show flat numbers with static "Good/Stable/Low" labels. A premium dashboard shows **period-over-period comparison** (e.g., "+12% vs last week").

#### 4. Sidebar — No Active Agent Indicator
The sidebar doesn't show if any agents are currently on calls. A small green dot or "1 active" badge would add real-time awareness.

#### 5. Agent List — Lacks Status & Quick Actions
The agent list shows name, language, and model. Missing:
- Agent status indicator (active/inactive/error)
- Last call timestamp
- Quick action buttons (duplicate, delete) without needing to open the agent

#### 6. Call History Page — No Filtering
The history page (735 lines) renders a list of calls but lacks:
- Filter by agent
- Filter by status (success/failed/ongoing)
- Filter by date range
- Search by lead name or phone number

#### 7. Phone Numbers — No Validation Feedback
The "Add Number" form doesn't validate phone number format before submission. Adding a quick regex check would prevent bad API calls.

#### 8. Dashboard Data Fetching — No Caching
```
// Current pattern in dashboard/page.tsx:
Promise.all([
  api('/stats', { token }),
  api('/calls/analytics', { token }),
  api('/webhooks', { token })
])
```
Each page load re-fetches everything. No SWR or React Query caching. This causes unnecessary loading spinners on back-navigation.

#### 9. Agent Detail — 906 Lines, Needs Splitting
[agents/[id]/page.tsx](file:///c:/Users/ITASH/OneDrive/Desktop/dialix%203/ai/src/app/dashboard/agents/%5Bid%5D/page.tsx) is 906 lines. The test call logic (WebSocket, mic setup, audio processing) should be extracted into:
- `useTestCall.ts` — custom hook for all test call state + WebSocket
- `TestCallModal.tsx` — extracted UI component
- `VoicePickerSection.tsx` — voice grid with search/preview

#### 10. Inconsistent API Usage
In `dashboard/page.tsx`, the webhook and export functions use raw `fetch()` instead of the `api()` helper:

```diff
- const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/webhooks`, { ... });
+ const data = await api('/webhooks', { token, method: 'POST', body: { event, url, secret } });
```

This inconsistency means error handling differs between pages.

---

## Design Audit — Landing Page

### 🟢 What's Working Well
| Area | Detail |
|------|--------|
| **Section variety** | 15+ sections with strong visual hierarchy |
| **Animations** | `framer-motion` used for entrance animations |
| **Design system** | Premium CSS tokens (`hero-gradient`, `dot-grid`, `card-bezel`) |
| **Header** | Conditional Login/Dashboard button based on auth state |
| **Footer** | 6 link categories with working routes to `/about`, `/blog`, etc. |
| **SEO pages** | `/about`, `/contact`, `/blog`, `/careers`, `/privacy`, `/terms` all in place |

### 🟡 Needs Improvement

#### 1. HeroSection — 45KB / Potentially Heavy
[HeroSection.tsx](file:///c:/Users/ITASH/OneDrive/Desktop/dialix%203/ai/src/components/HeroSection.tsx) is 45KB. This likely contains inline SVGs or heavy animation definitions. It should be:
- Code-split if it contains large animation configs
- Images lazy-loaded with `next/image`
- SVGs extracted to separate files or sprite sheet

#### 2. CaseStudySection — Placeholder Data
The case study section should either link to real cases or be removed until real data is available (same approach we took with "Trusted by" section).

#### 3. TestimonialsSection — Needs Real Attribution
Testimonials without real names/companies/photos feel fake. Either use real quotes from beta users or replace with a "Join our beta" CTA.

#### 4. Contact Form — Not Connected
The `/contact` page has a form but it doesn't actually send emails. Need to connect it to:
- A Resend/SendGrid email handler
- Or at minimum, a mailto: fallback

#### 5. Blog Page — Static Content
The `/blog` page has hardcoded articles. For long-term maintainability, consider:
- Markdown-based blog posts in `/content/` folder
- Or a simple CMS integration (Contentful, Sanity)

#### 6. No Open Graph / Social Preview Images
Missing `og:image` meta tags. When shared on LinkedIn/Twitter, the preview will be blank.

#### 7. Missing `robots.txt` and `sitemap.xml`
These are essential for SEO crawling. Next.js can auto-generate these.

---

## Feature Audit — New Features to Add

### 🔥 High Priority (Revenue Impact)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 1 | **Knowledge Base Manager** | Let users upload docs/URLs that agents reference during calls. The backend already supports ElevenLabs knowledge base API. | Medium |
| 2 | **Real-Time Call Monitor** | Live dashboard showing currently active calls with waveform, transcript streaming, and ability to listen in. | High |
| 3 | **Agent Cloning** | "Duplicate" button on agent list to clone an existing agent config. Saves massive setup time. | Low |
| 4 | **Webhook Logs** | Show delivery history for webhooks (success/fail, response time, payload). Currently webhooks are fire-and-forget. | Medium |
| 5 | **API Key Management** | Settings page for generating/revoking API keys. Currently the only auth is JWT login. | Medium |

### 🟡 Medium Priority (UX Improvement)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 6 | **Time-Series Analytics** | Line charts for calls/day, success rate over time, agent performance trends. Use Chart.js `Line` chart. | Medium |
| 7 | **Call History Filters** | Filter by agent, status, date range. Search by lead name. | Low |
| 8 | **Agent Status Badges** | Show if an agent is active (currently on a call), idle, or has errors. | Low |
| 9 | **Notification Preferences** | Email alerts for failed calls, daily summary, usage thresholds. | Medium |
| 10 | **Bulk Actions** | Multi-select agents or calls for batch operations (delete, export). | Low |

### 🟢 Nice-to-Have (Polish)

| # | Feature | Description | Complexity |
|---|---------|-------------|------------|
| 11 | **Onboarding Tour** | First-time user guided tour of the dashboard (using `react-joyride` or custom). | Low |
| 12 | **Command Palette** | `Cmd+K` search to jump to any agent, page, or action. | Medium |
| 13 | **Dark/Light Theme** | Theme toggle in settings (currently dark-mode only). | Low |
| 14 | **Keyboard Shortcuts** | `N` for new agent, `S` to save, `Esc` to close modals. | Low |
| 15 | **Activity Log** | Full audit trail: who changed what agent config, when. | Medium |

---

## Optimization & Debugging Audit

### 🐛 Bugs & Issues Found

#### Bug 1: Inconsistent `fetch` vs `api()` usage
**File:** [dashboard/page.tsx](file:///c:/Users/ITASH/OneDrive/Desktop/dialix%203/ai/src/app/dashboard/page.tsx#L100-L181)  
**Issue:** Webhook CRUD and export functions use raw `fetch()` while all other pages use the `api()` helper. This means:
- Error messages won't match (raw `fetch` throws different errors)
- No centralized error handling
- API base URL must be duplicated

**Fix:** Replace all raw `fetch` calls with the `api()` helper.

#### Bug 2: Memory leak in agent detail test call
**File:** [agents/[id]/page.tsx](file:///c:/Users/ITASH/OneDrive/Desktop/dialix%203/ai/src/app/dashboard/agents/%5Bid%5D/page.tsx#L183-L191)  
**Issue:** `doCleanup()` is called manually but there's no `useEffect` cleanup. If the user navigates away during an active test call:
- WebSocket stays open
- Audio contexts stay allocated
- Timer keeps running

**Fix:** Add `useEffect(() => doCleanup, [])` as a cleanup return.

#### Bug 3: Settings page bypasses `api()` helper
**File:** [settings/page.tsx:12](file:///c:/Users/ITASH/OneDrive/Desktop/dialix%203/ai/src/app/dashboard/settings/page.tsx#L12)
```typescript
fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/health`)
```
Should use the `api()` helper for consistency.

#### Bug 4: No token expiry handling
**File:** [auth-context.tsx](file:///c:/Users/ITASH/OneDrive/Desktop/dialix%203/ai/src/lib/auth-context.tsx)  
**Issue:** JWT tokens are stored in localStorage and restored on mount, but there's no expiry check. If the token expires, every API call will fail with a 401 but the user still sees the dashboard.

**Fix:** Add a token decode check on mount (decode JWT, check `exp` claim). Add a 401 interceptor in `api.ts` that auto-logs out.

### ⚡ Performance Optimizations

#### Perf 1: No data caching (SWR/React Query)
Every page navigation triggers fresh API calls. Adding `swr` or `@tanstack/react-query` would:
- Cache responses for instant back-navigation
- Enable background revalidation
- Reduce API load by ~60%

#### Perf 2: Agent detail fetches on every tab switch
The agent detail page loads all data upfront (agent config, voices, phone numbers, models). This is fine, but the voice list can be large (200+ voices). Consider:
- Lazy-loading the voice list only when the "Voice" tab is opened
- Virtualizing the voice picker list for 200+ items

#### Perf 3: Chart.js tree-shaking
Currently importing:
```typescript
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
```
This is good (tree-shaken), but if Line charts are added, ensure selective imports continue.

#### Perf 4: HeroSection code splitting
The 45KB HeroSection should be dynamically imported:
```typescript
const HeroSection = dynamic(() => import('@/components/HeroSection'), {
  loading: () => <div className="hero-skeleton" />,
});
```

#### Perf 5: Unused `SmoothScroll.tsx` and `IntroScreen.tsx`
These components exist in `/components/` — verify they're actually imported somewhere, or remove them to reduce bundle size.

### 🔒 Security Observations

| Item | Status | Detail |
|------|--------|--------|
| CSP headers | ✅ Good | Configured in `next.config.js` with proper directives |
| `unsafe-inline` in CSP | ⚠️ Acceptable | Required for Next.js inline styles |
| X-Frame-Options | ✅ DENY | Prevents clickjacking |
| JWT in localStorage | ⚠️ Standard | Consider HttpOnly cookies for higher security |
| No rate limiting mention | ⚠️ Check backend | Verify Express has rate limiting middleware |
| API key management | ❌ Missing | No way for users to generate API keys |

---

## Premium Polish Items

These are small but high-impact changes that make the dashboard feel **premium** rather than **functional**.

### 1. Micro-Interactions
- **Stat cards:** Add a subtle count-up animation when numbers load (e.g., 0 → 47)
- **Agent rows:** Add a soft scale-up on hover (`transform: scale(1.005)`)
- **Save button:** Add a checkmark animation after successful save
- **Tab transitions:** Animate content crossfade between tabs (not just instant swap)

### 2. Typography Hierarchy
- Dashboard headings use the same weight as body text. Add `font-weight: 700` and slight letter-spacing to `h2` in dashboard context.
- Stat card values should use tabular-nums: `font-variant-numeric: tabular-nums;`

### 3. Empty States
The `EmptyState` component is functional but basic. Add:
- A subtle illustration (not just an icon)
- A softer gradient background
- A secondary action link (e.g., "Learn how to create agents →")

### 4. Loading States
Replace the generic skeleton with context-aware loading:
- Dashboard home → stat card skeletons + chart placeholder
- Agent detail → tab-shaped skeleton
- History → table row skeletons with alternating widths

### 5. Breadcrumb Navigation
Agent detail pages show a simple "← Back" button. Replace with breadcrumbs:
```
Dashboard > Agents > Sales Agent
```

### 6. Keyboard Accessibility
- Modals should trap focus
- Tab key should cycle through form fields
- Escape should close any open modal
- Agent rows should be keyboard-navigable

---

## Priority Roadmap

### Phase 1 — Quick Wins (1-2 days)
- [ ] Fix `fetch()` → `api()` inconsistency in dashboard home
- [ ] Add `useEffect` cleanup for test call WebSocket
- [ ] Add token expiry check in auth-context
- [ ] Add `robots.txt` and `sitemap.xml`
- [ ] Add og:image meta tags to all pages
- [ ] Call history filters (agent, status, date range)
- [ ] Agent "Duplicate" button

### Phase 2 — Settings & Polish (2-3 days)
- [ ] Expand Settings page (password, API keys, notifications, theme)
- [ ] Count-up animation on stat cards
- [ ] Breadcrumb navigation in agent detail
- [ ] Improve empty states with illustrations
- [ ] Add stat card period-over-period comparison data

### Phase 3 — Analytics & Features (3-5 days)
- [ ] Time-series analytics (calls/day, success trend)
- [ ] Date range picker for all analytics
- [ ] Knowledge Base management page
- [ ] Webhook delivery logs
- [ ] Real-time call monitoring

### Phase 4 — Premium UX (3-5 days)
- [ ] Install SWR or React Query for data caching
- [ ] Extract test call logic into custom hook + modal component
- [ ] Command palette (Cmd+K)
- [ ] Onboarding tour for new users
- [ ] Dark/Light theme toggle
- [ ] Connect contact form to email service

---

> [!TIP]
> **Biggest bang for your buck:** Phase 1 items are all low-effort, high-impact changes. The Settings page expansion (Phase 2) is the single most important feature gap — every SaaS user expects robust settings.

> [!IMPORTANT]
> **Before starting any features:** Fix the three bugs first (fetch inconsistency, test call cleanup, token expiry). These are production-stability issues that affect all users.

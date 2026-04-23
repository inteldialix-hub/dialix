# Dialix v3 — Version & Progress Tracker

> **Purpose:** This file tracks what's been done, what's in progress, and what's left — so any AI model can pick up exactly where the last one left off.

---

## Project Overview

**Dialix** is a white-label SaaS dashboard for AI calling agents powered by ElevenLabs. It has two parts:

1. **Landing Page** (`ai/`) — Next.js 15 marketing site with Tailwind, Framer Motion, i18n
2. **Dashboard** (`frontend/` + `backend/`) — React SPA + Express API with ElevenLabs integration

**Architecture:** Option A — separate apps. Landing page links to dashboard via URLs.

---

## Tech Stack

| Component | Tech |
|-----------|------|
| Landing page | Next.js 15, Tailwind CSS, Framer Motion, GSAP, i18n |
| Dashboard frontend | React 18 (CDN), vanilla CSS, 187KB single-file `app.js` |
| Dashboard backend | Node.js 20+, Express, helmet, JWT, sql.js, bcryptjs |
| Database | SQLite via sql.js (file-based) |
| External API | ElevenLabs Conversational AI API |

---

## Key Files

| File | What it does |
|------|-------------|
| `backend/server.js` | Express server + helmet + WebSocket proxy for live monitoring |
| `backend/db.js` | SQLite init, schema, seed admin (random password), CRUD helpers |
| `backend/routes/auth.js` | Login + Registration + Change Password (all rate-limited) |
| `backend/routes/agents.js` | Agent CRUD, voice management, test calls, config (with input validation) |
| `backend/routes/phoneNumbers.js` | Phone number registration (admin-aware delete) |
| `backend/routes/calls.js` | Outbound calls + call history |
| `backend/routes/admin.js` | Admin panel (client CRUD, agent assignments) |
| `backend/routes/stats.js` | Dashboard analytics (parallelized, admin-conditional) |
| `backend/middleware/auth.js` | JWT verification middleware |
| `backend/services/elevenlabs.js` | ElevenLabs API wrapper |
| `frontend/app.js` | Entire React SPA (4,490+ lines, single file) |
| `frontend/styles.css` | All dashboard CSS |
| `frontend/index.html` | Dashboard HTML shell |
| `ai/src/components/Header.tsx` | Landing page navbar (env-based dashboard links) |
| `ai/src/components/HeroSection.tsx` | Main hero with interactive demo |
| `ai/src/components/Footer.tsx` | Landing page footer (Dialix branded) |
| `ai/src/components/CTABanner.tsx` | CTA section (linked to signup) |
| `ai/.env.local` | Dashboard URL config |

---

## What's Been Done

### Session 1 (Pre-audit)
- ✅ Full ElevenLabs integration (14 API features)
- ✅ Agent CRUD with full config editing
- ✅ Voice library (own + community) with preview
- ✅ Test call system (signed URL + WebSocket)
- ✅ Live call monitoring via WebSocket proxy
- ✅ Phone number registration (Twilio + SIP)
- ✅ Outbound calls with dynamic variables
- ✅ Admin panel (client management, agent assignments)
- ✅ Dashboard analytics with Chart.js
- ✅ Rate limiting on login (5/15min) and registration (3/hr)
- ✅ Registration API (`POST /api/auth/register`)
- ✅ Stats route parallelized (`Promise.allSettled`)
- ✅ SignUpScreen component + authView routing

### Session 2 — April 17, 2026 (This Session)

#### Phase 1 — Landing Page Rebrand + Link Wiring ✅
- Replaced "SYNTHFLOW" watermark → "DIALIX" in Footer.tsx
- Removed fake compliance badges (SOC 2, HIPAA, GDPR, PCI DSS) → "Enterprise-grade Security"
- Wired Header.tsx: Sign In → dashboard root, Start Now → dashboard?view=signup
- Wired Header.tsx: Contact Sales → mailto:contact@dialix.ai
- Wired mobile menu links similarly
- Wired CTABanner.tsx: Start Free Trial → signup, Book a Demo → mailto
- Created `ai/.env.local` with `NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001`
- Verified: zero "Synthflow" references remaining in source code

#### Phase 2 — Sign Up Frontend ✅
- SignUpScreen already existed (lines 287-410 of app.js)
- Login ↔ Signup switching already worked
- **Added:** URL parameter reading (`?view=signup`) so landing page CTA links auto-show signup form

#### Phase 3 — Security Hardening ✅
- **Installed helmet** — security headers (HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
  - CSP disabled because SPA loads React/Tailwind from CDN
- **Random admin password** — default admin now gets a random 12-char password printed to console
  - Old hardcoded `admin123` is gone
- **must_change_password column** — added to clients table with migration for existing DBs
- **Change password API** — `POST /api/auth/change-password` with current password verification
- **Login response** — now includes `must_change_password` flag
- **Fixed `var` → `const/let`** in agents.js lines 392-397
- **Prompt validation** — 100KB max length check on agent prompt text
- **Temperature validation** — must be between 0 and 2, returns 400 if invalid
- **Moved inline requires** — `require('stream')` and `require('jsonwebtoken')` to top-level imports
- **Admin phone delete** — admins can now delete any phone number, users only their own

#### Phase 4 — Bug Fixes ✅
- **Stats totalClients** — omitted for non-admins instead of showing misleading `0`

---

## What's Left To Do

### Priority: HIGH — Phase 5 New Features
These are the "killer features" from the audit that differentiate Dialix:

1. **Knowledge Base Upload** (~4-6 hours)
   - Backend: `POST/GET/DELETE /api/agents/:agent_id/knowledge-base`
   - Proxy to ElevenLabs `POST /v1/convai/knowledge-base` API
   - Frontend: drag-and-drop upload UI, file list, delete option
   - Add as a new tab in agent detail panel

2. **Conversation Transcript Viewer** (~3-4 hours)
   - Backend: `GET /api/calls/conversation/:conversation_id`
   - Proxy to ElevenLabs conversation detail API
   - Frontend: chat-style transcript panel in call history
   - Show metadata: duration, status, timestamps

### Priority: LOW — Remaining Bug Fixes
- WebSocket origin validation (JWT already protects, so low risk)
- WebSocket cleanup race condition (existing readyState checks are adequate)

### Priority: LOW — Future Enhancements
- Password change modal in frontend (UI for must_change_password flow)
- Async DB writes (replace writeFileSync with debounced async)
- Pin CDN dependency versions
- Mobile responsive dashboard
- Production deployment config (HTTPS, domain setup)

---

## How to Run

```bash
# Backend (port 3001)
cd backend
npm install
cp .env.example .env   # Fill in ELEVENLABS_API_KEY and JWT_SECRET
npm run dev

# Landing page (port 3000)
cd ai
npm install
npm run dev
```

⚠️ **First run:** The admin password is randomly generated and printed to the console.
Save it! You'll need it to log in. Change it via the API or the (upcoming) UI.

---

## Database Schema

```sql
clients: id, name, email, password_hash, is_admin, must_change_password, created_at
client_agents: id, client_id, agent_id, agent_name, can_edit, allowed_features
phone_numbers: id, client_id, elevenlabs_phone_number_id, phone_number, label, provider, assigned_agent_id, created_at
```

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | No | Login (rate-limited) |
| POST | /api/auth/register | No | Register (rate-limited) |
| POST | /api/auth/change-password | Yes | Change password |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/agents | Yes | List agents |
| POST | /api/agents | Yes | Create agent |
| GET | /api/agents/:id | Yes | Agent detail + config |
| PATCH | /api/agents/:id | Yes | Update agent config |
| PATCH | /api/agents/:id/voice | Yes | Change voice |
| GET | /api/agents/:id/test-call/signed-url | Yes | Get signed URL for test call |
| GET | /api/agents/voices | Yes | List voices |
| POST | /api/agents/voices/refresh | Yes | Refresh voice cache |
| POST | /api/agents/voices/add-shared | Yes | Add shared voice |
| GET | /api/agents/voices/:id/preview | Yes | Voice preview audio |
| GET | /api/phone-numbers | Yes | List phone numbers |
| POST | /api/phone-numbers | Yes | Register phone number |
| DELETE | /api/phone-numbers/:id | Yes | Delete phone number (admin-aware) |
| POST | /api/calls/outbound | Yes | Make outbound call |
| GET | /api/calls/history/:agent_id | Yes | Call history |
| GET | /api/stats | Yes | Dashboard stats |
| GET/POST/PATCH/DELETE | /api/admin/* | Admin | Client + agent management |
| WS | /ws?conversation_id=X&token=Y | Admin | Live call monitoring |

---

## Reference Documents

- `dialix_full_audit_v2.md` — Full project audit with all findings
- `dialix-master-plan-v3.md` — Original architecture spec + design system
- `implementation_plan.md` — Current implementation plan (6 phases)
- `CHANGES_SUMMARY.md` — Previous session changes log

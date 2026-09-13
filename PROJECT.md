# Project: Dialix Voice AI SaaS Production Readiness

## Architecture
Dialix is a full-stack Voice AI SaaS platform:
- **Frontend (`ai/`)**: Next.js 15 App Router, React 18, Tailwind CSS, custom dashboard design system (`dashboard.css`). Client-side state managed via React Context. Global error boundary captures runtime crashes and transmits telemetry.
- **Backend (`backend/`)**: Node.js / Express server on port 3001, providing REST APIs and WebSocket audio bridges for ElevenLabs, Vapi, Twilio, and Gemini Live.
- **Database (`backend/db.js`)**: In-process dual-engine database layer supporting SQLite (`sql.js` with file persistence at `backend/dialix.db`) and PostgreSQL (`pg.Pool`).
- **Background Worker (`backend/services/campaign-worker.js`)**: Server-side in-process background worker executing automated outbound dialing with time window filtering, concurrency limits, and DNC suppression.
- **Error Telemetry & Bug Tracking (`backend/routes/telemetry.js`)**: Centralized error ingestion logging to `system_error_logs` in DB and appending structured issues to `agent_bug_inbox.json`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | DB Dual-Engine Compatibility | Fix PostgreSQL seeding (pricing_plans, is_active), `mapQuery` translations (`date_trunc`, `ON CONFLICT`), and add `campaign_id` to `call_history` | M1 | ORIGINAL_REQUEST §Acceptance Criteria |
| 2 | R1: Live Provider Sync Backend | Live bidirectional state synchronization with ElevenLabs, Vapi, and Gemini via `/api/agents/:id/sync` and config push | M2 | ORIGINAL_REQUEST §1 |
| 3 | R1: Live Provider Sync Frontend | "Sync with Provider" button in Agent header bar, visual sync state, and auto-refresh | M2 | ORIGINAL_REQUEST §1 |
| 4 | R2: Agent Knowledge Base Backend | Document uploads (PDF, TXT, DOCX), URL crawling, and provider prompt KB attachment | M2 | ORIGINAL_REQUEST §2 |
| 5 | R2: Agent Tools Backend | Live calling action templates (Transfer Call, End Call) and custom webhook tools passed natively to provider prompt tools | M2 | ORIGINAL_REQUEST §2 |
| 6 | R2: Agent Knowledge & Tools UI | Visible `'knowledge'` and `'tools'` tabs in `/dashboard/agents/[id]` with full document upload and tool creation workflows | M2 | ORIGINAL_REQUEST §2 |
| 7 | R3: Team Management | Multi-role team management (Admin, Member, Viewer), member listing, role updating, and instant copyable invite link generation | M3 | ORIGINAL_REQUEST §3 |
| 8 | R3: API Keys Management | Granular scopes API key generation with modal, one-time raw key display, active keys list, and revoke action | M3 | ORIGINAL_REQUEST §3 |
| 9 | R3: Webhooks Suite | Webhook subscription management, multi-event selection, live test ping button with latency measurement, and event delivery logs | M3 | ORIGINAL_REQUEST §3 |
| 10 | R3: Settings Dashboard UI | Unified multi-tab Settings page (`/dashboard/settings`) integrating Account, Team, API Keys, Webhooks, and System Health | M3 | ORIGINAL_REQUEST §3 |
| 11 | R4: Campaign Dialing Worker | Server-side in-process background worker monitoring campaigns, enforcing allowed hours/days, concurrency limits, DNC suppression, multi-provider dialing | M4 | ORIGINAL_REQUEST §4 |
| 12 | R4: Campaign Routes Async Fix | Add `await` to all DB calls in `backend/routes/campaigns.js`, fix `client_agents` table & `phone_e164` column, string agent IDs, and answered call counter tracking | M4 | ORIGINAL_REQUEST §4 |
| 13 | R4: Campaign Frontend Wizard | Align campaign creation wizard payload in `ai/src/app/dashboard/campaigns/page.tsx` with backend fields | M4 | ORIGINAL_REQUEST §4 |
| 14 | R5: Error Telemetry Pipeline | Global UI crash catcher (`GlobalErrorBoundary`), window.onerror & unhandled rejection listeners posting to `/api/telemetry/errors` | M5 | ORIGINAL_REQUEST §5 |
| 15 | R5: Bug Tracking & Inbox | Backend logs errors to `system_error_logs` and appends to `agent_bug_inbox.json`; System Health UI panel in Settings | M5 | ORIGINAL_REQUEST §5 |
| 16 | Verification & Build Cleanliness | Next.js build (`npm run build` in `ai/`) exits 0; Backend `/api/health` returns ok; Node test suite verifies R1-R5 | M6 | ORIGINAL_REQUEST §Acceptance Criteria |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database & Core Schema Hardening | Fix PostgreSQL seeding, `is_active`, `pricing_plans`, `mapQuery` translations (`date_trunc`, `ON CONFLICT`), `call_history.campaign_id` | none | DONE |
| M2 | R1 Live Sync & R2 Knowledge Base & Tools | Complete provider sync & tools push in backend; add "Sync with Provider", Knowledge Base tab, Tools tab in Agent Details UI | M1 | PLANNED |
| M3 | R3 Settings Dashboard Suite | Normalize backend contracts for team, api-keys, webhooks; implement complete multi-tab Settings UI (Team, Keys, Webhooks, System Health) | M1 | PLANNED |
| M4 | R4 Automated Campaign Dialing Worker | Fix `backend/routes/campaigns.js` async/await, agent_id schema, DNC phone column, `campaign-worker.js` counters; fix frontend wizard payload | M1 | PLANNED |
| M5 | R5 Error Telemetry & AI Bug Tracking | Telemetry payload normalization, `agent_bug_inbox.json` initialization, and System Health UI log inspection | M1, M3 | PLANNED |
| M6 | Comprehensive Verification & Next.js Build | Next.js build fix (`ai/next.config.js` standalone conditionalization), Node test suite for R1-R5, backend health verification | M1, M2, M3, M4, M5 | PLANNED |

---

## Interface Contracts

### Backend ↔ Frontend Contracts
1. **Team Management**:
   - `GET /api/team` -> `{ success: true, team: [...], members: [...], invitations: [...] }`
   - `POST /api/team/invite` -> `{ success: true, invite_url: string, invitation: { ... } }`
2. **API Keys**:
   - `GET /api/api-keys` -> `{ success: true, keys: [...], data: [...] }`
   - `POST /api/api-keys` -> `{ success: true, key: string, raw_key: string, data: { ... } }`
3. **Webhooks**:
   - `GET /api/webhooks` -> `{ success: true, webhooks: [...], subscriptions: [...] }`
   - `POST /api/webhooks` accepts `{ url, events: string[] }` or `{ url, event: string }`
   - `POST /api/webhooks/:id/test` -> `{ success: true, status: number, status_code: number, latency_ms: number, duration_ms: number }`
4. **Telemetry & System Health**:
   - `POST /api/telemetry/errors` accepts both snake_case and camelCase (`stack`, `componentStack`, `userAgent`, `metadata`)
   - `GET /api/telemetry/errors` -> `{ success: true, errors: [...], summary: { total, open, resolved } }`
5. **Campaigns**:
   - `POST /api/campaigns` accepts both snake_case and camelCase fields; supports string `agent_id`
   - `GET /api/campaigns` -> `{ success: true, campaigns: [...], total: number }`

---

## Code Layout
- `backend/server.js`: Server entry point & health check `/api/health`
- `backend/db.js`: Dual-engine database abstraction (SQLite & PostgreSQL)
- `backend/routes/agents.js`: Provider sync, Knowledge Base & Tools endpoints
- `backend/routes/team.js`: Team membership & invitation management
- `backend/routes/api-keys.js`: API key generation & scoping
- `backend/routes/webhooks.js`: Webhook subscriptions & delivery tests
- `backend/routes/campaigns.js`: Campaign lifecycle & contact management
- `backend/routes/telemetry.js`: Telemetry ingestion & bug inbox recording
- `backend/services/campaign-worker.js`: In-process campaign dialing background worker
- `agent_bug_inbox.json`: Repository root AI bug tracking queue
- `ai/next.config.js`: Next.js build configuration & standalone packaging rule
- `ai/src/app/dashboard/agents/[id]/page.tsx`: Agent details page (Sync, Knowledge, Tools)
- `ai/src/app/dashboard/settings/page.tsx`: Settings dashboard suite (Team, Keys, Webhooks, Health)
- `ai/src/app/dashboard/campaigns/page.tsx`: Campaign management & creation wizard
- `ai/src/components/GlobalErrorBoundary.tsx`: Global React crash catcher & telemetry reporter
- `backend/tests/`: Automated test suite verifying R1–R5 functionality

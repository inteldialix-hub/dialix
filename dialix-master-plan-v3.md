# DIALIX v3 — AI Call Center Dashboard
## Master Plan Prompt for Antigravity + Claude Opus

---

## WHAT CHANGED FROM v2

Only the **design section** changed. Architecture, backend, API routes, security rules — all identical to v2.
The new design direction is: **Linear.app clone aesthetic** — dark sidebar + clean content panel, no glows, no gradients, no cyan neon. Professional, dense, credible.

---

## PROJECT OVERVIEW

**Dialix** is a white-label SaaS dashboard for AI calling agents powered by ElevenLabs. The owner pre-creates 4–6 agents in ElevenLabs. Each client logs into Dialix, connects their Twilio or SIP trunk credentials (auto-registered into ElevenLabs via the backend), then manages and calls their agents from the dashboard.

---

## TECH STACK

### Backend — Node.js + Express
- Runtime: Node.js 20+
- Framework: Express.js
- Auth: JWT (jsonwebtoken)
- Database: SQLite via `better-sqlite3`
- Password hashing: `bcryptjs`
- Environment: `.env` for secrets
- CORS: whitelist frontend origin only

### Frontend — React SPA
- React 18 via CDN
- Tailwind CSS via CDN
- Fonts: `Inter` (body) + `JetBrains Mono` (IDs/keys/numbers) via Google Fonts
- No localStorage/sessionStorage — all state in JS memory

### APIs (backend only — never called from browser)
1. ElevenLabs REST API
2. No Twilio SDK
3. No SIP client

---

## BACKEND STRUCTURE

```
backend/
├── server.js
├── .env
├── db.js
├── middleware/auth.js
├── routes/
│   ├── auth.js
│   ├── agents.js
│   ├── phoneNumbers.js
│   ├── calls.js
│   └── admin.js
└── services/elevenlabs.js
```

### .env
```
ELEVENLABS_API_KEY=xi_xxxxxxxxxxxxxxxxxxxx
JWT_SECRET=your_long_random_secret_here
PORT=3001
FRONTEND_URL=http://localhost:3000
```

---

## DATABASE SCHEMA (SQLite)

```sql
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE client_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  UNIQUE(client_id, agent_id)
);

CREATE TABLE phone_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  elevenlabs_phone_number_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  label TEXT NOT NULL,
  provider TEXT NOT NULL,
  assigned_agent_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

IMPORTANT: Never store Twilio auth_token or SIP passwords. Pass through to ElevenLabs, then discard.

---

## BACKEND ROUTES

### POST /api/auth/login
Body: `{ email, password }` → Returns: `{ token, client: { id, name, email, is_admin } }`

### GET /api/auth/me
Headers: `Authorization: Bearer <token>` → Returns current client profile

### GET /api/agents
Returns agents assigned to the current client. For each, fetches live data from ElevenLabs GET /v1/convai/agents/:agent_id.

### GET /api/agents/voices
Fetches GET /v1/voices from ElevenLabs. Cached 10 min in memory.

### PATCH /api/agents/:agent_id/voice
Body: `{ voice_id }` → Verify agent belongs to client → PATCH /v1/convai/agents/:agent_id

### GET /api/phone-numbers
Returns all phone numbers registered by current client from DB.

### POST /api/phone-numbers/twilio
Body: `{ label, phone_number, account_sid, auth_token, phone_number_sid }`
→ POST /v1/convai/phone-numbers with provider "twilio"
→ Store elevenlabs_phone_number_id in DB
→ auth_token is NOT stored

### POST /api/phone-numbers/sip
Body: `{ label, phone_number, termination_uri, username, password, transport }`
→ POST /v1/convai/phone-numbers with provider "sip_trunk"
→ Store elevenlabs_phone_number_id in DB
→ SIP password is NOT stored

### POST /api/phone-numbers/:id/assign
Body: `{ agent_id }` → Verify ownership → PATCH /v1/convai/phone-numbers/:elevenlabs_id → Update DB

### DELETE /api/phone-numbers/:id
Verify ownership → DELETE /v1/convai/phone-numbers/:elevenlabs_id → Delete from DB

### POST /api/calls/outbound
Body: `{ agent_id, phone_number_id, to_number }`
1. Verify agent belongs to client
2. Verify phone_number belongs to client
3. Verify phone_number.assigned_agent_id === agent_id
4. Validate to_number E.164
5. If twilio → POST /v1/convai/twilio/outbound-call
6. If sip → POST /v1/convai/sip-trunk/outbound-call
Returns: `{ success: true, conversation_id }`

### GET /api/calls/history/:agent_id
Verify agent belongs to client → GET /v1/convai/conversations?agent_id=...&page_size=10

### Admin routes (/api/admin/*) — require is_admin === 1
- GET /api/admin/clients
- POST /api/admin/clients — create client
- POST /api/admin/clients/:id/agents — assign agent to client
- DELETE /api/admin/clients/:id/agents/:agent_id

---

## ELEVENLABS API REFERENCE (backend use only)

```
GET    /v1/convai/agents                      list all agents
GET    /v1/convai/agents/:id                  get agent (voice, phone numbers)
PATCH  /v1/convai/agents/:id                  update voice
GET    /v1/voices                             list available voices
POST   /v1/convai/phone-numbers               import Twilio or SIP number
PATCH  /v1/convai/phone-numbers/:id           assign to agent
DELETE /v1/convai/phone-numbers/:id           remove number
POST   /v1/convai/twilio/outbound-call        initiate Twilio call
POST   /v1/convai/sip-trunk/outbound-call     initiate SIP call
GET    /v1/convai/conversations?agent_id=...  call history
```

Headers for all calls: `{ "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" }`

### Phone number registration request bodies

Twilio:
```json
{
  "provider": "twilio",
  "label": "Client A Line",
  "phone_number": "+212612345678",
  "sid": "ACxxxxxxxx",
  "token": "xxxxxxxxxxxx",
  "phone_number_sid": "PNxxxxxxxx"
}
```

SIP:
```json
{
  "provider": "sip_trunk",
  "label": "Client A SIP",
  "phone_number": "+212612345678",
  "termination_uri": "sip.provider.com",
  "username": "user",
  "password": "pass",
  "transport": "tls"
}
```

Assign to agent:
```json
{ "agent_id": "agent_xxxxxxxx" }
```

---

## SECURITY RULES

1. ELEVENLABS_API_KEY only in .env, only read by services/elevenlabs.js — NEVER sent to frontend
2. JWT stored only in React state — not localStorage
3. Twilio auth_token and SIP passwords NEVER stored in DB
4. Every route verifies agent/phone number belongs to the requesting client
5. Admin routes verify is_admin === 1 from DB — never trust client-side claims
6. CORS allows only FRONTEND_URL origin

---

## ═══════════════════════════════════════════
## DESIGN SYSTEM — LINEAR.APP CLONE AESTHETIC
## ═══════════════════════════════════════════

This is the most important section. Study the Linear.app interface before building.
The goal: when someone sees this dashboard, it looks and feels exactly like Linear — but for AI call agents instead of engineering tasks.

---

### CORE VISUAL LANGUAGE

Linear uses no gradients, no glows, no shadows heavier than a whisper. Everything is about:
- Extremely dark but NOT pure black backgrounds
- 1px borders that are barely visible
- Typography doing all the visual heavy lifting
- Tiny pops of color only for status (green = active, orange = warning, red = error)
- Maximum information density without feeling cluttered

---

### COLOR PALETTE — EXACT VALUES

```css
:root {
  /* Backgrounds — dark gray, never pure black */
  --bg-app:        #0E0E11;   /* outermost app background */
  --bg-sidebar:    #13131A;   /* left sidebar */
  --bg-panel:      #17171F;   /* main content area */
  --bg-card:       #1C1C26;   /* agent cards, modals */
  --bg-input:      #1F1F2C;   /* form inputs */
  --bg-hover:      #22222F;   /* hover state on any item */
  --bg-selected:   #252535;   /* selected sidebar item */

  /* Borders — barely visible */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.14);
  --border-focus:  rgba(255, 255, 255, 0.30);

  /* Text */
  --text-primary:  #E2E2E9;   /* headings, agent names, main content */
  --text-secondary: #9B9BAD;  /* labels, descriptions, secondary info */
  --text-muted:    #5C5C72;   /* timestamps, IDs, very secondary info */
  --text-inverse:  #0E0E11;   /* text on light/accent backgrounds */

  /* Accents — used ONLY for status, CTAs, and badges */
  --accent-primary: #5E6AD2;  /* Linear's signature indigo-purple — CTAs only */
  --accent-hover:   #6B78E5;
  --status-active:  #26C281;  /* green — agent active/online */
  --status-warning: #F0A429;  /* orange — no phone linked, SIP enterprise note */
  --status-error:   #E5484D;  /* red — call failed, errors */
  --status-calling: #5E6AD2;  /* indigo — call in progress */
  --status-muted:   #4A4A5A;  /* gray — inactive agent */

  /* Typography */
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing (4px base) */
  --s1: 4px;  --s2: 8px;   --s3: 12px;  --s4: 16px;
  --s5: 20px; --s6: 24px;  --s8: 32px;  --s10: 40px;

  /* Radius */
  --r-sm: 4px;   /* badges, tags */
  --r-md: 6px;   /* inputs, buttons */
  --r-lg: 8px;   /* cards, panels */
  --r-xl: 12px;  /* modals */
}
```

Load fonts:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

### LAYOUT STRUCTURE — EXACT LINEAR CLONE

The app is a fixed full-height layout. NO page scrolling on the outer shell.
Only the main content panel scrolls internally.

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR (220px fixed)  │  MAIN CONTENT (flex: 1)           │
│  bg: #13131A            │  bg: #17171F                      │
│  border-right: 1px      │                                   │
│  rgba(255,255,255,0.06) │  ┌──────────────────────────────┐ │
│                         │  │ PAGE HEADER (fixed, 52px)    │ │
│  [Logo]  DIALIX         │  │ Page title + action button   │ │
│                         │  └──────────────────────────────┘ │
│  ─────────────────       │                                   │
│  My Workspace            │  ┌──────────────────────────────┐ │
│                         │  │ SCROLLABLE CONTENT            │ │
│  ◈  Agents              │  │ Agent cards grid              │ │
│  ☎  Phone Numbers       │  │ Call history tables           │ │
│  📋 Call History        │  │ etc.                          │ │
│                         │  └──────────────────────────────┘ │
│  ─────────────────       │                                   │
│  Admin (if owner)       │                                   │
│                         │                                   │
│  ◎  Clients             │                                   │
│  ⚙  Settings           │                                   │
│                         │                                   │
│  ─────────────────       │                                   │
│  [Avatar] Client Name   │                                   │
│  [Logout]               │                                   │
└─────────────────────────────────────────────────────────────┘
```

CSS for the shell:
```css
body, html { height: 100%; overflow: hidden; background: var(--bg-app); }

.app-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sidebar {
  width: 220px;
  min-width: 220px;
  height: 100vh;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  padding: var(--s4) 0;
  overflow-y: auto;
}

.main-content {
  flex: 1;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  overflow: hidden;
}

.page-header {
  height: 52px;
  min-height: 52px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  padding: 0 var(--s6);
  gap: var(--s4);
}

.page-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--s6);
}
```

---

### SIDEBAR — EXACT SPEC

**Logo area (top of sidebar):**
```
  ◆  DIALIX
```
- ◆ is a small inline SVG geometric diamond/hexagon mark, color `#5E6AD2`
- "DIALIX" in Inter SemiBold, 14px, color `#E2E2E9`, letter-spacing 0.04em
- Padding: 16px horizontal, 12px vertical
- A faint divider line below this

**Navigation items:**
```css
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s2) var(--s4);
  margin: 1px var(--s2);
  border-radius: var(--r-md);
  font-size: 13px;
  font-family: var(--font-ui);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--bg-selected);
  color: var(--text-primary);
}

.nav-item svg {
  width: 15px;
  height: 15px;
  opacity: 0.7;
  flex-shrink: 0;
}
```

**Section labels (above groups of nav items):**
```css
.nav-section-label {
  font-size: 11px;
  font-family: var(--font-ui);
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: var(--s4) var(--s4) var(--s2);
}
```

**Bottom of sidebar (user info):**
- Small circular avatar (initials-based, generated from client name)
- Client name in 13px Inter, color `--text-secondary`
- Clicking opens a small popover with Logout button

---

### PAGE HEADER — EXACT SPEC

```
┌─────────────────────────────────────────────────────────────┐
│  Agents                              [+ Add Phone Number]   │
└─────────────────────────────────────────────────────────────┘
```

```css
.page-header h1 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-ui);
  letter-spacing: -0.01em;
}
```

**"+ Add Phone Number" button** (top-right of header):
```css
.btn-primary {
  background: var(--accent-primary);
  color: white;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--r-md);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  transition: background 120ms ease;
}
.btn-primary:hover { background: var(--accent-hover); }
```

---

### AGENT CARDS — EXACT SPEC

Display agents in a list or a 2-column grid. Prefer the **list layout** (like Linear issues list) over card grid — it's more compact and professional. Each agent is one row.

**List item layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ ● Agent Name           Sales Voice ▼    +212 612 345 678     │
│   agent_id in mono     [Save Voice]     [📞 Call]            │
└──────────────────────────────────────────────────────────────┘
```

Actually, use an **expandable row** pattern like Linear:
- Collapsed: shows agent name + status dot + phone number + "Call" button
- Expanded (on click): shows voice selector, call input, call history

```css
.agent-row {
  display: flex;
  align-items: center;
  gap: var(--s4);
  padding: var(--s3) var(--s4);
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 100ms ease;
}
.agent-row:hover { background: var(--bg-hover); }

.agent-row-expanded {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--r-lg);
  margin: var(--s2) 0;
  padding: var(--s4);
}
```

**Status dot:**
```css
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.active {
  background: var(--status-active);
  box-shadow: 0 0 0 0 rgba(38, 194, 129, 0.35);
  animation: pulse-green 2.5s ease infinite;
}
.status-dot.inactive { background: var(--status-muted); }

@keyframes pulse-green {
  0%   { box-shadow: 0 0 0 0 rgba(38, 194, 129, 0.35); }
  60%  { box-shadow: 0 0 0 6px rgba(38, 194, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(38, 194, 129, 0); }
}
```

**Agent name:**
```css
.agent-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: var(--font-ui);
}
.agent-id {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-left: var(--s2);
}
```

**Expanded panel (when row is clicked):**
3 columns inside the expanded area:
```
┌────────────────┬─────────────────┬──────────────────────────┐
│  VOICE         │  PHONE LINE     │  CALL                    │
│                │                 │                          │
│  [Voice ▼]    │  [Line ▼]       │  [+212__________]        │
│  [Save Voice] │  ⚠ No line      │  [📞 Call Now]           │
│               │                  │  conv_xxx · just now     │
└────────────────┴─────────────────┴──────────────────────────┘
```

Column headers in `--text-muted`, 10px, uppercase, letter-spacing 0.08em — exactly like Linear's property headers.

---

### VOICE DROPDOWN — EXACT SPEC

Style it like a Linear property selector — compact, clean:

```css
.voice-select {
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: var(--r-md);
  color: var(--text-primary);
  font-size: 12px;
  padding: 5px 10px;
  width: 100%;
  cursor: pointer;
  font-family: var(--font-ui);
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* down arrow */
}
.voice-select:focus {
  outline: none;
  border-color: var(--border-focus);
}
```

Above the select, show a tiny text input for filtering voices:
```html
<input placeholder="Filter voices..." class="voice-filter-input" />
```

Same style as voice-select but no arrow, for filtering the options below it.

---

### CALL BUTTON + STATUS — EXACT SPEC

```css
.call-btn {
  width: 100%;
  background: var(--status-active);   /* green */
  color: #0A1A10;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 16px;
  border-radius: var(--r-md);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: background 120ms ease, opacity 120ms ease;
}
.call-btn:hover { background: #2DD68D; }
.call-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.call-btn.calling {
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: default;
}
```

After a call is initiated, show this below the button:
```html
<div class="call-result">
  <span class="conv-id">conv_5fKx9...</span>
  <span class="call-time">just now</span>
</div>
```

```css
.call-result {
  display: flex;
  align-items: center;
  gap: var(--s3);
  margin-top: var(--s2);
  font-size: 11px;
}
.conv-id {
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-input);
  padding: 2px 6px;
  border-radius: var(--r-sm);
  cursor: pointer; /* copy on click */
}
.call-time { color: var(--text-muted); }
```

---

### ADD PHONE NUMBER MODAL — EXACT SPEC

Full-screen overlay with a centered modal (NOT a slide-in panel):

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--r-xl);
  width: 480px;
  max-width: 95vw;
  padding: var(--s6);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--s5);
  font-family: var(--font-ui);
}
```

**Provider toggle (Twilio / SIP Trunk):**
```css
.provider-toggle {
  display: flex;
  background: var(--bg-input);
  border-radius: var(--r-md);
  padding: 3px;
  margin-bottom: var(--s5);
}
.provider-tab {
  flex: 1;
  text-align: center;
  padding: 5px 12px;
  font-size: 12px;
  border-radius: calc(var(--r-md) - 2px);
  cursor: pointer;
  transition: background 120ms ease;
  color: var(--text-secondary);
}
.provider-tab.active {
  background: var(--bg-card);
  color: var(--text-primary);
  font-weight: 500;
}
```

**Form labels and inputs:**
```css
.form-group {
  margin-bottom: var(--s4);
}
.form-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  margin-bottom: var(--s1);
  display: block;
  font-family: var(--font-ui);
}
.form-input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: var(--r-md);
  padding: 7px 10px;
  font-size: 13px;
  color: var(--text-primary);
  font-family: var(--font-ui);
  transition: border-color 120ms ease;
}
.form-input:focus {
  outline: none;
  border-color: var(--border-focus);
}
.form-input[type="password"] {
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
}
```

**Info/warning notes inside modal:**
```css
.form-note {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: var(--s2);
  line-height: 1.5;
}
.form-note.warning {
  color: var(--status-warning);
}
```

**Modal buttons (bottom of modal):**
```
[Cancel]          [Connect Twilio Number →]
```
- Cancel: ghost/text button, `--text-secondary`
- Submit: `btn-primary` style (indigo `--accent-primary`)

---

### PHONE NUMBERS TAB — EXACT SPEC

A clean table, exactly like Linear's issue list:

```
Label              Phone Number    Provider    Assigned To        Actions
─────────────────────────────────────────────────────────────────────────
My Twilio Line     +212 612...     Twilio      Sales Agent        ⋯
My SIP Line        +1 415...       SIP         Support Agent      ⋯
```

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: var(--s2) var(--s4);
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;
  font-family: var(--font-ui);
}
.data-table td {
  font-size: 13px;
  color: var(--text-primary);
  padding: var(--s3) var(--s4);
  border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-ui);
}
.data-table tr:hover td {
  background: var(--bg-hover);
}

/* Phone number in mono */
.data-table .phone-cell {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

/* Provider badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: var(--r-sm);
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-ui);
}
.badge.twilio { background: rgba(255, 100, 50, 0.12); color: #FF7A52; }
.badge.sip    { background: rgba(94, 106, 210, 0.12); color: #8B98E8; }
```

---

### CALL HISTORY EXPANDABLE — EXACT SPEC

When user clicks "Call history" under any agent, a sub-section expands below (like Linear's sub-issues):

```
  ↳ Recent Calls (5)
    conv_5fKx9...    Apr 8 2026, 2:14 AM    2m 34s    ✓ done
    conv_8pRq2...    Apr 7 2026, 11:05 PM   0m 12s    ✗ failed
```

```css
.call-history {
  border-top: 1px solid var(--border-subtle);
  margin-top: var(--s3);
  padding-top: var(--s3);
}
.history-label {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
  margin-bottom: var(--s2);
  display: flex;
  align-items: center;
  gap: var(--s2);
}
.history-row {
  display: flex;
  align-items: center;
  gap: var(--s4);
  padding: var(--s1) 0;
  font-size: 12px;
  color: var(--text-secondary);
  font-family: var(--font-ui);
}
.history-row .conv-id {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}
.history-row .status-done  { color: var(--status-active); }
.history-row .status-fail  { color: var(--status-error); }
```

---

### TOASTS (Notifications) — EXACT SPEC

Bottom-left corner (Linear puts notifications there):

```css
.toast-container {
  position: fixed;
  bottom: var(--s6);
  left: var(--s6);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  z-index: 9999;
}
.toast {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--r-lg);
  padding: var(--s3) var(--s4);
  font-size: 13px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--s3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  animation: slideInLeft 200ms ease;
  max-width: 320px;
  font-family: var(--font-ui);
}
.toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.toast.success .toast-dot { background: var(--status-active); }
.toast.error .toast-dot   { background: var(--status-error); }
.toast.info .toast-dot    { background: var(--accent-primary); }

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

Auto-dismiss after 4 seconds.

---

### LOGIN SCREEN — EXACT SPEC

Full page, centered, minimal. NOT a colorful gradient splash — just a clean dark form:

```
bg: #0E0E11

         ◆  DIALIX
         Sign in to continue

         Email
         [_________________________]

         Password
         [_________________________]

         [    Sign in    ]

         (No "sign up" — owner creates accounts)
```

```css
.login-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-app);
}
.login-box {
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}
.login-logo {
  display: flex;
  align-items: center;
  gap: var(--s3);
  margin-bottom: var(--s2);
}
.login-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-ui);
}
.login-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: var(--s4);
  font-family: var(--font-ui);
}
```

---

### EMPTY STATES — EXACT SPEC

When no phone numbers registered, no agents assigned, etc.:

```
           📭  (small icon, not emoji — use Lucide icons)

           No phone numbers connected
           Add a Twilio or SIP number to start making calls.

           [+ Add Phone Number]
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--s10) var(--s8);
  color: var(--text-muted);
}
.empty-state svg {
  width: 32px;
  height: 32px;
  margin-bottom: var(--s4);
  opacity: 0.4;
}
.empty-state h3 {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--s2);
  font-family: var(--font-ui);
}
.empty-state p {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 260px;
  line-height: 1.5;
  margin-bottom: var(--s5);
  font-family: var(--font-ui);
}
```

---

### LOADING STATES

Skeleton loaders — never show a spinner on the whole page. Only skeleton rows:

```css
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-hover) 25%,
    var(--bg-selected) 50%,
    var(--bg-hover) 75%
  );
  background-size: 400px 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: var(--r-sm);
}
.skeleton-row {
  height: 40px;
  margin-bottom: 1px;
  border-radius: 0;
}
.skeleton-text { height: 12px; border-radius: var(--r-sm); }
```

---

### ICONS

Use **Lucide icons** via CDN (same icon set Linear uses):
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```
Key icons to use:
- `phone` — call
- `phone-call` — active call
- `mic` — agent/voice
- `hash` — agent ID
- `settings` — admin/settings
- `log-out` — logout
- `plus` — add button
- `trash-2` — delete
- `check` — success
- `x` — error/close
- `chevron-right` — expand row
- `chevron-down` — expanded row
- `inbox` — empty state for calls
- `link` — phone number connected

All icons: 15px × 15px, `color: currentColor`, `stroke-width: 1.75`.

---

### ANTI-PATTERNS TO AVOID

❌ No gradient backgrounds
❌ No glowing orbs or neon accents
❌ No card hover glow effects (just subtle bg color change)
❌ No large hero headings — this is a dense tool, not a landing page
❌ No rounded pill buttons — use 6px radius only
❌ No colored card borders (left-side accent border = template look)
❌ No heavy box shadows — if needed, 0 2px 8px rgba(0,0,0,0.3) max
❌ No modal animations except a simple opacity fade — no bouncing
❌ No emoji anywhere in the UI — use Lucide icons
❌ No full-page spinner — use skeleton loaders per section

---

## FRONTEND STATE STRUCTURE

```javascript
{
  auth: {
    token: null,
    client: null,    // { id, name, email, is_admin }
  },
  ui: {
    activeView: "agents", // "agents" | "phone-numbers" | "history" | "admin"
    expandedAgent: null,  // agent_id of currently expanded row
    addPhoneModal: false,
    selectedProvider: "twilio",
    toasts: []
  },
  data: {
    agents: [],        // [{ agent_id, name, current_voice_id, status }]
    voices: [],        // fetched once, shared across all agents
    phoneNumbers: [],  // [{ id, elevenlabs_phone_number_id, phone_number, label, provider, assigned_agent_id }]
    conversations: {}, // { [agent_id]: [...] }
  },
  callStates: {}       // { [agent_id]: { status: "idle|calling|done|failed", conversationId, toNumber } }
}
```

---

## CALL FLOW LOGIC (Frontend)

```
User types phone number → clicks Call Now
  ↓
callStates[agent_id].status = "calling"
Call button shows spinner + "Calling..."
  ↓
POST /api/calls/outbound { agent_id, phone_number_id, to_number }
  ↓
On success:
  callStates[agent_id] = { status: "done", conversationId: "conv_xxx" }
  Show conv_id below button
  Toast: "✓ Call initiated"

On error:
  callStates[agent_id] = { status: "failed" }
  Show error message inline below button
  Toast: "✗ Call failed: [reason]"
```

---

## WHAT NOT TO BUILD

❌ No Twilio SDK
❌ No SIP WebRTC client
❌ No call recording player
❌ No CRM or lead management
❌ No email/WhatsApp follow-up (n8n handles this)
❌ No real-time audio streaming
❌ No complex roles — just is_admin boolean
❌ No OAuth — email + password + JWT only
❌ No Stripe billing
❌ No localStorage/sessionStorage

---

## DELIVERABLE

**Backend:** `backend/` — Node.js Express API, deployable via `node server.js` or PM2
**Frontend:** `frontend/` — React SPA, served as static files or by Express in production
**README:** Setup instructions, how to create first admin, how to deploy to Hostinger VPS

In production: Express serves React build from `frontend/dist/` on port 3001.
API routes at `/api/*`, React app for all other routes (`app.get('*', ...)` catch-all).

---

*Generated for Dialix AI Call Center Dashboard — April 2026*
*Design: Linear.app clone aesthetic — dark, dense, professional*
*Architecture: Client credentials → Dialix Backend → ElevenLabs (never to browser)*

# Dialix v3 — AI Call Center Dashboard

**White-label SaaS dashboard for AI calling agents powered by ElevenLabs.**

Clients manage their AI agents, connect Twilio or SIP trunk phone numbers, and initiate outbound calls — all through a clean, Linear.app-inspired dark interface.

---

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your real values:

| Variable | Description |
|---|---|
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key (starts with `xi_`) |
| `JWT_SECRET` | A long random string for signing auth tokens |
| `PORT` | Backend port (default: `3001`) |
| `FRONTEND_URL` | Frontend URL for CORS (default: `http://localhost:3000`) |

### 3. Start the server

```bash
node server.js
```

The server will:
- Initialize the SQLite database
- Create a default admin: `admin@dialix.ai` / `admin123`
- Start serving API at `http://localhost:3001/api`
- Serve the frontend at `http://localhost:3001`

### 4. Login

Open `http://localhost:3001` and sign in with:
- **Email:** `admin@dialix.ai`
- **Password:** `admin123`

> ⚠️ Change these credentials immediately in production.

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Browser    │────▶│  Dialix Backend  │────▶│  ElevenLabs    │
│  (React SPA) │     │  (Express + JWT) │     │  REST API      │
└─────────────┘     └──────────────────┘     └────────────────┘
                           │
                    ┌──────┴──────┐
                    │  SQLite DB  │
                    └─────────────┘
```

- **Frontend** → talks only to the Dialix backend
- **Backend** → makes all ElevenLabs API calls (API key never sent to browser)
- **Credentials** → Twilio/SIP credentials are passed through to ElevenLabs and **never stored**

---

## Project Structure

```
dialix 2/
├── backend/
│   ├── server.js           # Express app entry point
│   ├── db.js               # SQLite database (sql.js)
│   ├── .env                # Environment variables
│   ├── middleware/
│   │   └── auth.js         # JWT auth + admin middleware
│   ├── routes/
│   │   ├── auth.js         # Login + profile
│   │   ├── agents.js       # Agent management
│   │   ├── phoneNumbers.js # Phone number CRUD
│   │   ├── calls.js        # Outbound calls + history
│   │   └── admin.js        # Client management
│   └── services/
│       └── elevenlabs.js   # ElevenLabs API wrapper
├── frontend/
│   ├── index.html          # SPA entry point
│   ├── styles.css          # Linear.app design system
│   └── app.js              # React components
└── README.md
```

---

## Admin Operations

### Create a client

1. Sign in as admin
2. Go to **Clients** in the sidebar
3. Click **New Client** and fill in name, email, password

### Assign an agent to a client

1. In the **Clients** view, click on a client row
2. Enter the **Agent ID** from ElevenLabs (e.g., `agent_abc123`)
3. Enter a **display name** (e.g., "Sales Agent")
4. Click **Assign**

---

## Deploy to Production (Hostinger VPS)

```bash
# SSH into your VPS
ssh user@your-vps-ip

# Clone or upload the project
cd /var/www
git clone <your-repo>
cd dialix

# Install deps
cd backend && npm install --production

# Set env vars
cp .env.example .env
nano .env   # Set real API keys

# Start with PM2
npm install -g pm2
pm2 start server.js --name dialix
pm2 save
pm2 startup
```

The Express server serves both the API and frontend from a single port.

---

## Security Notes

- ElevenLabs API key: only in `.env`, never sent to frontend
- JWT token: stored in React state only (not localStorage)
- Twilio auth tokens & SIP passwords: **never stored** in database
- Every API route verifies resource ownership
- Admin routes check `is_admin` from the database
- CORS restricts requests to `FRONTEND_URL` only

---

*Dialix v3 — April 2026*

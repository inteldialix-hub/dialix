# DIALIX — FINAL PRODUCTION COMPLETION & LAUNCH-READINESS MISSION

You are the senior staff engineer, SaaS architect, QA engineer, DevOps engineer, security engineer, and payment-integration engineer responsible for finishing **Dialix**, our AI Voice Call Center SaaS.

Current deployed frontend:

https://dialix-frontend.fly.dev

The objective of this mission is NOT to produce another audit, roadmap, mockup, proposal, list of recommendations, or TODO document.

## PRIMARY OBJECTIVE

Finish the actual project.

Implement all missing production functionality, repair incomplete/broken functions, connect the frontend to real backend behavior, add secure PayPal billing/webhooks, run migrations, run automated tests, perform end-to-end testing, fix discovered failures, build the production application, and leave Dialix in a state where we can begin marketing and onboarding real customers.

Do not stop after identifying a problem.

For every problem:

1. Diagnose it.
2. Fix it.
3. Test the fix.
4. Re-test related functionality.
5. Continue.

Do not ask me to manually code anything.

Do not ask questions unless an external secret/account credential is truly required and cannot be generated or inferred from the existing project.

When a secret is unavailable, finish all implementation around it, add the required environment variable, use sandbox/mock-safe configuration for tests, document exactly which secret remains to be inserted, and continue completing everything else.

Never expose credentials in frontend code, logs, commits, browser responses, or generated documentation.

---

# 1. FIRST: UNDERSTAND THE EXISTING PROJECT

Inspect the complete repository before changing architecture.

Determine:

- frontend framework
- backend framework
- authentication system
- database
- ORM
- migrations
- caching
- queues/workers
- telephony provider(s)
- STT provider(s)
- TTS provider(s)
- LLM provider(s)
- current billing implementation
- deployment configuration
- Fly.io configuration
- environment variables
- API routes
- current database schema
- current dashboard modules
- current integrations
- tests
- CI/CD
- logging/monitoring

Reuse the existing architecture wherever reasonable.

Do NOT unnecessarily rewrite working functionality.

Do NOT replace the visual identity of Dialix.

Maintain the current premium dark/enterprise design system and improve only where required for usability, accessibility, responsiveness, errors, empty states, or missing interfaces.

Create a working branch/backup before major changes if the environment supports it.

---

# 2. NO MOCK FEATURES IN PRODUCTION

Audit every page and button after authentication.

Any UI element that appears functional must either:

- perform a real backend operation,
- display a clearly labeled unavailable/coming-soon state,
- or be removed until implemented.

There must be no fake production statistics, fake call records, fake active agents, fake integrations, fake billing data, fake analytics, fake success messages, or buttons that silently do nothing.

Seed/demo data may exist only in an explicitly labeled demo environment.

---

# 3. AUTHENTICATION & ACCOUNT SYSTEM

Complete the entire authentication lifecycle.

Required:

- signup
- login
- logout
- session persistence
- protected dashboard routes
- server-side authorization
- unique email enforcement
- normalized lowercase emails
- strong password requirements
- secure password hashing
- email verification
- resend verification email
- forgot password
- secure password reset token
- expiration for reset tokens
- invalidate reset token after use
- change password
- current-password confirmation when appropriate
- session invalidation after password/security changes
- rate limiting for login/signup/reset endpoints
- generic login/reset errors to reduce account enumeration
- CSRF protection where applicable
- secure cookies
- HttpOnly
- Secure in production
- SameSite configuration
- logout everywhere / revoke sessions if architecture supports it

Do not expose authentication secrets client-side.

Add clear UX for:

- invalid email
- weak password
- password mismatch
- existing account
- expired reset link
- unverified email
- wrong credentials
- rate limiting
- server unavailable

---

# 4. ORGANIZATION / WORKSPACE MODEL

Dialix should support proper SaaS tenant isolation.

Ensure all customer data belongs to an organization/workspace.

At minimum support:

Owner  
Admin  
Manager  
Supervisor  
Analyst  
Billing  
Viewer

Implement real backend RBAC.

Permissions must never rely only on hiding frontend buttons.

Test authorization against direct API requests.

Sensitive permissions include:

- billing
- API keys
- team management
- call recordings
- transcripts
- contact export
- campaign launch
- phone number release
- agent editing
- webhook creation
- deletion operations

Ensure one tenant can NEVER access another tenant's:

- users
- contacts
- campaigns
- agents
- calls
- transcripts
- recordings
- billing
- webhook data
- API keys
- analytics
- phone numbers

Add automated tenant-isolation tests.

---

# 5. DASHBOARD

Finish the authenticated dashboard with REAL data.

Required KPIs:

- total calls
- answered calls
- answer rate
- failed calls
- average call duration
- total minutes
- qualified leads
- qualification rate
- conversions
- appointments
- transfers
- estimated/real telephony + AI usage cost where available
- cost per qualified lead
- active campaigns
- active agents

Support timeframe filtering:

- today
- yesterday
- last 7 days
- last 30 days
- custom range

Add useful charts:

- calls over time
- answer rate
- outcomes
- conversions
- spend
- calls by agent
- calls by campaign

Empty accounts must show useful onboarding, not fake data.

CSV export must generate a valid file based on current organization and selected filters.

---

# 6. AI AGENT BUILDER

Complete the Agents module.

Each agent should support appropriate fields such as:

- name
- description
- status
- objective
- system prompt
- first message
- language
- multilingual behavior
- voice provider
- voice
- LLM/model
- temperature/model settings where supported
- STT provider/settings
- TTS provider/settings
- interruption handling
- silence timeout
- maximum call duration
- voicemail behavior
- fallback message
- compliance/recording disclosure
- transfer rules
- post-call analysis instructions
- structured extraction schema
- knowledge base selection
- tools/functions
- phone number assignment
- inbound/outbound configuration

Implement:

Create  
Edit  
Duplicate  
Archive  
Delete safely  
Activate/deactivate

Validation must prevent incomplete agents from launching real calls.

Add agent versioning if feasible with the current architecture.

Keep previous prompt/config versions and support rollback.

---

# 7. AGENT TEST SANDBOX

Create an in-dashboard agent testing mechanism.

Where supported by existing voice stack:

- microphone conversation with agent
- or text simulation
- or safe test-call mode to an explicitly entered verified developer number

Show:

- transcript
- agent response
- latency
- tool invocation
- errors
- structured extraction

Test mode must be clearly separated from production campaigns.

---

# 8. KNOWLEDGE BASE

Implement a proper knowledge-base module if not already complete.

Support appropriate sources:

- PDF
- DOCX
- TXT/Markdown
- FAQ/manual content
- website URL where supported

Required:

- upload
- parsing
- chunking
- indexing/embedding
- retrieval
- association to agents
- remove document
- reindex
- status
- processing errors
- last indexed timestamp

Enforce tenant isolation.

Do not allow one customer to retrieve another customer's documents.

Use RAG rather than stuffing huge documents directly into every prompt.

---

# 9. CONTACTS / LEADS

Create or complete a first-class Contacts module.

Suggested fields:

- first name
- last name
- company
- phone
- normalized E.164 phone
- email
- language
- country
- timezone
- tags
- lifecycle status
- owner
- consent status
- consent source
- consent timestamp
- do-not-call status
- opt-out reason
- custom fields
- last call
- next callback
- created date
- source

Implement:

- create
- edit
- archive/delete
- bulk selection
- search
- filters
- pagination
- CSV import
- CSV export

CSV import must include column mapping and preview.

Validate:

- invalid phone numbers
- duplicates
- country code
- E.164 normalization
- malformed rows
- DNC conflicts

Provide import result summary:

Imported  
Updated  
Skipped  
Invalid  
DNC excluded

Do not silently import invalid phone numbers.

---

# 10. DO-NOT-CALL / OPT-OUT SYSTEM — CRITICAL

Implement an organization-level and preferably global suppression mechanism.

When a number is DNC, the backend must block calls regardless of which contact list or campaign contains it.

This must not depend only on the LLM prompt.

Store:

- normalized phone number
- scope
- reason
- source
- timestamp
- actor/event
- optional regulatory/consent metadata

Agent conversation analysis should recognize explicit stop requests in relevant supported languages, including English, French, Arabic, and Moroccan Darija where possible.

Examples include:

"don't call me again"  
"remove my number"  
"stop calling"  
"ne m'appelez plus"  
"supprimez mon numéro"

Implement corresponding Arabic/Darija equivalents appropriately.

On confirmed opt-out:

1. mark DNC
2. terminate/close conversation politely
3. suppress future calls
4. generate audit log
5. expose status in contact history

Campaign launch must always run a DNC filter server-side.

---

# 11. PHONE NUMBERS

Complete `/dashboard/phone-numbers`.

A phone number record should support, depending on provider capabilities:

- number
- country
- provider
- capabilities
- inbound enabled
- outbound enabled
- assigned agent
- status
- monthly cost where available
- created date

Implement appropriate actions:

- provision/buy
- import/existing number
- assign agent
- unassign
- inbound configuration
- outbound configuration
- release number

Destructive release must require explicit confirmation.

Never release a production number through a one-click accidental action.

Provider secrets must remain backend-only.

---

# 12. OUTBOUND CAMPAIGNS

Create/finish a professional outbound Campaign module.

Campaign creation should include:

Step 1 — Contacts/list  
Step 2 — AI agent  
Step 3 — outbound phone number  
Step 4 — schedule  
Step 5 — calling rules  
Step 6 — goal/outcome configuration  
Step 7 — concurrency/rate/spend limits  
Step 8 — review and launch

Campaign states:

draft  
scheduled  
running  
paused  
completed  
cancelled  
failed

Implement:

- create
- edit draft
- schedule
- start
- pause
- resume
- cancel
- duplicate
- analytics

Before campaign launch, show:

- number of contacts
- valid numbers
- duplicates removed
- DNC excluded
- agent
- outbound number
- schedule
- timezone rule
- concurrency
- estimated minutes
- estimated cost when possible
- account usage limits

Campaign execution must be controlled from backend workers/queues, not browser loops.

---

# 13. CALLING HOURS & TIMEZONES

Do not use only the organization's timezone.

Determine recipient timezone when possible from contact data/country/explicit timezone.

Support:

- allowed days
- start time
- end time
- timezone
- weekends
- optional holiday restrictions
- callback requested time

Never place campaign calls outside configured allowed windows.

Store times internally consistently, preferably UTC, while presenting local times correctly.

---

# 14. CONCURRENCY / RATE / COST CONTROLS

Critical production safeguards.

Support configurable limits at:

- platform level
- plan level
- organization level
- campaign level

Examples:

- max concurrent calls
- calls/minute
- calls/hour
- calls/day
- max campaign contacts
- max campaign spend
- daily spend
- monthly spend/minutes

Reject campaign starts that exceed hard limits.

Campaign workers must enforce limits server-side.

Do not rely on frontend limits.

Implement backpressure.

---

# 15. COMPLETE CALL STATE MACHINE

Create one authoritative call lifecycle.

Example states:

queued  
validating  
scheduled  
dialing  
ringing  
answered  
ai_active  
transferring  
transferred  
completed  
failed  
cancelled  
processing  
transcript_ready

Every call should have appropriate identifiers such as:

- internal call ID
- organization ID
- campaign ID
- agent ID
- contact ID
- phone number ID
- provider call ID
- status
- timestamps
- duration
- cost
- result
- termination reason
- recording reference
- transcript reference

Failure reasons should be granular:

busy  
no_answer  
voicemail  
invalid_number  
provider_error  
insufficient_balance  
concurrency_limit  
DNC  
outside_calling_hours  
agent_error  
LLM_error  
STT_error  
TTS_error  
transfer_failed  
user_hangup  
system_timeout

Do not display everything merely as `failed`.

Webhook/event processing from telephony providers must be idempotent.

---

# 16. INBOUND CALLS

Inbound number → assigned agent must work end-to-end.

Implement:

- incoming provider webhook
- organization/number lookup
- assigned agent lookup
- conversation initialization
- recording configuration
- disclosure configuration
- STT/TTS/LLM stream
- tool execution
- transfer
- termination
- transcript
- post-call analysis
- usage/billing
- history entry

Handle unassigned numbers gracefully.

---

# 17. OUTBOUND CALLS

Outbound calls must work end-to-end from approved contacts/campaigns.

Flow:

contact validation  
→ DNC check  
→ consent/rules check  
→ calling-hour check  
→ account/plan/usage check  
→ concurrency check  
→ phone provider request  
→ call state updates  
→ AI session  
→ recording/transcript  
→ post-call analysis  
→ webhook/CRM events  
→ usage/billing  
→ campaign counters

Provider errors must not leave calls permanently stuck in `dialing`.

Implement timeout/reconciliation jobs.

---

# 18. HUMAN HANDOFF

Implement configurable transfer.

Possible conditions:

- user asks for a person
- complaint/escalation
- low AI confidence
- high-value lead
- explicit configured intent
- emergency/sensitive condition
- repeated model/tool failure

Flow:

AI informs caller appropriately  
→ transfer attempt  
→ target human/number/SIP destination  
→ success tracking

If transfer fails:

- configured backup
- voicemail
- callback request
- CRM/internal task
- graceful message

Store transfer result in call history.

---

# 19. VOICEMAIL / NO ANSWER / RETRIES

Support provider capabilities for voicemail detection where available.

Campaign configuration should specify whether to:

- hang up
- leave voicemail
- retry
- schedule callback

Prevent aggressive retry loops.

Configure:

- maximum attempts
- delay
- allowed days
- calling windows

DNC always overrides retry.

---

# 20. RECORDINGS

Implement secure recording storage/references.

Recording access must be authorization-controlled.

Permissions should distinguish:

- listen
- download
- delete

Use short-lived signed URLs where the storage architecture supports them.

Do not expose raw permanent storage URLs publicly.

Display recording disclosure/configuration appropriately.

Add configurable retention:

- 30 days
- 90 days
- custom
- no recording where required

Deletion jobs must actually remove the stored recording.

---

# 21. TRANSCRIPTS & POST-CALL ANALYSIS

Call detail page should contain:

- timeline
- speaker-separated transcript
- timestamps where available
- recording
- call outcome
- sentiment where supported
- summary
- qualification
- conversion/appointment
- extracted fields
- transfer info
- cost/usage
- errors

Implement structured extraction.

Example:

{
  "qualified": true,
  "interest": "high",
  "budget": 15000,
  "callback_requested": true,
  "callback_at": "...",
  "appointment_booked": false
}

Validate model-generated structured outputs against schema.

Do not trust malformed LLM JSON.

---

# 22. CALL HISTORY

Complete History/Analysis with real database data.

Columns:

- contact
- number
- agent
- campaign
- date
- direction
- duration
- outcome
- status
- sentiment if supported
- cost
- recording
- transcript

Filters:

- date
- agent
- campaign
- status
- direction
- outcome
- qualified
- country

Support pagination.

CSV export must honor filters and organization permissions.

---

# 23. WEBHOOKS FOR DIALIX CUSTOMERS

Complete the existing Add Webhook feature.

Users should configure:

- HTTPS endpoint
- events
- enabled/disabled
- signing secret

Suggested events:

call.started  
call.ringing  
call.answered  
call.completed  
call.failed  
call.transferred  
call.transcript.ready  
call.recording.ready  
lead.qualified  
appointment.booked  
campaign.started  
campaign.completed

Generate a secret securely.

Sign requests using HMAC SHA-256 or the architecture's secure equivalent.

Include:

- event ID
- timestamp
- event type
- data
- schema/version

Add delivery history:

- endpoint
- event
- status
- HTTP status
- attempts
- latency
- last error
- next retry

Implement asynchronous delivery and exponential backoff.

Example retry schedule:

1 minute  
5 minutes  
30 minutes  
2 hours  
12 hours

Use event IDs and idempotency to avoid duplicate side effects.

Allow manual resend from webhook logs.

Never block call processing while waiting for a customer's webhook server.

---

# 24. API KEYS

Create or finish:

Settings → API Keys

API key management must support:

- create
- descriptive name
- scopes
- created date
- last used
- revoke
- optional expiration

Show raw API secret once.

Store only a secure hash where practical.

Example scopes:

calls:read  
calls:create  
agents:read  
agents:write  
contacts:read  
contacts:write  
campaigns:read  
campaigns:write

Add API authentication, rate limiting and audit logs.

---

# 25. PAYPAL — COMPLETE PAYMENT SYSTEM

Implement production-quality PayPal integration using PayPal's CURRENT REST APIs and CURRENT official documentation at implementation time.

Do not rely on deprecated APIs if a current replacement exists.

Use Sandbox first.

Support the pricing model already defined in the repository/product.

Do not invent new prices if prices already exist.

If no definitive source exists, centralize pricing configuration rather than duplicating prices throughout frontend/backend.

Implement, where appropriate:

- PayPal Checkout
- recurring subscriptions
- payment status
- subscription status
- billing history
- plan entitlement
- upgrade/downgrade
- cancel subscription
- failed-payment handling
- refund/reversal reconciliation
- sandbox/live configuration

Never expose PayPal client secret in the frontend.

Required environment variables should follow a clear pattern such as:

PAYPAL_ENV=sandbox|live  
PAYPAL_CLIENT_ID=  
PAYPAL_CLIENT_SECRET=  
PAYPAL_WEBHOOK_ID=  
APP_BASE_URL=

Add plan IDs/config variables if PayPal subscription plans require them.

Keep environment-specific configuration separate.

---

# 26. PAYPAL ORDER / CHECKOUT FLOW

The browser must never be trusted to mark an account paid.

For one-time Checkout if used:

frontend  
→ backend creates PayPal order  
→ PayPal approval  
→ backend captures/validates payment  
→ webhook reconciles final state  
→ entitlements granted only for verified successful payment

Support current relevant PayPal events such as:

CHECKOUT.ORDER.APPROVED  
CHECKOUT.PAYMENT-APPROVAL.REVERSED  
PAYMENT.CAPTURE.PENDING  
PAYMENT.CAPTURE.COMPLETED  
PAYMENT.CAPTURE.DENIED

Also handle relevant refund/reversal events for the APIs actually used by this implementation.

Do not fulfill paid entitlement solely from `return_url`.

---

# 27. PAYPAL SUBSCRIPTIONS

For recurring plans, integrate PayPal subscriptions properly.

Track locally:

- PayPal subscription ID
- user/organization ID
- plan ID
- PayPal plan ID
- status
- payer/customer reference where appropriate
- start date
- renewal/billing information where available
- last successful payment
- cancellation date
- provider metadata needed for reconciliation

Handle current relevant subscription webhook events, including:

BILLING.SUBSCRIPTION.CREATED  
BILLING.SUBSCRIPTION.ACTIVATED  
BILLING.SUBSCRIPTION.UPDATED  
BILLING.SUBSCRIPTION.SUSPENDED  
BILLING.SUBSCRIPTION.CANCELLED  
BILLING.SUBSCRIPTION.EXPIRED  
BILLING.SUBSCRIPTION.PAYMENT.FAILED

Handle subscription payment/refund/reversal events currently documented for the selected PayPal Subscriptions API, including where applicable:

PAYMENT.SALE.COMPLETED  
PAYMENT.SALE.REFUNDED  
PAYMENT.SALE.REVERSED

Map events to local subscription/entitlement state.

Entitlement rules must be explicit.

For example:

ACTIVE → paid features enabled  
SUSPENDED → apply configured grace/restriction policy  
CANCELLED → remain until paid period end if business model requires it  
EXPIRED → disable paid entitlements  
payment failed → grace period/retry/restriction according to defined policy

Do not accidentally immediately remove already-paid access on cancellation unless the intended billing model specifies it.

---

# 28. PAYPAL WEBHOOK ENDPOINT — CRITICAL

Create a dedicated HTTPS backend endpoint, e.g.:

POST /api/webhooks/paypal

or an equivalent route following the project's architecture.

The endpoint must:

1. receive the ORIGINAL webhook payload
2. preserve the raw request body as required by PayPal verification
3. read PayPal transmission headers
4. verify the notification signature against our registered `PAYPAL_WEBHOOK_ID`
5. reject unauthenticated/spoofed webhook requests
6. deduplicate by PayPal event ID
7. store an event/audit record
8. update payment/subscription state transactionally
9. acknowledge valid deliveries appropriately
10. process slow side effects asynchronously where possible

Relevant headers include current PayPal transmission/signature headers such as:

PAYPAL-TRANSMISSION-ID  
PAYPAL-TRANSMISSION-TIME  
PAYPAL-TRANSMISSION-SIG  
PAYPAL-CERT-URL  
PAYPAL-AUTH-ALGO

Follow CURRENT PayPal official documentation for signature verification.

Do not implement a homemade approximation.

The registered Webhook ID is NOT the PayPal Client ID.

Use the correct webhook ID.

Never trust event payloads before signature verification.

Protect against replay where appropriate.

Webhook processing MUST be idempotent.

Create a database table/entity such as:

payment_webhook_events

with fields equivalent to:

provider  
external_event_id UNIQUE  
event_type  
status  
received_at  
processed_at  
attempt_count  
payload or secure reference  
error

Duplicate delivery of the same PayPal event must NOT:

- duplicate a payment
- duplicate credits
- duplicate invoices
- extend subscriptions twice
- execute entitlement updates twice

Use database transactions.

---

# 29. PAYPAL WEBHOOK RELIABILITY

PayPal can retry unsuccessful webhook deliveries.

Our endpoint therefore must safely tolerate retries.

Return successful 2xx after a valid event has been accepted.

Do not perform long AI/telephony operations synchronously inside the webhook request.

Queue secondary work.

Implement logs for:

- webhook received
- signature verified/failed
- duplicate ignored
- event processed
- event failed
- reconciliation required

Add a secure internal/admin reconciliation mechanism.

If webhook processing fails after acknowledging the message, retry from our own queue.

---

# 30. PAYPAL SANDBOX TESTING

Before enabling live mode, test with PayPal Sandbox.

Test at minimum:

Successful payment  
Pending payment where applicable  
Denied payment  
Successful subscription activation  
Recurring subscription payment  
Failed subscription payment  
Subscription cancellation  
Subscription suspension  
Subscription expiration  
Refund  
Reversal  
Duplicate webhook delivery  
Invalid webhook signature  
Unknown PayPal event  
Webhook received out of order where feasible

Use PayPal's current webhook simulator where appropriate, but also perform real Sandbox transactions because simulator behavior may not be identical to real signed app events.

No live financial transactions during automated QA unless explicitly authorized.

---

# 31. BILLING DASHBOARD

Complete `/dashboard/billing`.

Display real data:

- current plan
- plan status
- renewal/billing info where available
- usage
- limits
- payment history
- payment status
- subscription ID/reference
- cancellation state
- upgrade/downgrade controls as supported
- payment errors

Provide:

Manage subscription  
Cancel subscription  
Upgrade  
Downgrade  
Retry/resolve payment where appropriate

Do not show fake invoices.

If an invoice/receipt URL is available through PayPal or our own generated record, show it appropriately.

Billing permissions should be restricted.

---

# 32. PLAN ENTITLEMENTS

Create one centralized entitlement system.

Do not scatter checks like:

`if plan === "pro"`

throughout random frontend components.

Create a server-side plan/entitlement service.

Examples:

- included minutes
- max agents
- max campaigns
- max contacts
- concurrency
- API access
- webhook access
- team seats
- recordings
- retention
- analytics

Enforce entitlements server-side.

Frontend should reflect limits but backend remains authoritative.

---

# 33. USAGE METERING

Track usage accurately.

At minimum:

- call count
- connected minutes
- total duration
- AI/telephony cost if available
- included minutes
- consumed minutes
- overage if business model supports it

Usage events should be idempotent.

Never charge/count one call twice because provider webhooks were duplicated.

---

# 34. AUDIT LOGS

Implement immutable-style audit logs for important actions.

Examples:

- user invited
- role changed
- agent created/changed/deleted
- prompt modified
- campaign launched/paused/cancelled
- contact exported
- DNC changed
- phone number acquired/released
- API key generated/revoked
- webhook changed
- recording downloaded/deleted
- billing/subscription changed

Store:

- organization
- actor
- action
- resource
- timestamp
- IP where appropriate
- request/session metadata where appropriate
- before/after summary where safe

Do not store secrets in audit logs.

Create an admin-facing audit log viewer with filters.

---

# 35. GDPR / PRIVACY CONTROLS

Dialix should be designed to support privacy and GDPR workflows.

Do NOT make unsupported legal claims such as "100% GDPR compliant".

Implement technical controls for:

- consent status
- consent source
- consent timestamp
- recording disclosure configuration
- DNC
- data retention
- delete recordings
- delete transcripts
- export data subject information
- delete/anonymize data subject information
- organization/account export where appropriate
- account deletion
- audit logs
- access controls

Create a Privacy/Compliance settings page if appropriate.

Data deletion must cascade or anonymize safely without corrupting aggregate billing/accounting records that legitimately need retention.

Sensitive information should not unnecessarily appear in logs.

---

# 36. DATA RETENTION

Implement configurable retention jobs for:

- recordings
- transcripts
- call metadata where appropriate

Do not merely hide deleted files in UI.

Actually remove or anonymize according to configured retention policy and architecture.

Record retention actions in audit logs.

---

# 37. COMPLIANCE DISCLOSURE

Allow each agent/campaign to configure a recording/AI disclosure message where required.

Do not hardcode one statement globally.

Support company/legal review.

Persist the exact disclosure configuration associated with a call when feasible for auditability.

---

# 38. SECURITY HARDENING

Perform security hardening.

Review for:

- broken access control
- IDOR
- tenant data leaks
- SQL injection
- XSS
- CSRF
- SSRF in URL-import features
- unrestricted file upload
- insecure direct storage URLs
- secret leakage
- weak session configuration
- verbose production errors
- unsafe redirects
- mass assignment
- privilege escalation
- webhook spoofing
- API abuse
- brute force
- missing rate limits

File uploads must validate:

- MIME type
- extension
- size
- file type
- filename handling

Where URL ingestion exists, prevent access to internal/private metadata endpoints and private network SSRF targets.

Do not log:

- passwords
- authentication tokens
- PayPal client secrets
- provider secrets
- complete API keys

---

# 39. RATE LIMITING

Add rate limiting for sensitive APIs:

- login
- signup
- password reset
- contact import
- call creation
- campaign launch
- API requests
- webhook configuration
- expensive AI operations

Use organization/user/API-key-aware limiting.

Return useful 429 errors.

---

# 40. IDEMPOTENCY

Support idempotency for operations that can produce costly/duplicate effects.

Examples:

- create outbound call
- launch campaign
- payment capture
- payment webhook processing
- contact bulk import where relevant
- provisioning phone numbers

Use idempotency keys or deterministic processing where appropriate.

---

# 41. OBSERVABILITY

Add production observability.

Use the project's current monitoring stack if one exists.

Track:

- request failures
- call provider errors
- STT errors
- LLM errors
- TTS errors
- queue depth
- queue failures
- webhook failures
- PayPal webhook failures
- database errors
- job retries
- latency
- call setup latency
- LLM response latency
- STT latency
- TTS latency
- websocket/stream disconnects

Add structured logs with correlation IDs.

Correlate:

organization  
campaign  
call  
provider call ID  
request/job

Do not expose sensitive data.

Create health/readiness endpoints suitable for Fly.io.

---

# 42. PROVIDER RETRIES & FALLBACKS

Where supported by the existing architecture, implement sensible retry/fallback strategies.

Examples:

STT temporary failure  
→ retry / fallback provider if configured

LLM timeout  
→ retry safe request / fallback model if supported

TTS failure  
→ fallback voice/provider if configured

Telephony API temporary failure  
→ controlled retry

Never allow infinite retry loops.

During a live call, avoid prolonged silence.

Use a graceful fallback response or transfer/termination strategy.

---

# 43. BACKGROUND JOBS

Expensive and retryable operations should use the current queue/worker architecture, or introduce a suitable production-safe queue if none exists and it is necessary.

Examples:

- campaign dialing
- webhook delivery
- transcript processing
- post-call analysis
- knowledge-base indexing
- exports
- retention deletion
- reconciliation
- emails

Jobs must support:

- retry
- max attempts
- failure state/dead letter handling where available
- idempotency

---

# 44. EMAIL NOTIFICATIONS

If email infrastructure exists, complete transactional emails:

- verify email
- password reset
- invite
- subscription activated
- payment failed
- subscription cancelled
- usage threshold reached
- campaign completed
- critical integration failure where appropriate

Use professional Dialix branding.

Never expose secrets.

---

# 45. SETTINGS

Complete settings:

Profile  
Organization  
Team  
Roles  
Security  
Billing  
API Keys  
Webhooks  
Privacy/Retention  
Integrations

Validate all forms.

Show success/error states.

Do not silently discard edits.

---

# 46. TEAM MANAGEMENT

Implement:

- invite user
- pending invitation
- resend invite
- revoke invite
- change role
- remove member
- owner protection

Do not allow removal of the last organization owner without safe ownership transfer.

---

# 47. ERROR UX

Every async operation must show appropriate states:

loading  
success  
empty  
validation error  
authorization error  
network error  
server error

Do not use generic "Something went wrong" where a safe actionable message can be provided.

Never expose internal stack traces to customers.

---

# 48. MOBILE / RESPONSIVE

Test major interfaces on:

- desktop
- tablet
- mobile

At minimum:

- login/signup
- dashboard
- agents
- contacts
- campaigns
- call history
- billing
- settings

No inaccessible sidebar, cut-off modal, horizontal overflow, or unusable data table without a responsive solution.

---

# 49. ACCESSIBILITY

Improve basic accessibility:

- semantic labels
- keyboard navigation
- focus states
- modal focus management
- accessible form errors
- button labels
- contrast
- proper headings
- ARIA only where appropriate

Preserve the Dialix visual identity.

---

# 50. DATABASE MIGRATIONS

All schema changes must use proper migrations.

Do not rely on manually changing the production database.

Review:

- indexes
- unique constraints
- foreign keys
- cascading policies
- organization/tenant keys
- event-id uniqueness
- call-provider-id indexing
- timestamps

Add indexes for common filters/searches.

---

# 51. TEST SUITE

Create/complete automated tests.

Required test layers where appropriate:

Unit tests  
Integration tests  
API tests  
Database tests  
Authorization tests  
Webhook tests  
Payment tests  
End-to-end UI tests

Critical test cases include:

Signup/login/logout  
Password reset  
Tenant isolation  
RBAC  
Agent CRUD  
Contact CRUD/import  
DNC blocking  
Campaign validation  
Campaign pause/resume  
Calling-hour blocking  
Concurrency limits  
Call state transitions  
Duplicate provider events  
Webhook signature verification  
Customer webhook retries  
PayPal successful payment  
PayPal failed payment  
PayPal duplicate webhook  
PayPal invalid signature  
PayPal subscription activation  
PayPal cancellation  
Usage entitlement enforcement  
Recording authorization  
Data deletion/retention

Do not disable failing tests merely to make CI green.

Fix the underlying issue.

---

# 52. SAFE REALISTIC CALL QA

Build automated/provider-safe tests for conversational scenarios without contacting random third parties.

Test cases:

- normal answer
- silence
- interruption/barge-in
- voicemail
- busy
- no answer
- wrong/invalid number
- caller hangs up
- network/provider failure
- French
- English
- Arabic/Darija if configured
- user asks whether this is AI
- user asks to stop calling
- user asks for human
- callback request
- tool failure
- LLM timeout

Use provider sandbox/test numbers or explicitly controlled test destinations.

Never automatically dial arbitrary real contacts as part of the development QA process.

---

# 53. PUBLIC WEBSITE CONSISTENCY

Audit marketing claims against actual product functionality.

Do not show unsupported claims like "thousands of simultaneous calls" unless the architecture and plan limits actually support the statement.

Ensure:

- pricing matches billing backend
- features match available functionality
- CTA links work
- login/signup links work
- privacy policy exists
- terms exist
- contact sales works

Do not claim regulatory certification/compliance that has not actually been established.

Preferred wording around EU privacy should be factual, e.g.:

"Built with privacy and GDPR requirements in mind"

rather than an unsupported absolute guarantee.

---

# 54. PRODUCTION ENVIRONMENT

Review Fly.io deployment configuration.

Ensure:

- correct production environment variables
- secrets stored securely
- migrations execute safely
- production build succeeds
- workers deploy where required
- health checks exist
- HTTPS enforced
- correct CORS
- secure cookies
- production logging
- no dev/debug mode
- restart behavior safe
- queue/worker connectivity
- database connection pooling
- backup strategy documented
- deployment rollback strategy exists

Never commit secrets to Git.

---

# 55. PAYPAL LIVE SWITCH SAFETY

Do NOT switch from Sandbox to Live unless live credentials already exist and the environment is explicitly intended for production.

Implementation must make the switch simple:

PAYPAL_ENV=sandbox

→

PAYPAL_ENV=live

with separate credentials/webhook IDs.

Before live activation, provide the exact production webhook URL that must be registered in the PayPal Developer Dashboard.

Example:

https://YOUR_PRODUCTION_DOMAIN/api/webhooks/paypal

Use the actual deployed backend domain/path, not this placeholder.

Also list the exact PayPal webhook events the configured app should subscribe to based on what was actually implemented.

---

# 56. RECONCILIATION

Webhooks are critical but create a reconciliation mechanism for safety.

For a payment/subscription with inconsistent local state:

- query PayPal backend API
- compare provider state
- safely update local state
- audit the action

This may be an admin command/job rather than customer-facing UI.

Never let a single temporarily missed webhook permanently corrupt billing status.

---

# 57. ADMIN / OPERATIONS CAPABILITY

If the project already has an internal admin architecture, complete it.

Otherwise create only the minimum secure operations tooling needed for launch.

Admins should be able to diagnose, without exposing user secrets:

- organization
- subscription state
- failed payment webhook
- call failure
- provider error
- failed background job
- webhook delivery
- usage

Every admin mutation should be audited.

Do not create an insecure universal admin backdoor.

---

# 58. DEFINITION OF DONE

You are NOT finished merely because:

- pages render
- build passes
- TypeScript passes
- TODO list was created
- APIs were scaffolded
- mocks work
- unit tests pass

Dialix is finished only when the critical customer workflow works:

SIGN UP  
→ VERIFY ACCOUNT  
→ LOGIN  
→ CONFIGURE ORGANIZATION  
→ CREATE/CONFIGURE AI AGENT  
→ TEST AGENT  
→ ADD/VALIDATE CONTACT  
→ CONFIGURE PHONE NUMBER  
→ CREATE CAMPAIGN  
→ DNC/CONSENT/RULE VALIDATION  
→ SCHEDULE/START  
→ CALL EXECUTION  
→ REAL STATUS UPDATES  
→ CONVERSATION  
→ TRANSFER/TOOLS WHEN REQUIRED  
→ RECORDING  
→ TRANSCRIPT  
→ POST-CALL ANALYSIS  
→ HISTORY  
→ ANALYTICS  
→ CUSTOMER WEBHOOK  
→ USAGE METERING  
→ BILLING/PAYPAL  
→ AUDIT LOG

And inbound:

PHONE NUMBER  
→ INBOUND CALL  
→ CORRECT AGENT  
→ CONVERSATION  
→ TRANSFER/TOOLS  
→ HISTORY  
→ RECORDING/TRANSCRIPT  
→ ANALYSIS  
→ USAGE/BILLING

And payment:

SELECT PLAN  
→ PAYPAL APPROVAL  
→ VERIFIED PAYMENT/SUBSCRIPTION  
→ PAYPAL WEBHOOK  
→ LOCAL TRANSACTION  
→ ENTITLEMENTS  
→ BILLING UI  
→ AUDIT LOG

---

# 59. EXECUTION BEHAVIOR

Work autonomously.

Do not stop after each file.

Do not ask me "Would you like me to continue?"

Continue until all implementable work is complete.

If you encounter a bug, fix it.

If a migration is required, create it.

If tests are missing, add them.

If an existing test fails because of your change, fix it.

If build fails, fix it.

If lint/type checking fails, fix it.

If an endpoint exists but frontend does not consume it, connect it.

If frontend exists without backend implementation, implement it.

If duplicate implementations exist, consolidate them safely.

Avoid huge unnecessary rewrites.

Preserve backwards compatibility when reasonable.

---

# 60. DO NOT FAKE COMPLETION

Never state "implemented" if you only created:

- placeholders
- TODO comments
- interfaces
- types
- unconnected routes
- dummy responses
- mock data

Clearly distinguish:

IMPLEMENTED AND TESTED  
IMPLEMENTED BUT BLOCKED BY EXTERNAL CREDENTIAL  
NOT IMPLEMENTABLE DUE TO EXTERNAL PROVIDER/ACCOUNT RESTRICTION

Everything within the repository and environment under your control should be completed.

---

# 61. FINAL VERIFICATION

Before declaring completion, run:

- dependency/install verification
- database migration verification
- lint
- formatter if configured
- type checking
- unit tests
- integration tests
- payment/webhook tests
- authorization/security tests
- end-to-end tests
- production build

Then run the app and manually/agentically verify every primary route.

Check browser console and network errors.

Check backend logs.

Repair remaining failures.

Repeat until clean.

---

# 62. FINAL DELIVERY FORMAT

Only after implementation and testing are complete, produce one final report containing:

## A. COMPLETED
Everything actually implemented.

## B. FIXED BUGS
Specific defects repaired.

## C. DATABASE CHANGES
Migrations/tables/indexes added.

## D. PAYPAL
Checkout/subscription implementation, webhook endpoint, subscribed events, signature verification, idempotency and Sandbox test results.

## E. TELEPHONY
Inbound/outbound call test results.

## F. SECURITY
Auth, RBAC, rate limits, tenant isolation and security fixes.

## G. TEST RESULTS
Exact commands and pass/fail counts.

## H. DEPLOYMENT
What was deployed and the final URL/environment.

## I. REMAINING EXTERNAL ACTIONS
ONLY credentials/account-provider actions impossible for you to perform.

For each external action, give exact steps.

Example:

PAYPAL_CLIENT_ID → required  
PAYPAL_CLIENT_SECRET → required  
PAYPAL_WEBHOOK_ID → required after registering URL  
TELEPHONY_PROVIDER_SECRET → required

Do not place ordinary engineering work in this section.

## J. GO/NO-GO
Return:

GO FOR CONTROLLED BETA

only if all P0 technical launch blockers under our control pass.

Otherwise:

NO-GO

and specify the exact blocking test(s).

---

# 63. MARKETING LAUNCH GATE

Before declaring GO, verify:

- signup works
- login works
- password reset works
- email verification works
- plan purchase works in Sandbox
- PayPal verified webhook works
- subscription status is synchronized
- tenant isolation passes
- contact import works
- DNC works
- agent works
- controlled outbound call works
- controlled inbound call works
- campaign works
- schedule/rate limits work
- transcript works
- recording permissions work
- analytics use real data
- customer webhooks work
- billing uses real data
- audit logs work
- no critical browser-console errors
- no P0 tests failing
- production build passes

Do not use visual appearance as proof of functionality.

---

# START NOW

Begin by inspecting the complete repository and current runtime.

Create an internal execution checklist.

Then implement the project systematically from critical backend infrastructure outward.

Do not return an audit first.

DO THE WORK.

Continue automatically through implementation, migration, testing, fixes and final verification until Dialix reaches the launch gate described above.
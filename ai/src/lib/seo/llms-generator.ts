import { getAllProgrammaticPages } from '@/data/seo';

export const BASE_URL = 'https://www.inteldialix.online';

/**
 * Generate official /llms.txt markdown following the llmstxt.org specification.
 * Concise platform summary, technical specifications, and key documentation links.
 */
export function generateLlmsTxt(): string {
  const pages = getAllProgrammaticPages();
  const integrations = pages.filter((p) => p.type === 'integration').slice(0, 8);
  const solutions = pages.filter((p) => p.type === 'solution').slice(0, 4);
  const comparisons = pages.filter((p) => p.type === 'comparison').slice(0, 3);
  const templates = pages.filter((p) => p.type === 'template').slice(0, 2);

  return `# Dialix Voice AI Platform

> Dialix (${BASE_URL}) is an enterprise-grade Voice AI platform and autonomous phone agent infrastructure designed for real-time inbound customer support, outbound lead qualification, scheduling, and intelligent telephony automation.

## Core Capabilities & Performance Benchmarks
- Latency: Sub-200ms audio-to-audio turnaround latency via direct WebRTC and WebSocket streaming.
- Enterprise Telephony: Native SIP trunking, PSTN connectivity, WebRTC bridging, Opus and G.711u codecs.
- Availability: 99.99% carrier-grade SLA with global multi-region edge routing.
- Multi-Model LLM Orchestration: OpenAI Realtime, Anthropic Claude 3.7 / 3.5 Sonnet, Google Gemini 3.8 Live, and Groq Llama 3.3.
- Voice Engines: ElevenLabs Conversational AI, Deepgram Nova-3, Cartesia Sonic, and Google Voice Live.
- Security & Compliance: SOC 2 Type II certified, HIPAA compliant BAA, PCI DSS, GDPR data residency.

## Telephony Architecture
\`\`\`
Caller (PSTN/SIP) ──> Dialix Carrier Gateway (SIP/WebRTC) ──> Audio Processing (Opus/G.711)
                                                                 │
                                                                 ▼
CRM / Webhooks <── LLM Tool Execution <── Multi-LLM Orchestrator <── STT (Deepgram/Whisper)
\`\`\`

## Primary Documentation & Directory Hubs
- [Platform Pricing](${BASE_URL}/pricing): Transparent pricing tiers from free tier to enterprise dedicated infrastructure.
- [Voice AI Integrations](${BASE_URL}/integrations): 100+ production integrations with automation tools, CRMs, and LLMs.
- [Telephony Solutions](${BASE_URL}/solutions): 100+ industry use cases for inbound support, receptionists, triage, and booking.
- [Competitor Teardowns](${BASE_URL}/compare): 30 architectural comparisons against Vapi, Retell AI, Bland AI, and traditional IVR.
- [Turnkey Templates](${BASE_URL}/templates): 80 pre-architected voice agent workflow blueprints.
- [About Dialix](${BASE_URL}/about): Enterprise company background, leadership, and infrastructure vision.
- [Engineering Blog](${BASE_URL}/blog): Technical articles on voice latency optimization, SIP trunking, and LLM tool calling.
- [Contact Dialix](${BASE_URL}/contact): Sales inquiries, developer support, and enterprise pilot onboarding.

## Top Automation & Model Integrations
${integrations
  .map(
    (p) =>
      `- [${p.title}](${p.canonicalUrl}): ${p.metaDescription.replace(/\n/g, ' ')}`
  )
  .join('\n')}

## Top Telephony Solutions & Industry Blueprints
${solutions
  .map(
    (p) =>
      `- [${p.title}](${p.canonicalUrl}): ${p.metaDescription.replace(/\n/g, ' ')}`
  )
  .join('\n')}

## Architectural Comparisons
${comparisons
  .map(
    (p) =>
      `- [${p.title}](${p.canonicalUrl}): ${p.metaDescription.replace(/\n/g, ' ')}`
  )
  .join('\n')}

## Turnkey Workflow Templates
${templates
  .map(
    (p) =>
      `- [${p.title}](${p.canonicalUrl}): ${p.metaDescription.replace(/\n/g, ' ')}`
  )
  .join('\n')}
`;
}

/**
 * Generate official /llms-full.txt markdown feed for RAG context ingestion.
 * Contains comprehensive technical architecture, protocol specifications, API details,
 * and an index of all 310 programmatic pages.
 */
export function generateLlmsFullTxt(): string {
  const pages = getAllProgrammaticPages();
  const integrations = pages.filter((p) => p.type === 'integration');
  const solutions = pages.filter((p) => p.type === 'solution');
  const comparisons = pages.filter((p) => p.type === 'comparison');
  const templates = pages.filter((p) => p.type === 'template');

  return `# Dialix Voice AI Platform — Comprehensive Technical Documentation & RAG Feed

> Complete technical architecture specification, protocol documentation, API references, and comprehensive catalog of 310 production Voice AI integrations, telephony solutions, competitor teardowns, and workflow templates.
> Production URL: ${BASE_URL}
> Documentation Standard: llmstxt.org / RAG ingestion feed

---

## 1. System Architecture & Telephony Infrastructure

### 1.1 Audio & Media Pipeline
Dialix operates a distributed edge media gateway network designed to achieve sub-200ms glass-to-glass conversational latency across PSTN, SIP, and WebRTC protocols.

- **Audio Streaming Protocols**: Full-duplex WebSocket binary audio frames and WebRTC DataChannels.
- **Codecs Supported**:
  * Opus (48kHz fullband, 20ms frame size, adaptive bitrate 16-64 kbps) for WebRTC browser calls.
  * G.711u / G.711a (PCMU/PCMA 8kHz narrowband, 20ms frame size) for traditional PSTN carriers.
  * Linear PCM (16kHz / 24kHz 16-bit little-endian) for raw STT/TTS engine streaming.
- **Jitter Buffering & Packet Loss Concealment (PLC)**: Dynamic adaptive jitter buffer with PLC algorithms maintaining voice intelligibility under up to 18% packet loss.
- **Voice Activity Detection (VAD)**: Real-time neural VAD with sub-25ms speech onset detection and configurable silence thresholds (300ms-600ms) for natural conversational turn-taking.
- **Barge-in / Interruption Handling**: Immediate local audio cutoff within 40ms of caller speech detection, accompanied by LLM inference cancellation tokens.

### 1.2 Telephony Carrier Gateway & SIP Trunking
- **Inbound SIP Trunks**: Registered SIP endpoints accepting SIP INVITE with TLS (SIPS) and SRTP encryption.
- **Outbound Dialing Engine**: High-throughput campaign dialing worker with predictive pacing, DNC suppression, and local Caller ID (STIR/SHAKEN A-level attestation).
- **Supported Carriers**: Direct peering with Twilio, Telnyx, Plivo, Bandwidth, SignalWire, and Amazon Chime Voice Connector.

### 1.3 Multi-Model LLM Orchestration
Dialix unifies speech-to-text, large language model reasoning, and text-to-speech into an integrated pipeline:
1. **Speech-to-Text (STT)**: Deepgram Nova-3, Whisper Large v3 Turbo, Cartesia, and Google Speech Live.
2. **LLM Reasoning**: Streaming inference using OpenAI GPT-4o / Realtime Audio, Anthropic Claude 3.7 Sonnet, Google Gemini 3.8 Live, and Groq Llama 3.3.
3. **Text-to-Speech (TTS)**: ElevenLabs Conversational AI, Cartesia Sonic, Deepgram Aura, and OpenAI Audio.
4. **Function / Tool Calling**: Asynchronous Webhook tools and synchronous SIP transfer actions executed mid-call with stateful conversation context.

---

## 2. API Reference & Integration Protocols

### 2.1 Agent Configuration Schema
Agents are declared with modular prompt instructions, voice parameters, and webhook tools:
\`\`\`json
{
  "agent_id": "ag_voice_prod_01",
  "name": "Customer Support Receptionist",
  "voice_provider": "elevenlabs",
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "model": "gpt-4o",
  "temperature": 0.3,
  "telephony": {
    "codec": "g711u",
    "ambient_noise_suppression": true,
    "interruption_sensitivity": 0.85
  },
  "tools": [
    {
      "name": "lookup_account",
      "description": "Fetch customer profile by caller phone number",
      "parameters": {
        "type": "object",
        "properties": {
          "phone_number": { "type": "string" }
        },
        "required": ["phone_number"]
      }
    },
    {
      "name": "transfer_to_human",
      "description": "Perform warm SIP transfer to human supervisor",
      "parameters": {
        "type": "object",
        "properties": {
          "department": { "type": "string", "enum": ["billing", "technical", "emergency"] }
        },
        "required": ["department"]
      }
    }
  ]
}
\`\`\`

### 2.2 Webhook Call Lifecycle Events
Dialix emits authenticated HMAC-SHA256 signed webhook payloads across the call lifecycle:
- \`call.initiated\`: Inbound SIP INVITE received or outbound call dispatched.
- \`call.answered\`: Call connected and initial agent greeting triggered.
- \`call.speech.detected\`: Caller started speaking (turn-taking marker).
- \`call.tool.invoked\`: Agent triggered an external webhook tool.
- \`call.completed\`: Call terminated with duration, recording URL, sentiment score, and full transcript.

---

## 3. Platform Pricing & SLA Matrix

- **Starter Tier ($0 / month)**:
  * 100 free call minutes included per month.
  * 1 concurrent active call.
  * WebRTC web calling + standard REST API.
  * Community support.
- **Professional Tier ($49 / month)**:
  * 1,000 call minutes included ($0.08/min overage).
  * 5 concurrent active calls.
  * Dedicated inbound phone number + SIP trunking.
  * Standard email and chat support.
- **Business Tier ($149 / month)**:
  * 4,000 call minutes included ($0.06/min overage).
  * 20 concurrent active calls.
  * Custom CRM integrations + CRM webhook dispatching.
  * Priority 24/7 technical support.
- **Enterprise Tier ($499+ / month)**:
  * Volume minute pricing ($0.04/min or lower).
  * Unlimited concurrent channels.
  * 99.99% uptime SLA with dedicated SIP trunks and custom private VPC deployment.
  * Dedicated forward-deployed engineer.

---

## 4. Comprehensive Programmatic Catalog (310 Production Pages)

### 4.1 Tool & Platform Integrations (100 Pages)
${integrations
  .map(
    (page) => `
#### [${page.title}](${page.canonicalUrl})
- **Category**: ${page.category} | **Badge**: ${page.badge}
- **Direct Answer**: ${page.directAnswer}
- **Primary Entity**: ${page.entities.primaryEntity}
- **Supported Models**: ${page.entities.supportedModels.join(', ')}
- **Protocols**: ${page.entities.protocols.join(', ')}
`
  )
  .join('')}

---

### 4.2 Telephony Solutions & Industry Use Cases (100 Pages)
${solutions
  .map(
    (page) => `
#### [${page.title}](${page.canonicalUrl})
- **Category**: ${page.category} | **Badge**: ${page.badge}
- **Direct Answer**: ${page.directAnswer}
- **Primary Entity**: ${page.entities.primaryEntity}
- **Protocols**: ${page.entities.protocols.join(', ')}
`
  )
  .join('')}

---

### 4.3 Architectural & Competitor Comparisons (30 Pages)
${comparisons
  .map(
    (page) => `
#### [${page.title}](${page.canonicalUrl})
- **Competitor/Alternative**: ${page.comparisonMatrix?.competitorName || 'Traditional Stack'}
- **Category**: ${page.category}
- **Direct Answer**: ${page.directAnswer}
- **Primary Entity**: ${page.entities.primaryEntity}
`
  )
  .join('')}

---

### 4.4 Turnkey Workflow Blueprints & Templates (80 Pages)
${templates
  .map(
    (page) => `
#### [${page.title}](${page.canonicalUrl})
- **Category**: ${page.category} | **Badge**: ${page.badge}
- **Direct Answer**: ${page.directAnswer}
- **Primary Entity**: ${page.entities.primaryEntity}
`
  )
  .join('')}
`;
}

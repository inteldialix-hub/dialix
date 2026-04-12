/* ═══════════════════════════════════════════════════════════════
   DIALIX v3 — React SPA
   All components in a single file (CDN approach, no build step)
   ═══════════════════════════════════════════════════════════════ */

const { useState, useEffect, useCallback, useRef, createElement: h } = React;

// ─── API Configuration ──────────────────────────────────────────
const API_BASE = window.location.port === '3000'
  ? 'http://localhost:3001/api'
  : '/api';

async function api(path, options = {}) {
  const { token, method = 'GET', body } = options;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Unable to connect to server. Check your connection and try again.');
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    throw new Error(`Server returned an unexpected response (${res.status})`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ─── Lucide Icon Helper ─────────────────────────────────────────
// Lucide v1.7+ uses PascalCase keys (e.g. "Settings", "ArrowLeft")
// but we pass kebab-case ("settings", "arrow-left"). Convert here.
const toPascal = (s) => s.replace(/(^|-)(\w)/g, (_, _d, c) => c.toUpperCase());

function Icon({ name, size = 15, strokeWidth = 1.75, className = '', style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const iconData = window.lucide.icons[toPascal(name)] || window.lucide.icons[name];
      if (iconData) {
        const svg = window.lucide.createElement(iconData);
        if (svg) {
          svg.setAttribute('width', size);
          svg.setAttribute('height', size);
          svg.setAttribute('stroke-width', strokeWidth);
          ref.current.appendChild(svg);
        }
      }
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={`icon ${className}`} style={{ display: 'inline-flex', alignItems: 'center', ...style }} />;
}

// ─── Diamond Logo SVG ───────────────────────────────────────────
function DiamondLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="currentColor" opacity="0.9"/>
      <path d="M12 6L18 12L12 18L6 12L12 6Z" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// CUSTOM SELECT — Dark-themed dropdown (replaces native <select>)
// ═══════════════════════════════════════════════════════════════

function CustomSelect({ value, onChange, options, placeholder = 'Select...', className = '', small = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current && options.length > 8) searchRef.current.focus();
  }, [open]);

  const selected = options.find(o => (typeof o === 'object' ? o.value : o) === value);
  const label = selected ? (typeof selected === 'object' ? selected.label : selected) : placeholder;

  const filtered = options.filter(o => {
    if (!search) return true;
    const text = typeof o === 'object' ? o.label : o;
    return text.toLowerCase().includes(search.toLowerCase());
  });

  const handleSelect = (val) => {
    onChange({ target: { value: val } }); // mimic native event
    setOpen(false);
    setSearch('');
  };

  const sizeClass = small ? 'cselect-small' : '';

  return (
    <div className={`cselect ${sizeClass} ${className} ${open ? 'open' : ''}`} ref={wrapRef}>
      <div className="cselect-trigger" onClick={() => setOpen(!open)} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } if (e.key === 'Escape') setOpen(false); }}>
        <span className={`cselect-value ${!selected ? 'placeholder' : ''}`}>{label}</span>
        <span className="cselect-arrow">
          <Icon name="chevron-down" size={14} />
        </span>
      </div>
      {open && (
        <div className="cselect-dropdown">
          {options.length > 8 && (
            <div className="cselect-search-wrap">
              <input
                ref={searchRef}
                className="cselect-search"
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="cselect-options">
            {filtered.length === 0 && (
              <div className="cselect-empty">No results</div>
            )}
            {filtered.map((o) => {
              const val = typeof o === 'object' ? o.value : o;
              const lbl = typeof o === 'object' ? o.label : o;
              const isActive = val === value;
              return (
                <div
                  key={val}
                  className={`cselect-option ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelect(val)}
                >
                  <span>{lbl}</span>
                  {isActive && <Icon name="check" size={14} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════

function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container" role="status" aria-live="polite" aria-label="Notifications">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} role="alert">
          <span className="toast-dot" aria-hidden="true" />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

let toastIdCounter = 0;
function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return { toasts, addToast };
}

// ═══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      onLogin(data.token, data.client);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" role="main" aria-label="Login">
      <form className="login-box" onSubmit={handleSubmit} aria-label="Sign in form">
        <div className="login-logo" aria-hidden="true">
          <DiamondLogo size={24} />
          <span>DIALIX</span>
        </div>
        <div className="login-subtitle">Sign in to continue</div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="form-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@dialix.ai"
            autoComplete="email"
            required
            aria-required="true"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            aria-required="true"
          />
        </div>

        {error && <div className="login-error" role="alert" aria-live="assertive">{error}</div>}

        <button
          id="login-submit"
          className="login-btn"
          type="submit"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════

function Sidebar({ client, activeView, onNavigate, onLogout }) {
  const [showPopover, setShowPopover] = useState(false);

  const initials = client.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const navItems = [
    { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
    { id: 'agents', icon: 'mic', label: 'Agents' },
    { id: 'phone-numbers', icon: 'phone', label: 'Phone Numbers' },
    { id: 'history', icon: 'clock', label: 'Call History' },
  ];

  const adminItems = [
    { id: 'admin', icon: 'users', label: 'Clients' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <nav className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-logo" aria-hidden="true">
        <DiamondLogo />
        <span>DIALIX</span>
      </div>
      <div className="sidebar-divider" aria-hidden="true" />

      <div className="nav-section-label" id="nav-label-workspace">Workspace</div>
      <div role="group" aria-labelledby="nav-label-workspace">
        {navItems.map(item => (
          <div
            key={item.id}
            id={`nav-${item.id}`}
            className={`nav-item ${activeView === item.id || (activeView === 'agent-detail' && item.id === 'agents') ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            role="button"
            tabIndex={0}
            aria-current={activeView === item.id || (activeView === 'agent-detail' && item.id === 'agents') ? 'page' : undefined}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(item.id); } }}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {client.is_admin === 1 && (
        <>
          <div className="sidebar-divider" aria-hidden="true" />
          <div className="nav-section-label" id="nav-label-admin">Admin</div>
          <div role="group" aria-labelledby="nav-label-admin">
            {adminItems.map(item => (
              <div
                key={item.id}
                id={`nav-${item.id}`}
                className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                role="button"
                tabIndex={0}
                aria-current={activeView === item.id ? 'page' : undefined}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(item.id); } }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-spacer" />

      {/* System status */}
      <div className="system-status" role="status" aria-label="System connection status">
        <span className="system-status-dot ok" aria-hidden="true" />
        <span>ElevenLabs Connected</span>
      </div>

      <div className="sidebar-divider" aria-hidden="true" />

      <div
        className="sidebar-user"
        onClick={() => setShowPopover(!showPopover)}
        role="button"
        tabIndex={0}
        aria-expanded={showPopover}
        aria-haspopup="true"
        aria-label={`User menu for ${client.name}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPopover(!showPopover); } }}
      >
        <div className="user-avatar" aria-hidden="true">{initials}</div>
        <span className="user-name">{client.name}</span>

        {showPopover && (
          <div className="user-popover" role="menu" onClick={e => e.stopPropagation()}>
            <div className="user-popover-item" role="menuitem" style={{ cursor: 'default', color: 'var(--text-tertiary)', fontSize: '11px' }}>
              {client.email}
            </div>
            <div className="user-popover-item danger" role="menuitem" onClick={onLogout} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLogout(); } }}>
              <Icon name="log-out" size={14} />
              <span>Sign out</span>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════
// SKELETON LOADERS
// ═══════════════════════════════════════════════════════════════

function SkeletonRows({ count = 4 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════

function EmptyState({ icon, title, description, action, onAction }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="btn-primary" onClick={onAction}>
          <Icon name="plus" size={13} />
          {action}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT DETAIL VIEW (Premium Tabbed Config Panel)
// ═══════════════════════════════════════════════════════════════

// ─── Fallback options (used if API fetch fails) ─────────────────
const FALLBACK_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
];

const FALLBACK_LLM_OPTIONS = [
  { value: 'gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'claude-3-5-sonnet-v2', label: 'Claude 3.5 Sonnet v2' },
];

const FALLBACK_TTS_MODEL_OPTIONS = [
  { value: 'eleven_v3_conversational', label: 'v3 Conversational' },
  { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5' },
  { value: 'eleven_turbo_v2', label: 'Turbo v2' },
  { value: 'eleven_multilingual_v2', label: 'Multilingual v2' },
];

const EAGERNESS_OPTIONS = [
  { value: 'low', label: 'Low — Very patient' },
  { value: 'patient', label: 'Patient' },
  { value: 'normal', label: 'Normal' },
  { value: 'eager', label: 'Eager' },
  { value: 'high', label: 'High — Very eager' },
];
// ═══════════════════════════════════════════════════════════════
// TEST CALL MODAL — Browser-based agent testing via WebSocket
// ═══════════════════════════════════════════════════════════════
function TestCallModal({ agentId, agentName, token, onClose }) {
  const [phase, setPhase] = useState('setup');
  const [leadName, setLeadName] = useState('Test User');
  const [callStatus, setCallStatus] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Refs to avoid stale closures
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const playCtxRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const timerRef = useRef(null);
  const isMutedRef = useRef(false);
  const callStatusRef = useRef('idle');
  const outputSRRef = useRef(16000);
  const nextPlayTimeRef = useRef(0);
  const transcriptEndRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  // Cleanup on unmount only
  useEffect(() => () => doCleanup(), []);

  const doCleanup = () => {
    console.log('[TestCall] Cleaning up...');
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (wsRef.current) { try { wsRef.current.close(); } catch(e){} wsRef.current = null; }
    if (processorRef.current) { try { processorRef.current.disconnect(); } catch(e){} processorRef.current = null; }
    if (sourceRef.current) { try { sourceRef.current.disconnect(); } catch(e){} sourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch(e){} audioCtxRef.current = null; }
    if (playCtxRef.current) { try { playCtxRef.current.close(); } catch(e){} playCtxRef.current = null; }
  };

  const doStartCall = async () => {
    try {
      setCallStatus('connecting');
      setErrorMsg('');
      console.log('[TestCall] Requesting microphone...');

      // 1. Mic permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
      });
      streamRef.current = stream;
      console.log('[TestCall] Mic granted');

      // 2. Signed URL from backend
      console.log('[TestCall] Getting signed URL...');
      const data = await api(`/agents/${agentId}/test-call/signed-url`, { token });
      const signedUrl = data.signed_url;
      console.log('[TestCall] Got signed URL');

      // 3. Audio contexts — separate for mic vs playback
      const micCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = micCtx;
      const playCtx = new (window.AudioContext || window.webkitAudioContext)();
      playCtxRef.current = playCtx;

      // 4. WebSocket
      console.log('[TestCall] Opening WebSocket...');
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[TestCall] WebSocket connected! Sending handshake...');
        // ElevenLabs handshake with dynamic variables (agent requires lead_name)
        ws.send(JSON.stringify({
          type: 'conversation_initiation_client_data',
          conversation_config_override: {},
          dynamic_variables: { lead_name: leadName },
        }));
        setCallStatus('connected');
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        setupMic(stream, micCtx, ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMsg(msg);
        } catch (e) {
          // non-JSON message, ignore
        }
      };

      ws.onerror = (err) => {
        console.error('[TestCall] WebSocket error:', err);
        setCallStatus('error');
        setErrorMsg('WebSocket connection failed');
      };

      ws.onclose = (event) => {
        console.log('[TestCall] WebSocket closed, code:', event.code, 'reason:', event.reason);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (callStatusRef.current !== 'ended' && callStatusRef.current !== 'error') {
          if (event.code === 1008) {
            setCallStatus('error');
            setErrorMsg(event.reason || 'Missing required variables');
          } else {
            setCallStatus('ended');
          }
        }
      };
    } catch (err) {
      console.error('[TestCall] Start error:', err);
      setCallStatus('error');
      setErrorMsg(err.message || 'Failed to start call');
    }
  };

  const setupMic = (stream, micCtx, ws) => {
    const source = micCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const nativeSR = micCtx.sampleRate;
    console.log('[TestCall] Mic sample rate:', nativeSR);

    const processor = micCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (isMutedRef.current) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Downsample to 16kHz if needed
      let samples;
      if (nativeSR === 16000) {
        samples = inputData;
      } else {
        const ratio = nativeSR / 16000;
        const newLen = Math.floor(inputData.length / ratio);
        samples = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          samples[i] = inputData[Math.floor(i * ratio)];
        }
      }

      // Float32 → Int16
      const pcm16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Int16 → base64
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      ws.send(JSON.stringify({ user_audio_chunk: btoa(binary) }));
    };

    source.connect(processor);
    // ScriptProcessorNode must connect to destination to fire, but use zero-gain to prevent mic playback
    const silentGain = micCtx.createGain();
    silentGain.gain.value = 0;
    processor.connect(silentGain);
    silentGain.connect(micCtx.destination);
  };

  const handleMsg = (msg) => {
    const type = msg.type;
    if (type === 'conversation_initiation_metadata') {
      // Extract the output audio format to find the correct sample rate
      const meta = msg.conversation_initiation_metadata_event || msg;
      console.log('[TestCall] Conversation metadata:', JSON.stringify(meta, null, 2));
      // Parse sample rate from output format string like "pcm_16000", "pcm_22050", "pcm_44100"
      const outputFmt = meta?.agent_output_audio_format || meta?.conversation_config?.agent?.tts?.output_format || '';
      const srMatch = outputFmt.match(/(\d{4,6})/);
      if (srMatch) {
        outputSRRef.current = parseInt(srMatch[1], 10);
        console.log('[TestCall] Output sample rate:', outputSRRef.current);
      } else {
        console.log('[TestCall] No sample rate found in format:', outputFmt, '- defaulting to 16000');
      }
      setCallStatus('connected');
    } else if (type === 'audio') {
      setCallStatus('speaking');
      const chunk = msg.audio?.chunk || msg.audio_event?.audio_base_64 || '';
      if (chunk) playChunk(chunk);
    } else if (type === 'agent_response') {
      const text = msg.agent_response_event?.agent_response || msg.agent_response || '';
      if (text) setTranscript(prev => [...prev, { role: 'agent', text }]);
      setCallStatus('listening');
    } else if (type === 'user_transcript') {
      const text = msg.user_transcription_event?.user_transcript || msg.user_transcript || '';
      if (text) setTranscript(prev => [...prev, { role: 'user', text }]);
    } else if (type === 'interruption') {
      console.log('[TestCall] Interruption');
      nextPlayTimeRef.current = 0;
    } else if (type === 'ping') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'pong', event_id: msg.ping_event?.event_id }));
      }
    } else {
      console.log('[TestCall] WS message type:', type);
    }
  };

  const playChunk = (b64) => {
    const ctx = playCtxRef.current;
    if (!b64 || !ctx) return;
    try {
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

      const buffer = ctx.createBuffer(1, float32.length, outputSRRef.current);
      buffer.getChannelData(0).set(float32);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);

      // Schedule this chunk right after the previous one ends
      const now = ctx.currentTime;
      const startAt = Math.max(now, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buffer.duration;
    } catch(e) {
      console.warn('[TestCall] Audio decode error:', e);
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
      }
      return next;
    });
  };

  const endCall = () => {
    setCallStatus('ended');
    doCleanup();
  };

  const handleClose = () => {
    doCleanup();
    onClose();
  };

  const handleRetry = () => {
    doCleanup();
    setElapsed(0);
    setTranscript([]);
    setErrorMsg('');
    setPhase('setup');
    setCallStatus('idle');
  };

  const handleStartCall = () => {
    if (!leadName.trim()) return;
    setPhase('calling');
    doStartCall();
  };

  // ── SETUP PHASE: Name input ──
  if (phase === 'setup') {
    return (
      h('div', { className: 'test-call-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        h('div', { className: 'test-call-card' },
          h('div', { className: 'test-call-close', onClick: onClose },
            h(Icon, { name: 'x', size: 16 })
          ),
          h('div', { className: 'call-avatar' },
            h(Icon, { name: 'phone', size: 32 })
          ),
          h('div', { className: 'call-agent-name' }, agentName),
          h('div', { className: 'call-status' }, 'Test this agent with a live call'),
          h('div', { className: 'call-setup-form' },
            h('div', { className: 'form-group' },
              h('label', { className: 'call-setup-label' }, 'Your Name (Lead Name)'),
              h('input', {
                type: 'text',
                className: 'call-setup-input',
                value: leadName,
                onChange: (e) => setLeadName(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter') handleStartCall(); },
                placeholder: 'e.g., John Smith',
                autoFocus: true,
              })
            )
          ),
          h('div', { className: 'call-setup-actions' },
            h('button', {
              className: 'btn-primary call-setup-start',
              onClick: handleStartCall,
              disabled: !leadName.trim(),
            }, h(Icon, { name: 'phone', size: 14 }), ' Start Call'),
            h('button', {
              className: 'btn-ghost',
              onClick: onClose,
            }, 'Cancel')
          )
        )
      )
    );
  }

  // ── CALLING PHASE ──
  const statusLabels = {
    idle: 'Starting...', connecting: 'Connecting...', connected: 'Connected',
    speaking: 'Agent is speaking', listening: 'Listening...',
    ended: 'Call ended', error: errorMsg || 'Error',
  };
  const statusDotClass = {
    idle: 'connecting', connecting: 'connecting', connected: 'connected',
    speaking: 'speaking', listening: 'connected',
    ended: '', error: 'error',
  };

  return (
    h('div', { className: 'test-call-overlay', onClick: (e) => { if (e.target === e.currentTarget && callStatus === 'ended') handleClose(); } },
      h('div', { className: 'test-call-card' },
        h('div', { className: 'test-call-close', onClick: handleClose },
          h(Icon, { name: 'x', size: 16 })
        ),
        h('div', { className: `call-avatar ${callStatus === 'connecting' || callStatus === 'idle' ? 'connecting' : ['connected','speaking','listening'].includes(callStatus) ? 'active' : callStatus === 'error' ? 'error-state' : ''}` },
          h(Icon, { name: callStatus === 'error' ? 'alert-circle' : callStatus === 'ended' ? 'phone-off' : 'phone', size: 32 })
        ),
        h('div', { className: 'call-agent-name' }, agentName),
        h('div', { className: 'call-status' },
          h('span', { className: `call-status-dot ${statusDotClass[callStatus] || ''}` }),
          statusLabels[callStatus]
        ),
        callStatus !== 'connecting' && callStatus !== 'error' &&
          h('div', { className: 'call-timer' }, fmt(elapsed)),
        callStatus !== 'ended' && callStatus !== 'error' &&
          h('div', { className: 'call-controls' },
            h('button', {
              className: `call-btn mute ${isMuted ? 'muted' : ''}`,
              onClick: toggleMute,
              title: isMuted ? 'Unmute' : 'Mute',
            }, h(Icon, { name: isMuted ? 'mic-off' : 'mic', size: 22 })),
            h('button', {
              className: 'call-btn end', onClick: endCall, title: 'End call',
            }, h(Icon, { name: 'phone-off', size: 22 }))
          ),
        (callStatus === 'ended' || callStatus === 'error') &&
          h('div', { className: 'call-controls', style: { marginTop: '8px' } },
            h('button', { className: 'btn-primary', onClick: handleRetry },
              h(Icon, { name: 'refresh-cw', size: 14 }), ' Retry'),
            h('button', { className: 'btn-ghost', onClick: handleClose }, 'Close')
          ),
        transcript.length > 0 &&
          h('div', { className: 'call-transcript' },
            ...transcript.map((t, i) =>
              h('div', { key: i, className: 'call-transcript-line' },
                h('span', { className: `call-transcript-label ${t.role}` }, t.role === 'agent' ? 'Agent:' : 'You:'),
                h('span', { className: 'call-transcript-text' }, t.text)
              )
            ),
            h('div', { ref: transcriptEndRef })
          )
      )
    )
  );
}

function AgentDetailView({ token, agentId, agentName, onBack, addToast }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [voices, setVoices] = useState([]);
  const [voiceFilter, setVoiceFilter] = useState('');
  const [dirty, setDirty] = useState({});
  const [canEdit, setCanEdit] = useState(true);
  const [allowedFeatures, setAllowedFeatures] = useState(null); // null = all visible

  // Dynamic model/language data from API (replaces hardcoded lists)
  const [ttsModelOptions, setTtsModelOptions] = useState(FALLBACK_TTS_MODEL_OPTIONS);
  const [languageOptions, setLanguageOptions] = useState(FALLBACK_LANGUAGE_OPTIONS);
  const [llmOptions, setLlmOptions] = useState(FALLBACK_LLM_OPTIONS);
  const [refreshingVoices, setRefreshingVoices] = useState(false);

  // Shared/community voice library search
  const [libraryVoices, setLibraryVoices] = useState([]);
  const [searchingLibrary, setSearchingLibrary] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Quick-call state
  const [callLeadName, setCallLeadName] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [callPhoneId, setCallPhoneId] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [callState, setCallState] = useState({ status: 'idle' });

  // Live Monitor state (must be at top level, not after returns)
  const [monitorWs, setMonitorWs] = useState(null);
  const [monitorMessages, setMonitorMessages] = useState([]);
  const [monitorConnected, setMonitorConnected] = useState(false);
  const [showMonitor, setShowMonitor] = useState(false);
  const monitorEndRef = useRef(null);

  // Voice preview state
  const [previewingVoiceId, setPreviewingVoiceId] = useState(null);
  const previewAudioRef = useRef(null);

  // Test call state
  const [showTestCall, setShowTestCall] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [agentId]);

  // Auto-scroll monitor
  useEffect(() => {
    if (monitorEndRef.current) {
      monitorEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [monitorMessages]);

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const [configData, voicesData, phoneData, modelsData] = await Promise.all([
        api(`/agents/${agentId}`, { token }),
        api('/agents/voices', { token }).catch(() => ({ voices: [] })),
        api('/phone-numbers', { token }).catch(() => ({ phoneNumbers: [] })),
        api('/agents/models', { token }).catch(() => ({ models: [], languages: [] })),
      ]);
      setConfig(configData.config);
      setCanEdit(configData.can_edit !== 0);
      setAllowedFeatures(configData.allowed_features || null);
      setVoices(voicesData.voices || []);
      setPhoneNumbers(phoneData.phoneNumbers || []);
      setDirty({});

      // Populate dynamic TTS models from API
      const apiModels = modelsData.models || [];
      if (apiModels.length > 0) {
        const ttsModels = apiModels
          .filter(m => m.can_do_text_to_speech)
          .map(m => ({ value: m.model_id, label: m.name }));
        if (ttsModels.length > 0) setTtsModelOptions(ttsModels);
      }

      // Populate dynamic languages from API
      const apiLangs = modelsData.languages || [];
      if (apiLangs.length > 0) {
        setLanguageOptions(apiLangs);
      }

      // Populate dynamic LLM models from API
      const apiLLMs = modelsData.llms || [];
      if (apiLLMs.length > 0) {
        setLlmOptions(apiLLMs);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Force-refresh voices from ElevenLabs (clears server cache)
  const refreshVoices = async () => {
    setRefreshingVoices(true);
    try {
      const data = await api('/agents/voices/refresh', { token, method: 'POST' });
      setVoices(data.voices || []);
      addToast(`Refreshed: ${data.total} voices loaded`, 'success');
    } catch (err) {
      addToast(`Failed to refresh voices: ${err.message}`, 'error');
    } finally {
      setRefreshingVoices(false);
    }
  };

  const updateField = (field, value) => {
    if (!canEdit) {
      addToast('This agent is view-only. Contact your admin for edit permissions.', 'error');
      return;
    }
    setConfig(prev => ({ ...prev, [field]: value }));
    setDirty(prev => ({ ...prev, [field]: true }));
    setSaved(false);
  };

  const saveChanges = async () => {
    if (Object.keys(dirty).length === 0) {
      addToast('No changes to save', 'info');
      return;
    }

    setSaving(true);
    try {
      // Build only the dirty fields
      const patchBody = {};
      Object.keys(dirty).forEach(key => {
        patchBody[key] = config[key];
      });

      await api(`/agents/${agentId}`, { token, method: 'PATCH', body: patchBody });
      setDirty({});
      setSaved(true);
      addToast('Agent updated successfully', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      addToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCall = async () => {
    if (!callNumber || !callPhoneId) {
      addToast('Enter a phone number and select a line', 'error');
      return;
    }
    if (!callLeadName.trim()) {
      addToast('Enter the lead name (required by the agent greeting)', 'error');
      return;
    }

    setCallState({ status: 'calling' });
    try {
      const result = await api('/calls/outbound', {
        token,
        method: 'POST',
        body: {
          agent_id: agentId,
          phone_number_id: callPhoneId,
          to_number: callNumber,
          lead_name: callLeadName.trim(),
        },
      });
      setCallState({ status: 'done', conversationId: result.conversation_id });
      addToast('Call initiated', 'success');
    } catch (err) {
      setCallState({ status: 'failed', error: err.message });
      addToast(`Call failed: ${err.message}`, 'error');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="detail-header">
          <div className="detail-back-btn" onClick={onBack}>
            <Icon name="arrow-left" size={14} />
            <span>Back</span>
          </div>
        </div>
        <div className="loading-overlay"><div className="spinner" /></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div>
        <div className="detail-header">
          <div className="detail-back-btn" onClick={onBack}>
            <Icon name="arrow-left" size={14} />
            <span>Back</span>
          </div>
        </div>
        <EmptyState icon="alert-triangle" title="Failed to load" description="Could not load agent configuration." />
      </div>
    );
  }

  const filteredVoices = voices.filter(v => {
    const q = voiceFilter.toLowerCase();
    return v.name?.toLowerCase().includes(q) ||
      (v.labels && Object.values(v.labels).some(l => l?.toLowerCase().includes(q)));
  });

  // Search the shared voice library
  const searchVoiceLibrary = async (query) => {
    if (!query || query.length < 2) {
      setLibraryVoices([]);
      return;
    }
    setSearchingLibrary(true);
    try {
      const data = await api(`/agents/voices/search?q=${encodeURIComponent(query)}`, { token });
      // Filter out voices already in account
      const accountIds = new Set(voices.map(v => v.voice_id));
      const newVoices = (data.voices || []).filter(v => !accountIds.has(v.voice_id));
      setLibraryVoices(newVoices);
    } catch (err) {
      console.error('Library search error:', err);
    } finally {
      setSearchingLibrary(false);
    }
  };

  // Add a community voice to the user's library, then select it
  const addCommunityVoice = async (voice) => {
    try {
      addToast(`Adding "${voice.name}" to your library...`, 'info');
      await api('/agents/voices/add-shared', {
        token,
        method: 'POST',
        body: {
          public_owner_id: voice.public_owner_id,
          voice_id: voice.voice_id,
          name: voice.name,
        },
      });
      addToast(`"${voice.name}" added to your library!`, 'success');
      // Refresh voices so it appears in account list
      const freshVoices = await api('/agents/voices', { token });
      setVoices(freshVoices.voices || []);
      // Select the voice
      updateField('voice_id', voice.voice_id);
      // Close library panel
      setShowLibrary(false);
      setLibraryVoices([]);
    } catch (err) {
      addToast(`Failed to add voice: ${err.message}`, 'error');
    }
  };

  // Voice preview playback
  const playVoicePreview = async (voiceId) => {
    // If already playing this voice, stop it
    if (previewingVoiceId === voiceId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewingVoiceId(null);
      return;
    }

    // Stop any current preview
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    setPreviewingVoiceId(voiceId);

    try {
      // First check if voice has a preview_url from ElevenLabs (account or library)
      const voice = voices.find(v => v.voice_id === voiceId)
        || libraryVoices.find(v => v.voice_id === voiceId);
      let audioUrl;
      if (voice?.preview_url) {
        audioUrl = voice.preview_url;
      } else {
        // Use our backend proxy endpoint
        const API_BASE = window.location.port === '3000' ? 'http://localhost:3001/api' : '/api';
        audioUrl = `${API_BASE}/agents/voices/${voiceId}/preview?token=${encodeURIComponent(token)}`;
      }

      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingVoiceId(null);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        addToast('Could not preview this voice', 'error');
        setPreviewingVoiceId(null);
        previewAudioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      addToast('Voice preview failed', 'error');
      setPreviewingVoiceId(null);
    }
  };



  const connectMonitor = (conversationId) => {
    if (monitorWs) monitorWs.close();
    setMonitorMessages([]);
    setShowMonitor(true);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.port === '3000' ? 'localhost:3001' : window.location.host;
    const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws?conversation_id=${conversationId}&token=${token}`);

    ws.onopen = () => setMonitorConnected(true);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMonitorMessages(prev => [...prev, { ...data, timestamp: new Date() }]);
      } catch {
        setMonitorMessages(prev => [...prev, { type: 'raw', message: event.data, timestamp: new Date() }]);
      }
    };
    ws.onclose = () => { setMonitorConnected(false); };
    ws.onerror = () => { setMonitorConnected(false); };
    setMonitorWs(ws);
  };

  const sendMonitorCommand = (command, params = {}) => {
    if (monitorWs && monitorWs.readyState === WebSocket.OPEN) {
      monitorWs.send(JSON.stringify({ command_type: command, parameters: params }));
    }
  };

  const disconnectMonitor = () => {
    if (monitorWs) monitorWs.close();
    setMonitorWs(null);
    setMonitorConnected(false);
    setShowMonitor(false);
  };

  // Feature gating: null = admin (all visible), else check keys
  const fv = (key) => !allowedFeatures || allowedFeatures[key] !== false;

  const tabs = [
    { id: 'general', icon: 'sliders-horizontal', label: 'General' },
    { id: 'prompt', icon: 'message-square', label: 'Prompt' },
    { id: 'voice', icon: 'mic', label: 'Voice' },
    { id: 'behavior', icon: 'timer', label: 'Call Behavior' },
    { id: 'asr', icon: 'ear', label: 'ASR' },
    { id: 'safety', icon: 'shield-check', label: 'Safety' },
    { id: 'advanced', icon: 'wrench', label: 'Advanced' },
    { id: 'privacy', icon: 'lock', label: 'Privacy' },
  ].filter(tab => {
    // Hide entire tabs if admin turned them off
    if (tab.id === 'prompt' && !fv('prompt') && !fv('llm') && !fv('temperature')) return false;
    if (tab.id === 'voice' && !fv('voice')) return false;
    if (tab.id === 'asr' && !fv('asr')) return false;
    if (tab.id === 'safety' && !fv('safety')) return false;
    if (tab.id === 'advanced' && !fv('advanced')) return false;
    return true;
  });


  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div>
      {/* Header */}
      <div className="detail-header">
        <div className="detail-back-btn" onClick={onBack}>
          <Icon name="arrow-left" size={14} />
          <span>Agents</span>
        </div>
        <div style={{ width: '1px', height: '16px', background: 'var(--border-default)' }} />
        <div className="detail-agent-info">
          <span className={`status-dot active`} />
          <span className="detail-agent-name">{config.name || agentName}</span>
          <span className="detail-agent-id">{agentId.slice(0, 20)}…</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-test-call" onClick={() => setShowTestCall(true)}>
            <Icon name="phone" size={14} />
            Test Call
          </button>
        </div>
      </div>

      {showTestCall && h(TestCallModal, {
        agentId,
        agentName: config.name || agentName,
        token,
        onClose: () => setShowTestCall(false),
      })}

      {/* Quick Call Bar */}
      {fv('call') && (
      <div className="quick-call-bar">
        <div className="call-col">
          <label>Lead Name</label>
          <input
            className="call-input"
            placeholder="e.g., John"
            value={callLeadName}
            onChange={e => setCallLeadName(e.target.value)}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="call-col">
          <label>Phone Number</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <CustomSelect
              value={callPhoneId}
              onChange={e => setCallPhoneId(e.target.value)}
              options={[{ value: '', label: 'Line...' }, ...phoneNumbers.map(pn => ({ value: pn.id, label: pn.label }))]}
              placeholder="Line..."
              className="phone-line-cselect"
            />
            <input
              className="call-input"
              placeholder="+1 234 567 8900"
              value={callNumber}
              onChange={e => setCallNumber(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>
        </div>
        <div>
          <button
            className={`call-btn ${callState.status === 'calling' ? 'calling' : ''}`}
            disabled={callState.status === 'calling' || phoneNumbers.length === 0}
            onClick={handleCall}
            style={{ minWidth: '110px', height: '34px' }}
          >
            {callState.status === 'calling' ? (
              <>Calling...</>
            ) : (
              <>
                <Icon name="phone-call" size={13} />
                Call Now
              </>
            )}
          </button>
          {callState.status === 'done' && (
            <div className="call-result" style={{ marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                className="conv-id"
                title="Click to copy"
                onClick={() => {
                  navigator.clipboard.writeText(callState.conversationId);
                  addToast('Copied conversation ID', 'info');
                }}
              >
                {callState.conversationId?.slice(0, 12)}...
              </span>
              <button
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '2px 8px', gap: '4px' }}
                onClick={() => connectMonitor(callState.conversationId)}
              >
                <Icon name="radio" size={12} />
                Live Monitor
              </button>
            </div>
          )}
        </div>
      </div>
      )}
      {/* Live Monitor Panel */}
      {showMonitor && (
        <div className="monitor-panel">
          <div className="monitor-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-dot ${monitorConnected ? 'active' : ''}`} />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>
                {monitorConnected ? 'Live Transcript' : 'Connecting...'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {callState.conversationId?.slice(0, 16)}...
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {monitorConnected && (
                <>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: '11px', padding: '2px 8px', color: 'var(--danger)' }}
                    onClick={() => sendMonitorCommand('end_call')}
                    title="End the call"
                  >
                    <Icon name="phone-off" size={12} />
                    End Call
                  </button>
                </>
              )}
              <button
                className="btn-ghost"
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={disconnectMonitor}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          </div>
          <div className="monitor-messages">
            {monitorMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                Waiting for transcript events...
              </div>
            )}
            {monitorMessages.map((msg, i) => {
              if (msg.type === 'monitor_status') {
                return (
                  <div key={i} className="monitor-msg system">
                    <Icon name="info" size={12} />
                    <span>{msg.status === 'connected' ? 'Connected to live monitoring' : msg.status === 'disconnected' ? 'Monitoring ended' : msg.message || msg.status}</span>
                  </div>
                );
              }
              if (msg.type === 'user_transcript' || msg.user_transcription_event) {
                const text = msg.user_transcription_event?.user_transcript || msg.user_transcript || msg.text || '';
                return (
                  <div key={i} className="monitor-msg user">
                    <div className="monitor-role">User</div>
                    <div className="monitor-text">{text}</div>
                    <div className="monitor-time">{msg.timestamp?.toLocaleTimeString()}</div>
                  </div>
                );
              }
              if (msg.type === 'agent_response' || msg.agent_response_event) {
                const text = msg.agent_response_event?.agent_response || msg.agent_response || msg.text || '';
                return (
                  <div key={i} className="monitor-msg agent">
                    <div className="monitor-role">Agent</div>
                    <div className="monitor-text">{text}</div>
                    <div className="monitor-time">{msg.timestamp?.toLocaleTimeString()}</div>
                  </div>
                );
              }
              // Other events (corrections, interruptions, etc.)
              return (
                <div key={i} className="monitor-msg system">
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{msg.type || 'event'}: {JSON.stringify(msg).slice(0, 120)}</span>
                </div>
              );
            })}
            <div ref={monitorEndRef} />
          </div>
        </div>
      )}


      {/* Tabs */}
      <div className="config-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`config-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={14} />
            <span>{tab.label}</span>
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div className="config-panel" key={activeTab}>

        {/* ───── GENERAL TAB ───── */}
        {activeTab === 'general' && (
          <>
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="user" size={14} />
                Agent Identity
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Name</div>
                </div>
                <input
                  className="config-input"
                  value={config.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="Agent name"
                />
              </div>

              {fv('language') && (
              <div className="config-row">
                <div>
                  <div className="config-label">Language</div>
                </div>
                <CustomSelect
                  value={config.language}
                  onChange={e => updateField('language', e.target.value)}
                  options={languageOptions}
                  placeholder="Select language"
                />
              </div>
              )}

              {fv('first_message') && (
              <div className="config-row">
                <div>
                  <div className="config-label">First Message</div>
                  <div className="config-sublabel">The agent's opening greeting. Use {'{{lead_name}}'} for dynamic names.</div>
                </div>
                <textarea
                  className="config-textarea"
                  value={config.first_message}
                  onChange={e => updateField('first_message', e.target.value)}
                  placeholder="Hi {{lead_name}}, how are you?"
                  style={{ minHeight: '80px' }}
                />
              </div>
              )}

              <div className="config-row">
                <div>
                  <div className="config-label">Block Interruptions</div>
                  <div className="config-sublabel">Prevent users from interrupting the first message</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.disable_first_message_interruptions}
                    onChange={e => updateField('disable_first_message_interruptions', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>
            </div>
          </>
        )}

        {/* ───── PROMPT TAB ───── */}
        {activeTab === 'prompt' && (
          <>
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="brain" size={14} />
                AI Model
              </div>

              {fv('llm') && (
              <div className="config-row">
                <div>
                  <div className="config-label">LLM</div>
                  <div className="config-sublabel">The AI model powering the agent</div>
                </div>
                <CustomSelect
                  value={config.llm}
                  onChange={e => updateField('llm', e.target.value)}
                  options={[
                    ...llmOptions,
                    ...(config.llm && !llmOptions.find(o => o.value === config.llm) ? [{ value: config.llm, label: config.llm }] : [])
                  ]}
                  placeholder="Select LLM"
                />
              </div>
              )}

              {fv('temperature') && (
              <>
              <div className="config-row">
                <div>
                  <div className="config-label">Temperature</div>
                  <div className="config-sublabel">Higher = more creative, lower = more focused</div>
                </div>
                <div className="config-slider-wrap">
                  <input
                    type="range"
                    className="config-slider"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature}
                    onChange={e => updateField('temperature', parseFloat(e.target.value))}
                  />
                  <span className="config-slider-value">{config.temperature.toFixed(2)}</span>
                </div>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Max Tokens</div>
                  <div className="config-sublabel">-1 = no limit</div>
                </div>
                <input
                  className="config-input"
                  type="number"
                  value={config.max_tokens}
                  onChange={e => updateField('max_tokens', parseInt(e.target.value))}
                  min="-1"
                  max="8192"
                />
              </div>
              </>
              )}
            </div>

            {fv('prompt') && (
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="message-square" size={14} />
                System Prompt
              </div>

              <textarea
                className="config-textarea"
                value={config.prompt}
                onChange={e => updateField('prompt', e.target.value)}
                placeholder="You are a helpful assistant..."
                style={{ minHeight: '240px' }}
              />
            </div>
            )}
          </>
        )}

        {/* ───── VOICE TAB ───── */}
        {activeTab === 'voice' && (
          <>
            <div className="config-section">
              <div className="config-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="mic" size={14} />
                  Voice Selection
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--text-quaternary)',
                    background: 'var(--bg-inset)',
                    padding: '1px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {voices.length} voices
                  </span>
                </span>
                <button
                  className="btn-ghost"
                  onClick={refreshVoices}
                  disabled={refreshingVoices}
                  title="Refresh voice list from ElevenLabs"
                  style={{ fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                >
                  <Icon name={refreshingVoices ? 'loader' : 'refresh-cw'} size={12} />
                  {refreshingVoices ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              <div className="config-row" style={{ display: 'block' }}>
                <div style={{ marginBottom: '12px' }}>
                  <div className="config-label">Voice</div>
                  <div className="config-sublabel">Select a voice for your agent. Click the play button to preview.</div>
                </div>
                <div>
                  <div className="search-bar" style={{ margin: '0 0 12px', padding: '8px 12px' }}>
                    <Icon name="search" size={14} />
                    <input
                      placeholder="Search voices..."
                      value={voiceFilter}
                      onChange={e => setVoiceFilter(e.target.value)}
                    />
                  </div>
                  <div className="voice-list" style={{ maxHeight: '280px' }}>
                    {filteredVoices.map(v => {
                      const isSelected = config.voice_id === v.voice_id;
                      const isPreviewing = previewingVoiceId === v.voice_id;
                      return (
                        <div
                          key={v.voice_id}
                          className={`voice-picker-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => updateField('voice_id', v.voice_id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Select voice ${v.name}`}
                          onKeyDown={e => e.key === 'Enter' && updateField('voice_id', v.voice_id)}
                        >
                          <div className="voice-avatar">
                            <Icon name={isSelected ? 'check' : 'mic'} size={16} />
                          </div>
                          <div className="voice-info">
                            <div className="voice-name">{v.name}</div>
                            <div className="voice-labels">
                              {v.labels ? Object.values(v.labels).filter(Boolean).join(' · ') : 'Voice'}
                            </div>
                          </div>
                          <button
                            className={`voice-preview-btn ${isPreviewing ? 'playing' : ''}`}
                            onClick={e => { e.stopPropagation(); playVoicePreview(v.voice_id); }}
                            title={isPreviewing ? 'Stop preview' : 'Play preview'}
                            aria-label={isPreviewing ? `Stop previewing ${v.name}` : `Preview ${v.name}`}
                          >
                            <Icon name={isPreviewing ? 'square' : 'play'} size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {filteredVoices.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
                        No voices match in your account
                        {voiceFilter.length >= 2 && (
                          <button
                            className="btn-ghost"
                            onClick={() => { setShowLibrary(true); searchVoiceLibrary(voiceFilter); }}
                            style={{ display: 'block', margin: '8px auto 0', fontSize: '11px', color: 'var(--accent)' }}
                          >
                            <Icon name="globe" size={12} />
                            Search community voice library
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Shared/Community Voice Library Results */}
                  {showLibrary && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: '8px', padding: '0 4px'
                      }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-quaternary)', fontWeight: 600 }}>
                          <Icon name="globe" size={11} /> COMMUNITY VOICES
                          {libraryVoices.length > 0 && ` (${libraryVoices.length})`}
                        </span>
                        <button
                          className="btn-ghost"
                          onClick={() => { setShowLibrary(false); setLibraryVoices([]); }}
                          style={{ fontSize: '10px', padding: '2px 6px' }}
                        >Close</button>
                      </div>
                      <div className="search-bar" style={{ margin: '0 0 8px', padding: '6px 10px' }}>
                        <Icon name="search" size={13} />
                        <input
                          placeholder="Search library (e.g. name, accent, style)..."
                          defaultValue={voiceFilter}
                          onChange={e => {
                            clearTimeout(window._libSearchTimer);
                            window._libSearchTimer = setTimeout(() => searchVoiceLibrary(e.target.value), 400);
                          }}
                        />
                        {searchingLibrary && <Icon name="loader" size={14} />}
                      </div>
                      <div className="voice-list" style={{ maxHeight: '200px' }}>
                        {libraryVoices.map(v => {
                          const isSelected = config.voice_id === v.voice_id;
                          return (
                            <div
                              key={v.voice_id}
                              className={`voice-picker-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => addCommunityVoice(v)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="voice-avatar" style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
                                <Icon name="globe" size={14} />
                              </div>
                              <div className="voice-info">
                                <div className="voice-name">{v.name}</div>
                                <div className="voice-labels">
                                  {v.accent ? `${v.accent} · ` : ''}{v.gender || ''}{v.category ? ` · ${v.category}` : ''}{v.description ? ` · ${v.description.slice(0, 50)}` : ''}
                                </div>
                              </div>
                              <button
                                className={`voice-preview-btn ${previewingVoiceId === v.voice_id ? 'playing' : ''}`}
                                onClick={e => { e.stopPropagation(); playVoicePreview(v.voice_id); }}
                                title={previewingVoiceId === v.voice_id ? 'Stop preview' : 'Play preview'}
                                aria-label={previewingVoiceId === v.voice_id ? `Stop previewing ${v.name}` : `Preview ${v.name}`}
                              >
                                <Icon name={previewingVoiceId === v.voice_id ? 'square' : 'play'} size={14} />
                              </button>
                            </div>
                          );
                        })}
                        {libraryVoices.length === 0 && !searchingLibrary && (
                          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-quaternary)', fontSize: '11px' }}>
                            Type a name or style to search the community library
                          </div>
                        )}
                        {searchingLibrary && (
                          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                            Searching...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">TTS Model</div>
                </div>
                <CustomSelect
                  value={config.tts_model_id}
                  onChange={e => updateField('tts_model_id', e.target.value)}
                  options={[
                    ...ttsModelOptions,
                    ...(config.tts_model_id && !ttsModelOptions.find(o => o.value === config.tts_model_id) ? [{ value: config.tts_model_id, label: config.tts_model_id }] : [])
                  ]}
                  placeholder="Select TTS Model"
                />
              </div>
            </div>

            <div className="config-section">
              <div className="config-section-title">
                <Icon name="sliders-horizontal" size={14} />
                Voice Parameters
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Stability</div>
                  <div className="config-sublabel">Higher = more consistent, lower = more expressive</div>
                </div>
                <div className="config-slider-wrap">
                  <input
                    type="range"
                    className="config-slider"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.stability}
                    onChange={e => updateField('stability', parseFloat(e.target.value))}
                  />
                  <span className="config-slider-value">{config.stability.toFixed(2)}</span>
                </div>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Speed</div>
                  <div className="config-sublabel">0.5 (slow) — 2.0 (fast)</div>
                </div>
                <div className="config-slider-wrap">
                  <input
                    type="range"
                    className="config-slider"
                    min="0.5"
                    max="2"
                    step="0.01"
                    value={config.speed}
                    onChange={e => updateField('speed', parseFloat(e.target.value))}
                  />
                  <span className="config-slider-value">{config.speed.toFixed(2)}</span>
                </div>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Similarity Boost</div>
                  <div className="config-sublabel">How closely the voice matches the original</div>
                </div>
                <div className="config-slider-wrap">
                  <input
                    type="range"
                    className="config-slider"
                    min="0"
                    max="1"
                    step="0.01"
                    value={config.similarity_boost}
                    onChange={e => updateField('similarity_boost', parseFloat(e.target.value))}
                  />
                  <span className="config-slider-value">{config.similarity_boost.toFixed(2)}</span>
                </div>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Latency Optimization</div>
                  <div className="config-sublabel">0 = best quality, 4 = lowest latency</div>
                </div>
                <div className="config-slider-wrap">
                  <input
                    type="range"
                    className="config-slider"
                    min="0"
                    max="4"
                    step="1"
                    value={config.optimize_streaming_latency}
                    onChange={e => updateField('optimize_streaming_latency', parseInt(e.target.value))}
                  />
                  <span className="config-slider-value">{config.optimize_streaming_latency}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ───── CALL BEHAVIOR TAB ───── */}
        {activeTab === 'behavior' && (
          <>
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="timer" size={14} />
                Turn Management
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Turn Timeout</div>
                  <div className="config-sublabel">Seconds before the agent considers the user done speaking</div>
                </div>
                <div className="config-slider-wrap">
                  <input
                    type="range"
                    className="config-slider"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={config.turn_timeout}
                    onChange={e => updateField('turn_timeout', parseFloat(e.target.value))}
                  />
                  <span className="config-slider-value">{config.turn_timeout.toFixed(1)}s</span>
                </div>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Eagerness</div>
                  <div className="config-sublabel">How quickly the agent starts responding</div>
                </div>
                <CustomSelect
                  value={config.turn_eagerness}
                  onChange={e => updateField('turn_eagerness', e.target.value)}
                  options={EAGERNESS_OPTIONS}
                  placeholder="Select eagerness"
                />
              </div>
            </div>

            <div className="config-section">
              <div className="config-section-title">
                <Icon name="phone-off" size={14} />
                Call Limits
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Silence Hangup</div>
                  <div className="config-sublabel">Seconds of silence before auto hanging up</div>
                </div>
                <div className="config-slider-wrap">
                  <input
                    type="range"
                    className="config-slider"
                    min="3"
                    max="60"
                    step="1"
                    value={config.silence_end_call_timeout}
                    onChange={e => updateField('silence_end_call_timeout', parseFloat(e.target.value))}
                  />
                  <span className="config-slider-value">{config.silence_end_call_timeout.toFixed(0)}s</span>
                </div>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Max Duration</div>
                  <div className="config-sublabel">Maximum call length in seconds</div>
                </div>
                <input
                  className="config-input"
                  type="number"
                  value={config.max_duration_seconds}
                  onChange={e => updateField('max_duration_seconds', parseInt(e.target.value))}
                  min="30"
                  max="3600"
                />
              </div>
            </div>
          </>
        )}

        {/* ───── ASR TAB ───── */}
        {activeTab === 'asr' && (
          <>
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="ear" size={14} />
                Speech Recognition
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">ASR Quality</div>
                  <div className="config-sublabel">Higher quality = better accuracy but more latency</div>
                </div>
                <CustomSelect
                  value={config.asr_quality || 'high'}
                  onChange={e => updateField('asr_quality', e.target.value)}
                  options={[
                    { value: 'high', label: 'High' },
                    { value: 'low', label: 'Low (faster)' }
                  ]}
                  placeholder="Select quality"
                />
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">ASR Provider</div>
                  <div className="config-sublabel">The speech-to-text engine used to understand callers</div>
                </div>
                <CustomSelect
                  value={config.asr_provider || 'scribe_realtime'}
                  onChange={e => updateField('asr_provider', e.target.value)}
                  options={[
                    { value: 'scribe_realtime', label: 'Scribe Realtime (ElevenLabs)' },
                    { value: 'scribe_realtime_experimental', label: 'Scribe Experimental' },
                    { value: 'deepgram', label: 'Deepgram' },
                    { value: 'google', label: 'Google STT' }
                  ]}
                  placeholder="Select ASR provider"
                />
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Keywords</div>
                  <div className="config-sublabel">Important words the ASR should prioritize (comma-separated)</div>
                </div>
                <input
                  className="config-input"
                  value={(config.asr_keywords || []).join(', ')}
                  onChange={e => updateField('asr_keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="e.g., Dialix, ElevenLabs, CRM"
                />
              </div>
            </div>

            <div className="config-section">
              <div className="config-section-title">
                <Icon name="activity" size={14} />
                Voice Activity Detection
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Background Voice Detection</div>
                  <div className="config-sublabel">Detect and filter out background voices/noise</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.background_voice_detection !== false}
                    onChange={e => updateField('background_voice_detection', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>
            </div>
          </>
        )}

        {/* ───── SAFETY TAB ───── */}
        {activeTab === 'safety' && (
          <>
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="shield-check" size={14} />
                Guardrails
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Focus Mode</div>
                  <div className="config-sublabel">Keep the agent focused on its instructions — prevent off-topic conversations</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.guardrail_focus || false}
                    onChange={e => updateField('guardrail_focus', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Prompt Injection Protection</div>
                  <div className="config-sublabel">Block attempts to override the agent's instructions</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.guardrail_prompt_injection || false}
                    onChange={e => updateField('guardrail_prompt_injection', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>
            </div>

            <div className="config-section">
              <div className="config-section-title">
                <Icon name="eye" size={14} />
                Monitoring
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Enable Monitoring</div>
                  <div className="config-sublabel">Allow live transcript monitoring during calls (required for Live Monitor)</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.monitoring_enabled || false}
                    onChange={e => updateField('monitoring_enabled', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>
            </div>
          </>
        )}

        {/* ───── ADVANCED TAB ───── */}
        {activeTab === 'advanced' && (
          <>
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="gauge" size={14} />
                Call Limits
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Concurrent Call Limit</div>
                  <div className="config-sublabel">Max simultaneous calls (-1 = unlimited)</div>
                </div>
                <input
                  className="config-input"
                  type="number"
                  value={config.agent_concurrency_limit ?? -1}
                  onChange={e => updateField('agent_concurrency_limit', parseInt(e.target.value))}
                  min="-1"
                  max="1000"
                  style={{ width: '100px' }}
                />
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Daily Call Limit</div>
                  <div className="config-sublabel">Maximum calls per day for this agent</div>
                </div>
                <input
                  className="config-input"
                  type="number"
                  value={config.daily_limit ?? 100000}
                  onChange={e => updateField('daily_limit', parseInt(e.target.value))}
                  min="1"
                  max="1000000"
                  style={{ width: '120px' }}
                />
              </div>
            </div>

            <div className="config-section">
              <div className="config-section-title">
                <Icon name="key" size={14} />
                Authentication
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Require Auth</div>
                  <div className="config-sublabel">Require authentication before conversations start</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.enable_auth || false}
                    onChange={e => updateField('enable_auth', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>
            </div>

            <div className="config-section">
              <div className="config-section-title">
                <Icon name="tag" size={14} />
                Tags
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Tags</div>
                  <div className="config-sublabel">Comma-separated labels for organizing agents</div>
                </div>
                <input
                  className="config-input"
                  value={(config.tags || []).join(', ')}
                  onChange={e => updateField('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="e.g., sales, support, demo"
                />
              </div>
            </div>

            <div className="config-section">
              <div className="config-section-title">
                <Icon name="code" size={14} />
                Voice Settings Extended
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Expressive Mode</div>
                  <div className="config-sublabel">Enable more emotional and expressive voice output</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.expressive_mode || false}
                    onChange={e => updateField('expressive_mode', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Hinglish Mode</div>
                  <div className="config-sublabel">Enable Hindi-English code-switching support</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.hinglish_mode || false}
                    onChange={e => updateField('hinglish_mode', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>
            </div>
          </>
        )}

        {/* ───── PRIVACY TAB ───── */}
        {activeTab === 'privacy' && (
          <>
            <div className="config-section">
              <div className="config-section-title">
                <Icon name="lock" size={14} />
                Recording & Data
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Record Voice</div>
                  <div className="config-sublabel">Store audio recordings of conversations</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.record_voice}
                    onChange={e => updateField('record_voice', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Zero Retention</div>
                  <div className="config-sublabel">No data stored after conversation ends</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.zero_retention_mode}
                    onChange={e => updateField('zero_retention_mode', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Delete Transcripts</div>
                  <div className="config-sublabel">Remove transcripts and PII after processing</div>
                </div>
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={config.delete_transcript_and_pii}
                    onChange={e => updateField('delete_transcript_and_pii', e.target.checked)}
                  />
                  <span className="config-toggle-track" />
                </label>
              </div>

              <div className="config-row">
                <div>
                  <div className="config-label">Retention Days</div>
                  <div className="config-sublabel">How long data is kept (days)</div>
                </div>
                <input
                  className="config-input"
                  type="number"
                  value={config.retention_days}
                  onChange={e => updateField('retention_days', parseInt(e.target.value))}
                  min="1"
                  max="365"
                  style={{ width: '100px' }}
                />
              </div>
            </div>
          </>
        )}

        {/* Save Bar */}
        <div className="config-save-bar">
          {!canEdit && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: 'var(--text-tertiary)',
              background: 'rgba(251,191,36,0.08)', padding: '4px 10px',
              borderRadius: '6px', border: '1px solid rgba(251,191,36,0.15)',
            }}>
              <Icon name="lock" size={12} />
              <span>View Only — You cannot edit this agent</span>
            </div>
          )}
          {saved && (
            <div className="save-status">
              <Icon name="check" size={14} />
              <span>Saved</span>
            </div>
          )}
          <button
            className={`btn-save ${saving ? 'saving' : ''}`}
            onClick={saveChanges}
            disabled={saving || !hasDirty || !canEdit}
          >
            {saving ? (
              <>
                <div className="spinner" />
                Saving...
              </>
            ) : !canEdit ? (
              <>
                <Icon name="lock" size={14} />
                View Only
              </>
            ) : (
              <>
                <Icon name="save" size={14} />
                {hasDirty ? 'Save Changes' : 'No Changes'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENTS VIEW (List + Detail)
// ═══════════════════════════════════════════════════════════════

function AgentsView({ token, addToast, onOpenDetail }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const agentsData = await api('/agents', { token });
      setAgents(agentsData.agents || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Consistent color per agent based on ID hash
  const ICON_COLORS = ['purple', 'blue', 'orange', 'green', 'pink', 'cyan', 'red', 'indigo'];
  const ICON_NAMES = ['bot', 'headphones', 'mic', 'phone-call', 'speech', 'radio', 'volume-2', 'megaphone'];
  const getAgentColor = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
    return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
  };
  const getAgentIcon = (id) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 3) - hash) + id.charCodeAt(i);
    return ICON_NAMES[Math.abs(hash) % ICON_NAMES.length];
  };

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.agent_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div>
        <div className="page-title-section">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" style={{ width: 240, marginTop: 8 }} />
        </div>
        <div style={{ padding: '0 32px 16px' }}>
          <div className="skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)' }} />
        </div>
        <div className="loading-skeleton-rows">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div>
        <div className="page-title-section">
          <h2>Agents</h2>
          <p>Manage your AI voice agents</p>
        </div>
        <EmptyState
          icon="mic"
          title="No agents assigned"
          description="Contact your admin to assign AI agents to your account."
        />
      </div>
    );
  }

  return (
    <div>
      {/* Big title — like ElevenLabs */}
      <div className="page-title-section">
        <h2>Agents</h2>
        <p>Manage and configure your AI voice agents</p>
      </div>

      {/* Search bar */}
      <div className="search-bar">
        <Icon name="search" size={16} />
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Agent list header — like ElevenLabs table columns */}
      <div className="agent-list-header">
        <span style={{ width: 34 }} />
        <span style={{ width: 16 }} />
        <span style={{ flex: 1 }}>Name</span>
        <span style={{ width: 160 }}>ID</span>
        <span style={{ width: 220, textAlign: 'right' }}>Details</span>
      </div>

      {filteredAgents.map(agent => (
        <div
          key={agent.agent_id}
          className="agent-row"
          onClick={() => onOpenDetail(agent.agent_id, agent.name)}
        >
          <div className={`agent-icon ${getAgentColor(agent.agent_id)}`}>
            <Icon name={getAgentIcon(agent.agent_id)} size={15} />
          </div>
          <span className={`status-dot ${agent.status}`} />
          <span className="agent-name">{agent.name}</span>
          <span className="agent-id">{agent.agent_id.slice(0, 16)}...</span>
          <span className="ml-auto" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {agent.language && (
              <span className="agent-lang-badge">{agent.language}</span>
            )}
            {agent.llm && (
              <span className="agent-llm-badge">{agent.llm.split('-').slice(0,2).join('-')}</span>
            )}
            <span className="expand-arrow"><Icon name="chevron-right" size={14} /></span>
          </span>
        </div>
      ))}

      {filteredAgents.length === 0 && searchQuery && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          No agents matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PHONE NUMBERS VIEW
// ═══════════════════════════════════════════════════════════════

function PhoneNumbersView({ token, addToast, agents }) {
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPhoneNumbers(); }, []);

  const loadPhoneNumbers = async () => {
    setLoading(true);
    try {
      const data = await api('/phone-numbers', { token });
      setPhoneNumbers(data.phoneNumbers || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this phone number?')) return;
    try {
      await api(`/phone-numbers/${id}`, { token, method: 'DELETE' });
      setPhoneNumbers(prev => prev.filter(pn => pn.id !== id));
      addToast('Phone number deleted', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAssign = async (phoneId, agentId) => {
    try {
      await api(`/phone-numbers/${phoneId}/assign`, { token, method: 'POST', body: { agent_id: agentId } });
      setPhoneNumbers(prev => prev.map(pn =>
        pn.id === phoneId ? { ...pn, assigned_agent_id: agentId } : pn
      ));
      addToast('Phone number assigned', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="page-title-section">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" style={{ width: 260, marginTop: 8 }} />
        </div>
        <div className="loading-skeleton-rows" style={{ margin: '0 32px' }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-row" />)}
        </div>
      </div>
    );
  }

  if (phoneNumbers.length === 0) {
    return (
      <div>
        <div className="page-title-section">
          <h2>Phone Numbers</h2>
          <p>Connect Twilio or SIP numbers to make calls</p>
        </div>
        <EmptyState
          icon="phone"
          title="No phone numbers connected"
          description="Add a Twilio or SIP number to start making calls."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-title-section">
        <h2>Phone Numbers</h2>
        <p>Manage your connected phone numbers</p>
      </div>
      <div style={{ padding: '0 32px' }}>
    <table className="data-table">
      <thead>
        <tr>
          <th>Label</th>
          <th>Phone Number</th>
          <th>Provider</th>
          <th>Assigned To</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {phoneNumbers.map(pn => (
          <tr key={pn.id}>
            <td>{pn.label}</td>
            <td className="phone-cell">{pn.phone_number}</td>
            <td>
              <span className={`badge ${pn.provider}`}>
                {pn.provider === 'twilio' ? 'Twilio' : 'SIP'}
              </span>
            </td>
            <td>
              <CustomSelect
                small
                value={pn.assigned_agent_id || ''}
                onChange={e => handleAssign(pn.id, e.target.value)}
                options={[{ value: '', label: 'Unassigned' }, ...(agents || []).map(a => ({ value: a.agent_id, label: a.name }))]}
                placeholder="Unassigned"
              />
            </td>
            <td>
              <div className="table-actions">
                <div className="btn-icon danger" onClick={() => handleDelete(pn.id)} title="Delete">
                  <Icon name="trash-2" size={14} />
                </div>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADD PHONE NUMBER MODAL
// ═══════════════════════════════════════════════════════════════

function AddPhoneModal({ token, addToast, onClose, onAdded }) {
  const [provider, setProvider] = useState('twilio');
  const [loading, setLoading] = useState(false);

  // Twilio fields
  const [label, setLabel] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [phoneNumberSid, setPhoneNumberSid] = useState('');

  // SIP fields
  const [terminationUri, setTerminationUri] = useState('');
  const [sipUsername, setSipUsername] = useState('');
  const [sipPassword, setSipPassword] = useState('');
  const [transport, setTransport] = useState('tls');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (provider === 'twilio') {
        result = await api('/phone-numbers/twilio', {
          token,
          method: 'POST',
          body: { label, phone_number: phoneNumber, account_sid: accountSid, auth_token: authToken, phone_number_sid: phoneNumberSid },
        });
      } else {
        result = await api('/phone-numbers/sip', {
          token,
          method: 'POST',
          body: { label, phone_number: phoneNumber, termination_uri: terminationUri, username: sipUsername, password: sipPassword, transport },
        });
      }
      addToast('Phone number connected', 'success');
      onAdded(result.phoneNumber);
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Add Phone Number</div>

        <div className="provider-toggle">
          <div
            className={`provider-tab ${provider === 'twilio' ? 'active' : ''}`}
            onClick={() => setProvider('twilio')}
          >
            Twilio
          </div>
          <div
            className={`provider-tab ${provider === 'sip' ? 'active' : ''}`}
            onClick={() => setProvider('sip')}
          >
            SIP Trunk
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Label</label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g., Main Line" required />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1 234 567 8900" required />
          </div>

          {provider === 'twilio' ? (
            <>
              <div className="form-group">
                <label className="form-label">Account SID</label>
                <input className="form-input" value={accountSid} onChange={e => setAccountSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" required />
              </div>
              <div className="form-group">
                <label className="form-label">Auth Token</label>
                <input className="form-input" type="password" value={authToken} onChange={e => setAuthToken(e.target.value)} placeholder="••••••••••••••••" required />
                <div className="form-note warning">This token is sent to ElevenLabs for verification and is never stored.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number SID <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                <input className="form-input" value={phoneNumberSid} onChange={e => setPhoneNumberSid(e.target.value)} placeholder="PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                <div className="form-note" style={{ color: 'var(--accent)' }}>Leave blank — we'll auto-detect it from Twilio using your Account SID.</div>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Termination URI</label>
                <input className="form-input" value={terminationUri} onChange={e => setTerminationUri(e.target.value)} placeholder="sip.provider.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={sipUsername} onChange={e => setSipUsername(e.target.value)} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" value={sipPassword} onChange={e => setSipPassword(e.target.value)} placeholder="Optional" />
                <div className="form-note warning">SIP credentials are sent to ElevenLabs and never stored.</div>
              </div>
              <div className="form-group">
                <label className="form-label">Transport</label>
                <CustomSelect
                  value={transport}
                  onChange={e => setTransport(e.target.value)}
                  options={[
                    { value: 'tls', label: 'TLS' },
                    { value: 'tcp', label: 'TCP' },
                    { value: 'udp', label: 'UDP' }
                  ]}
                  placeholder="Select transport"
                />
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : `Connect ${provider === 'twilio' ? 'Twilio' : 'SIP'} Number`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALL HISTORY VIEW (standalone page) — Enhanced
// ═══════════════════════════════════════════════════════════════

function CallHistoryView({ token, addToast }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await api('/agents', { token });
      setAgents(data.agents || []);
      if (data.agents?.length > 0) {
        setSelectedAgent(data.agents[0].agent_id);
        loadHistory(data.agents[0].agent_id);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (agentId) => {
    setLoading(true);
    setExpandedId(null);
    setDetailData(null);
    try {
      const data = await api(`/calls/history/${agentId}`, { token });
      setConversations(data.conversations || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAgentChange = (agentId) => {
    setSelectedAgent(agentId);
    loadHistory(agentId);
  };

  // Format duration nicely (seconds → "Xm Ys")
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const s = Math.round(Number(seconds));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  };

  // Expand row to show transcript detail
  const toggleExpand = async (convId) => {
    if (expandedId === convId) {
      setExpandedId(null);
      setDetailData(null);
      return;
    }
    setExpandedId(convId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const data = await api(`/admin/conversations/${convId}`, { token });
      setDetailData(data.conversation || data);
    } catch (err) {
      // If not admin, try a simpler fallback or just show error
      setDetailData({ error: 'Admin access required to view transcript details.' });
    } finally {
      setDetailLoading(false);
    }
  };

  // Delete a conversation (admin only)
  const handleDeleteConversation = async (convId) => {
    try {
      await api(`/admin/conversations/${convId}`, { token, method: 'DELETE' });
      setConversations(prev => prev.filter(c => (c.conversation_id || c.id) !== convId));
      setDeleteTarget(null);
      setExpandedId(null);
      addToast('Conversation deleted', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to delete conversation', 'error');
      setDeleteTarget(null);
    }
  };

  // Status badge helper
  const statusBadge = (status) => {
    const s = (status || 'unknown').toLowerCase();
    const map = {
      done: { bg: 'rgba(74,222,128,0.12)', color: 'var(--green)', label: 'Completed' },
      completed: { bg: 'rgba(74,222,128,0.12)', color: 'var(--green)', label: 'Completed' },
      failed: { bg: 'var(--red-bg)', color: 'var(--red)', label: 'Failed' },
      error: { bg: 'var(--red-bg)', color: 'var(--red)', label: 'Error' },
      in_progress: { bg: 'rgba(94,106,210,0.12)', color: 'var(--accent)', label: 'In Progress' },
      active: { bg: 'rgba(94,106,210,0.12)', color: 'var(--accent)', label: 'Active' },
    };
    const badge = map[s] || { bg: 'var(--bg-hover)', color: 'var(--text-tertiary)', label: status || 'Unknown' };
    return h('span', {
      style: {
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
        background: badge.bg, color: badge.color,
      },
    },
      h('span', { style: { width: '5px', height: '5px', borderRadius: '50%', background: badge.color, flexShrink: 0 } }),
      badge.label
    );
  };

  return (
    h('div', null,
      // Big page title — ElevenLabs style
      h('div', { className: 'page-title-section' },
        h('h2', null, 'Call History'),
        h('p', null, 'View and manage your conversation logs')
      ),
      // Agent selector bar
      h('div', { style: { marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 32px' } },
        h('span', { style: { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 } }, 'Agent:'),
        h('select', {
          className: 'voice-select',
          style: { width: '240px' },
          value: selectedAgent,
          onChange: e => handleAgentChange(e.target.value),
        },
          agents.map(a =>
            h('option', { key: a.agent_id, value: a.agent_id }, a.name)
          )
        ),
        h('button', {
          className: 'btn-ghost',
          onClick: () => selectedAgent && loadHistory(selectedAgent),
          style: { display: 'flex', alignItems: 'center', gap: '4px' },
        }, h(Icon, { name: 'refresh-cw', size: 13 }), 'Refresh')
      ),

      // Content
      loading ? h(SkeletonRows, { count: 5 }) : (
        conversations.length === 0
          ? h(EmptyState, { icon: 'inbox', title: 'No calls yet', description: 'Initiate a call from the Agents tab to see history here.' })
          : h('table', { className: 'data-table' },
              h('thead', null,
                h('tr', null,
                  h('th', null, 'Conversation ID'),
                  h('th', null, 'Date'),
                  h('th', null, 'Duration'),
                  h('th', null, 'Status'),
                  h('th', { style: { width: '80px' } }, 'Actions')
                )
              ),
              h('tbody', null,
                conversations.map((conv, i) => {
                  const convId = conv.conversation_id || conv.id || '';
                  const isExpanded = expandedId === convId;
                  // ElevenLabs returns call_duration_secs or we compute from start/end
                  const duration = conv.call_duration_secs
                    || conv.duration
                    || (conv.call_successful != null ? (conv.metadata?.call_duration_secs) : null);

                  return h(React.Fragment, { key: i },
                    // Main row
                    h('tr', {
                      style: {
                        cursor: 'pointer',
                        background: isExpanded ? 'var(--bg-hover)' : undefined,
                      },
                      onClick: () => toggleExpand(convId),
                    },
                      h('td', { className: 'phone-cell', style: { fontSize: '12px' } },
                        h('span', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                          h(Icon, { name: isExpanded ? 'chevron-down' : 'chevron-right', size: 12 }),
                          convId ? `${convId.slice(0, 20)}...` : '—'
                        )
                      ),
                      h('td', null,
                        conv.created_at
                          ? h('span', { style: { fontSize: '12px' } },
                              new Date(conv.created_at * 1000 > 1e12 ? conv.created_at : conv.created_at * 1000).toLocaleString()
                            )
                          : '—'
                      ),
                      h('td', null,
                        h('span', { className: 'text-mono', style: { fontSize: '12px', color: 'var(--text-secondary)' } },
                          formatDuration(duration)
                        )
                      ),
                      h('td', null, statusBadge(conv.status)),
                      h('td', null,
                        h('div', { className: 'table-actions' },
                          h('div', {
                            className: 'btn-icon danger',
                            title: 'Delete conversation',
                            onClick: (e) => { e.stopPropagation(); setDeleteTarget(convId); },
                          }, h(Icon, { name: 'trash-2', size: 14 }))
                        )
                      )
                    ),

                    // Expanded detail row
                    isExpanded && h('tr', null,
                      h('td', { colSpan: 5, style: { padding: 0 } },
                        h('div', {
                          style: {
                            padding: '14px 20px',
                            background: 'var(--bg-base)',
                            borderBottom: '1px solid var(--border-subtle)',
                            animation: 'fadeUp 150ms ease',
                          },
                        },
                          detailLoading
                            ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)', fontSize: '12px' } },
                                h('div', { className: 'spinner' }),
                                'Loading transcript...'
                              )
                            : detailData?.error
                              ? h('div', { style: { fontSize: '12px', color: 'var(--text-tertiary)' } }, detailData.error)
                              : detailData
                                ? h('div', null,
                                    // Metadata row
                                    h('div', {
                                      style: {
                                        display: 'flex', gap: '20px', marginBottom: '12px',
                                        fontSize: '11px', color: 'var(--text-tertiary)',
                                      },
                                    },
                                      detailData.analysis?.call_successful != null &&
                                        h('span', null, 'Outcome: ',
                                          h('strong', {
                                            style: { color: detailData.analysis.call_successful ? 'var(--green)' : 'var(--red)' },
                                          }, detailData.analysis.call_successful ? 'Successful' : 'Unsuccessful')
                                        ),
                                      detailData.metadata?.call_duration_secs != null &&
                                        h('span', null, 'Duration: ', h('strong', null, formatDuration(detailData.metadata.call_duration_secs))),
                                      detailData.metadata?.cost != null &&
                                        h('span', null, 'Cost: ', h('strong', null, `$${Number(detailData.metadata.cost).toFixed(4)}`))
                                    ),
                                    // Summary
                                    detailData.analysis?.transcript_summary &&
                                      h('div', {
                                        style: {
                                          background: 'var(--bg-hover)', padding: '8px 12px',
                                          borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)',
                                          marginBottom: '12px', lineHeight: 1.5,
                                        },
                                      },
                                        h('strong', { style: { display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Summary'),
                                        detailData.analysis.transcript_summary
                                      ),
                                    // Transcript
                                    h('div', {
                                      style: { fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' },
                                    }, 'Transcript'),
                                    h('div', {
                                      style: {
                                        maxHeight: '240px', overflowY: 'auto',
                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                      },
                                    },
                                      (detailData.transcript || []).length > 0
                                        ? (detailData.transcript || []).map((msg, j) =>
                                            h('div', {
                                              key: j,
                                              className: `monitor-msg ${msg.role === 'user' ? 'user' : 'agent'}`,
                                            },
                                              h('span', { className: 'monitor-role' }, msg.role === 'user' ? 'Customer' : 'Agent'),
                                              h('span', { className: 'monitor-text' }, msg.message || msg.text || msg.content || '')
                                            )
                                          )
                                        : h('div', { style: { fontSize: '12px', color: 'var(--text-quaternary)' } }, 'No transcript data available.')
                                    )
                                  )
                                : h('div', { style: { fontSize: '12px', color: 'var(--text-quaternary)' } }, 'No detail data.')
                        )
                      )
                    )
                  );
                })
              )
            )
      ),

      // Delete confirmation modal
      deleteTarget && h(ConfirmModal, {
        title: 'Delete Conversation',
        message: 'This will permanently delete this conversation and its transcript from ElevenLabs. This cannot be undone.',
        confirmLabel: 'Delete',
        onConfirm: () => handleDeleteConversation(deleteTarget),
        onCancel: () => setDeleteTarget(null),
        danger: true,
      })
    )
  );
}

// ═══════════════════════════════════════════════════════════════
// CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════

function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true, requireType = null }) {
  const [typed, setTyped] = useState('');
  const canConfirm = requireType ? typed === requireType : true;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <Icon name={danger ? 'alert-triangle' : 'info'} size={16} />
          <span>{title}</span>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
          {requireType && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                Type <strong style={{ color: 'var(--danger)' }}>{requireType}</strong> to confirm:
              </div>
              <input
                className="form-input"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={requireType}
                autoFocus
                style={{ borderColor: typed === requireType ? 'var(--success)' : undefined }}
              />
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{ marginLeft: 0 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREATE AGENT MODAL (Detailed form)
// ═══════════════════════════════════════════════════════════════

function CreateAgentModal({ token, addToast, voices, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [language, setLanguage] = useState('en');
  const [llm, setLlm] = useState('gpt-4o-mini');
  const [ttsModel, setTtsModel] = useState('eleven_v3_conversational');
  const [voiceId, setVoiceId] = useState('');
  const [voiceFilter, setVoiceFilter] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [prompt, setPrompt] = useState('');
  const [maxDuration, setMaxDuration] = useState(300);
  const [creating, setCreating] = useState(false);

  const filteredVoices = voices.filter(v =>
    v.name?.toLowerCase().includes(voiceFilter.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Agent name is required', 'error');
      return;
    }
    setCreating(true);
    try {
      const result = await api('/agents', {
        token,
        method: 'POST',
        body: {
          name: name.trim(),
          first_message: firstMessage || `Hello! I'm ${name.trim()}. How can I help you today?`,
          language,
          llm,
          tts_model_id: ttsModel,
          voice_id: voiceId || undefined,
          temperature,
          prompt: prompt || `You are ${name.trim()}, a helpful AI assistant.`,
          max_duration_seconds: maxDuration,
        },
      });
      addToast(`Agent "${name}" created successfully!`, 'success');
      onCreated(result.agent);
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '85vh', overflow: 'auto' }}>
        <div className="modal-header">
          <Icon name="bot" size={16} />
          <span>Create New Agent</span>
          <div style={{ flex: 1 }} />
          <div className="btn-icon" onClick={onClose}><Icon name="x" size={14} /></div>
        </div>
        <form onSubmit={handleCreate}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Identity */}
            <div className="config-section" style={{ padding: 0, border: 'none' }}>
              <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '8px' }}>Identity</div>
              <div className="form-group">
                <label className="form-label">Agent Name *</label>
                <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Sales Agent" required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">First Message</label>
                <textarea
                  className="form-input"
                  value={firstMessage}
                  onChange={e => setFirstMessage(e.target.value)}
                  placeholder={`Hello! I'm ${name || 'Agent'}. How can I help you today?`}
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Language</label>
                <CustomSelect
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  options={FALLBACK_LANGUAGE_OPTIONS}
                  placeholder="Select language"
                />
              </div>
            </div>

            {/* AI Model */}
            <div className="config-section" style={{ padding: 0, border: 'none' }}>
              <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '8px' }}>AI Model</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">LLM</label>
                  <CustomSelect
                    value={llm}
                    onChange={e => setLlm(e.target.value)}
                    options={FALLBACK_LLM_OPTIONS}
                    placeholder="Select LLM"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Temperature: {temperature.toFixed(2)}</label>
                  <input type="range" className="config-slider" min="0" max="1" step="0.05" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">System Prompt</label>
                <textarea
                  className="form-input"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={`You are ${name || 'Agent'}, a helpful AI assistant.`}
                  rows={4}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Voice */}
            <div className="config-section" style={{ padding: 0, border: 'none' }}>
              <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '8px' }}>Voice</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">TTS Model</label>
                  <CustomSelect
                    value={ttsModel}
                    onChange={e => setTtsModel(e.target.value)}
                    options={FALLBACK_TTS_MODEL_OPTIONS}
                    placeholder="Select TTS model"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Duration (seconds)</label>
                  <input className="form-input" type="number" value={maxDuration} onChange={e => setMaxDuration(parseInt(e.target.value))} min="30" max="3600" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Voice</label>
                <CustomSelect
                  value={voiceId}
                  onChange={e => setVoiceId(e.target.value)}
                  options={[{ value: '', label: '(Default voice)' }, ...filteredVoices.map(v => ({ value: v.voice_id, label: v.name }))]}
                  placeholder="Select voice"
                />
              </div>
            </div>

          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn-primary"
              disabled={creating || !name.trim()}
              style={{ marginLeft: 0 }}
            >
              {creating ? (<><div className="spinner" /> Creating...</>) : (<><Icon name="plus" size={13} /> Create Agent</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADMIN VIEW (Tabbed: Clients | Agents)
// ═══════════════════════════════════════════════════════════════

function AdminView({ token, addToast, onOpenAgentDetail }) {
  const [adminTab, setAdminTab] = useState('clients');
  const [clients, setClients] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [voices, setVoices] = useState([]);
  const [clientAgentMap, setClientAgentMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedAgentToAssign, setSelectedAgentToAssign] = useState('');
  const [assignPermission, setAssignPermission] = useState('edit'); // 'edit' or 'view'
  const [expandedFeatureAgent, setExpandedFeatureAgent] = useState(null); // { clientId, agentId }

  // All toggleable features
  const FEATURE_KEYS = [
    { key: 'first_message', label: 'First Message', icon: 'message-circle' },
    { key: 'language', label: 'Language', icon: 'globe' },
    { key: 'prompt', label: 'System Prompt', icon: 'message-square' },
    { key: 'llm', label: 'AI Model (LLM)', icon: 'brain' },
    { key: 'temperature', label: 'Temperature & Tokens', icon: 'thermometer' },
    { key: 'voice', label: 'Voice Settings', icon: 'mic' },
    { key: 'asr', label: 'ASR & Detection', icon: 'ear' },
    { key: 'safety', label: 'Safety & Guardrails', icon: 'shield-check' },
    { key: 'advanced', label: 'Advanced Settings', icon: 'wrench' },
    { key: 'call', label: 'Quick Call', icon: 'phone-call' },
  ];

  // Delete confirmations
  const [deleteClientTarget, setDeleteClientTarget] = useState(null);
  const [deleteAgentTarget, setDeleteAgentTarget] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsData, agentsData, voicesData] = await Promise.all([
        api('/admin/clients', { token }),
        api('/agents/all', { token }).catch(() => ({ agents: [] })),
        api('/agents/voices', { token }).catch(() => ({ voices: [] })),
      ]);
      setClients(clientsData.clients || []);
      setAllAgents(agentsData.agents || []);
      setVoices(voicesData.voices || []);

      const agentMap = {};
      for (const c of (clientsData.clients || [])) {
        try {
          const resp = await api(`/admin/clients/${c.id}/agents`, { token });
          // Parse JSON allowed_features
          agentMap[c.id] = (resp.agents || []).map(ag => ({
            ...ag,
            allowed_features: ag.allowed_features ? (typeof ag.allowed_features === 'string' ? JSON.parse(ag.allowed_features) : ag.allowed_features) : null,
          }));
        } catch {
          agentMap[c.id] = [];
        }
      }
      setClientAgentMap(agentMap);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle a single feature flag for a client's agent
  const handleToggleFeature = async (clientId, agentId, featureKey) => {
    const agents = clientAgentMap[clientId] || [];
    const ag = agents.find(a => a.agent_id === agentId);
    // Current features: null means all enabled
    const current = ag?.allowed_features || {};
    const newFeatures = { ...current };
    // If key is missing or true, set to false. If false, set back to true (or remove)
    if (newFeatures[featureKey] === false) {
      delete newFeatures[featureKey]; // removing = enabled
    } else {
      newFeatures[featureKey] = false; // explicitly disabled
    }
    // If everything is enabled (no false values), set to null
    const hasDisabled = Object.values(newFeatures).some(v => v === false);
    const finalFeatures = hasDisabled ? newFeatures : null;

    try {
      await api(`/admin/clients/${clientId}/agents/${agentId}`, {
        token, method: 'PATCH',
        body: { allowed_features: finalFeatures },
      });
      // Update local state without full reload
      setClientAgentMap(prev => ({
        ...prev,
        [clientId]: prev[clientId].map(a =>
          a.agent_id === agentId ? { ...a, allowed_features: finalFeatures } : a
        ),
      }));
      const isNowEnabled = finalFeatures === null || finalFeatures[featureKey] !== false;
      addToast(`${featureKey}: ${isNowEnabled ? 'Enabled' : 'Disabled'}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/clients', { token, method: 'POST', body: { name: newName, email: newEmail, password: newPassword } });
      addToast('Client created', 'success');
      setShowCreateClient(false);
      setNewName(''); setNewEmail(''); setNewPassword('');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteClient = async (clientId) => {
    try {
      const result = await api(`/admin/clients/${clientId}`, { token, method: 'DELETE' });
      addToast(`Client "${result.client_name}" deleted (${result.assignments_removed} assignments removed)`, 'success');
      setDeleteClientTarget(null);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDeleteAgent = async (agentId) => {
    try {
      await api(`/agents/${agentId}`, { token, method: 'DELETE' });
      addToast('Agent deleted from ElevenLabs', 'success');
      setDeleteAgentTarget(null);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAssignAgent = async (clientId) => {
    if (!selectedAgentToAssign) {
      addToast('Select an agent first', 'error');
      return;
    }
    const agent = allAgents.find(a => a.agent_id === selectedAgentToAssign);
    try {
      await api(`/admin/clients/${clientId}/agents`, {
        token, method: 'POST',
        body: {
          agent_id: selectedAgentToAssign,
          agent_name: agent?.name || 'Unnamed Agent',
          can_edit: assignPermission === 'edit' ? 1 : 0,
        },
      });
      const permLabel = assignPermission === 'edit' ? 'Full Access' : 'View Only';
      addToast(`"${agent?.name || selectedAgentToAssign}" assigned (${permLabel})`, 'success');
      setSelectedAgentToAssign('');
      setAssignPermission('edit');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleTogglePermission = async (clientId, agentId, currentCanEdit) => {
    const newVal = currentCanEdit ? 0 : 1;
    try {
      await api(`/admin/clients/${clientId}/agents/${agentId}`, {
        token, method: 'PATCH',
        body: { can_edit: newVal },
      });
      addToast(newVal ? 'Changed to Full Access' : 'Changed to View Only', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUnassign = async (clientId, agentId) => {
    try {
      await api(`/admin/clients/${clientId}/agents/${agentId}`, { token, method: 'DELETE' });
      addToast('Agent removed', 'success');
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const getAvailableAgents = (clientId) => {
    const assigned = (clientAgentMap[clientId] || []).map(a => a.agent_id);
    return allAgents.filter(a => !assigned.includes(a.agent_id));
  };

  if (loading) return <SkeletonRows count={3} />;

  return (
    <div>
      {/* Admin Sub-Tabs */}
      <div className="config-tabs" style={{ marginBottom: '20px' }}>
        <div
          className={`config-tab ${adminTab === 'clients' ? 'active' : ''}`}
          onClick={() => setAdminTab('clients')}
        >
          <Icon name="users" size={14} />
          <span>Clients</span>
          <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '4px' }}>({clients.length})</span>
        </div>
        <div
          className={`config-tab ${adminTab === 'agents' ? 'active' : ''}`}
          onClick={() => setAdminTab('agents')}
        >
          <Icon name="bot" size={14} />
          <span>Agents</span>
          <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '4px' }}>({allAgents.length})</span>
        </div>
      </div>

      {/* ═══════ CLIENTS TAB ═══════ */}
      {adminTab === 'clients' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <button className="btn-primary" style={{ marginLeft: 0 }} onClick={() => setShowCreateClient(!showCreateClient)}>
              <Icon name="user-plus" size={13} />
              New Client
            </button>
          </div>

          {showCreateClient && (
            <div className="admin-section" style={{ marginBottom: '16px', maxWidth: '400px' }}>
              <div className="admin-section-title">Create Client</div>
              <form onSubmit={handleCreateClient}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn-ghost" onClick={() => setShowCreateClient(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ marginLeft: 0 }}>Create</button>
                </div>
              </form>
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Agents</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <React.Fragment key={c.id}>
                  <tr onClick={() => setSelectedClient(selectedClient === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                    <td>{c.name}</td>
                    <td className="phone-cell">{c.email}</td>
                    <td>{c.is_admin ? <span className="badge sip">Admin</span> : <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Client</span>}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{c.agent_count} agents</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <Icon name={selectedClient === c.id ? 'chevron-down' : 'chevron-right'} size={14} />
                        {!c.is_admin && (
                          <div
                            className="btn-icon danger"
                            onClick={(e) => { e.stopPropagation(); setDeleteClientTarget(c); }}
                            title="Delete client"
                          >
                            <Icon name="trash-2" size={13} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {selectedClient === c.id && (
                    <tr>
                      <td colSpan="5" style={{ padding: '16px', background: 'var(--bg-raised)' }}>
                        {(clientAgentMap[c.id] || []).length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '8px' }}>Assigned Agents</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {(clientAgentMap[c.id] || []).map(ag => {
                                const isFeatureExpanded = expandedFeatureAgent?.clientId === c.id && expandedFeatureAgent?.agentId === ag.agent_id;
                                const disabledCount = ag.allowed_features ? Object.values(ag.allowed_features).filter(v => v === false).length : 0;
                                return (
                                <div key={ag.agent_id} style={{
                                  background: 'var(--bg-overlay)', borderRadius: '8px', border: '1px solid var(--border-default)',
                                  overflow: 'hidden',
                                }}>
                                  {/* Agent Row */}
                                  <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 12px',
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span className="status-dot active" />
                                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{ag.agent_name}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{ag.agent_id.slice(0, 16)}...</span>
                                      {/* Permission Badge */}
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                                        fontSize: '10px', fontWeight: 600, padding: '2px 7px',
                                        borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.03em',
                                        background: ag.can_edit ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                                        color: ag.can_edit ? 'var(--green)' : '#fbbf24',
                                      }}>
                                        <Icon name={ag.can_edit ? 'edit-3' : 'eye'} size={10} />
                                        {ag.can_edit ? 'Can Edit' : 'View Only'}
                                      </span>
                                      {/* Disabled features count */}
                                      {disabledCount > 0 && (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                                          fontSize: '10px', fontWeight: 600, padding: '2px 7px',
                                          borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                        }}>
                                          <Icon name="eye-off" size={10} />
                                          {disabledCount} hidden
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      {/* Features Button */}
                                      <div
                                        className={`btn-icon ${isFeatureExpanded ? 'active' : ''}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedFeatureAgent(isFeatureExpanded ? null : { clientId: c.id, agentId: ag.agent_id });
                                        }}
                                        title="Manage visible features"
                                        style={{ color: isFeatureExpanded ? 'var(--accent)' : 'var(--text-secondary)' }}
                                      >
                                        <Icon name="settings" size={13} />
                                      </div>
                                      {/* Toggle Permission Button */}
                                      <div
                                        className="btn-icon"
                                        onClick={(e) => { e.stopPropagation(); handleTogglePermission(c.id, ag.agent_id, ag.can_edit); }}
                                        title={ag.can_edit ? 'Switch to View Only' : 'Switch to Full Access'}
                                        style={{ color: 'var(--text-secondary)' }}
                                      >
                                        <Icon name={ag.can_edit ? 'lock' : 'unlock'} size={13} />
                                      </div>
                                      {/* Remove Button */}
                                      <div
                                        className="btn-icon danger"
                                        onClick={(e) => { e.stopPropagation(); handleUnassign(c.id, ag.agent_id); }}
                                        title="Remove agent"
                                      >
                                        <Icon name="x" size={14} />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Feature Toggles Panel */}
                                  {isFeatureExpanded && (
                                    <div style={{
                                      borderTop: '1px solid var(--border-default)',
                                      padding: '12px',
                                      background: 'var(--bg-base)',
                                    }}>
                                      <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        marginBottom: '10px',
                                      }}>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                          Client Dashboard Features
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                          Toggle what the client can see
                                        </div>
                                      </div>
                                      <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px',
                                      }}>
                                        {FEATURE_KEYS.map(f => {
                                          const isEnabled = !ag.allowed_features || ag.allowed_features[f.key] !== false;
                                          return (
                                            <div
                                              key={f.key}
                                              onClick={() => handleToggleFeature(c.id, ag.agent_id, f.key)}
                                              style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                                                border: `1px solid ${isEnabled ? 'var(--border-default)' : 'rgba(239,68,68,0.2)'}`,
                                                background: isEnabled ? 'var(--bg-overlay)' : 'rgba(239,68,68,0.04)',
                                                transition: 'all 0.15s ease',
                                              }}
                                            >
                                              <div style={{
                                                width: '28px', height: '16px', borderRadius: '8px',
                                                background: isEnabled ? 'var(--accent)' : 'var(--border-subtle)',
                                                position: 'relative', transition: 'background 0.2s ease',
                                                flexShrink: 0,
                                              }}>
                                                <div style={{
                                                  width: '12px', height: '12px', borderRadius: '50%',
                                                  background: '#fff', position: 'absolute', top: '2px',
                                                  left: isEnabled ? '14px' : '2px',
                                                  transition: 'left 0.2s ease',
                                                }} />
                                              </div>
                                              <Icon name={f.icon} size={12} style={{ color: isEnabled ? 'var(--text-secondary)' : '#ef4444', opacity: isEnabled ? 1 : 0.5 }} />
                                              <span style={{
                                                fontSize: '11px', fontWeight: 500,
                                                color: isEnabled ? 'var(--text-primary)' : '#ef4444',
                                                textDecoration: isEnabled ? 'none' : 'line-through',
                                              }}>
                                                {f.label}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="admin-section-title" style={{ fontSize: '11px', marginBottom: '8px' }}>Add Agent</div>
                        {allAgents.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No agents found. Create one in the Agents tab.</div>
                        ) : getAvailableAgents(c.id).length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--accent)' }}>All agents are already assigned to this client.</div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1 }}>
                              <CustomSelect
                                value={selectedAgentToAssign}
                                onChange={e => setSelectedAgentToAssign(e.target.value)}
                                options={[{ value: '', label: 'Select an agent...' }, ...getAvailableAgents(c.id).map(a => ({ value: a.agent_id, label: `${a.name} (${a.agent_id.slice(0, 12)}...)` }))]}
                                placeholder="Select an agent..."
                              />
                            </div>
                            <div style={{ width: '140px', flexShrink: 0 }}>
                              <CustomSelect
                                value={assignPermission}
                                onChange={e => setAssignPermission(e.target.value)}
                                options={[
                                  { value: 'edit', label: 'Full Access' },
                                  { value: 'view', label: 'View Only' }
                                ]}
                                placeholder="Permission"
                              />
                            </div>
                            <button
                              className="btn-primary"
                              style={{ marginLeft: 0, marginBottom: '1px', whiteSpace: 'nowrap' }}
                              onClick={() => handleAssignAgent(c.id)}
                              disabled={!selectedAgentToAssign}
                            >
                              <Icon name="plus" size={13} />
                              Assign
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ═══════ AGENTS TAB ═══════ */}
      {adminTab === 'agents' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <button className="btn-primary" style={{ marginLeft: 0 }} onClick={() => setShowCreateAgent(true)}>
              <Icon name="plus" size={13} />
              Create Agent
            </button>
          </div>

          {allAgents.length === 0 ? (
            <EmptyState
              icon="bot"
              title="No Agents"
              description="Create your first AI agent to get started."
              action="Create Agent"
              onAction={() => setShowCreateAgent(true)}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {allAgents.map(agent => (
                <div key={agent.agent_id} className="agent-card" style={{
                  padding: '16px', borderRadius: '10px',
                  border: '1px solid var(--border-default)', background: 'var(--bg-raised)',
                  display: 'flex', flexDirection: 'column', gap: '12px',
                  transition: 'border-color 0.2s', cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: `hsl(${(agent.name || '').charCodeAt(0) * 37 % 360}, 60%, 50%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 700, color: '#fff',
                      }}>
                        {(agent.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{agent.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                          {agent.agent_id.slice(0, 20)}...
                        </div>
                      </div>
                    </div>
                  </div>

                  {agent.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {agent.tags.map(tag => (
                        <span key={tag} className="badge" style={{ fontSize: '10px', padding: '2px 6px' }}>{tag}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button
                      className="btn-ghost"
                      style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                      onClick={() => onOpenAgentDetail && onOpenAgentDetail(agent.agent_id, agent.name)}
                    >
                      <Icon name="settings" size={12} />
                      Configure
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: '12px', padding: '6px 10px', color: 'var(--danger)' }}
                      onClick={() => setDeleteAgentTarget(agent)}
                    >
                      <Icon name="trash-2" size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateAgent && (
        <CreateAgentModal
          token={token}
          addToast={addToast}
          voices={voices}
          onClose={() => setShowCreateAgent(false)}
          onCreated={() => loadData()}
        />
      )}

      {deleteClientTarget && (
        <ConfirmModal
          title="Delete Client"
          message={`This will permanently delete "${deleteClientTarget.name}" and remove all their agent assignments. This cannot be undone.`}
          confirmLabel="Delete Client"
          onConfirm={() => handleDeleteClient(deleteClientTarget.id)}
          onCancel={() => setDeleteClientTarget(null)}
          danger={true}
        />
      )}

      {deleteAgentTarget && (
        <ConfirmModal
          title="Delete Agent"
          message={`This will permanently delete "${deleteAgentTarget.name}" from ElevenLabs and remove all client assignments. This action CANNOT be undone.`}
          confirmLabel="Delete Agent"
          requireType={deleteAgentTarget.name}
          onConfirm={() => handleDeleteAgent(deleteAgentTarget.agent_id)}
          onCancel={() => setDeleteAgentTarget(null)}
          danger={true}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS VIEW (placeholder)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// DASHBOARD VIEW — Premium analytics overview
// ═══════════════════════════════════════════════════════════════

function DashboardView({ token, addToast, onOpenDetail }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    api('/stats', { token })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        addToast('Failed to load dashboard stats', 'error');
        setLoading(false);
      });
  }, [token]);

  // Chart.js donut
  useEffect(() => {
    if (!stats || !chartRef.current || !window.Chart) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const colors = [
      'rgba(94,106,210,0.8)', 'rgba(74,222,128,0.8)', 'rgba(251,146,60,0.8)',
      'rgba(244,114,182,0.8)', 'rgba(34,211,238,0.8)', 'rgba(248,113,113,0.8)',
      'rgba(139,92,246,0.8)', 'rgba(96,165,250,0.8)',
    ];

    chartInstance.current = new window.Chart(chartRef.current, {
      type: 'doughnut',
      data: {
        labels: stats.callsByAgent.map(a => a.name),
        datasets: [{
          data: stats.callsByAgent.map(a => a.count),
          backgroundColor: colors.slice(0, stats.callsByAgent.length),
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#9898A3',
              font: { family: 'Inter', size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
        },
      },
    });

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [stats]);

  const formatDuration = (secs) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatTime = (unix) => {
    if (!unix) return '';
    const d = new Date(unix * 1000);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-text" style={{ width: 280, marginBottom: 16 }} />
        <div className="loading-skeleton-grid">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: 'Total Agents', value: stats.totalAgents, icon: 'bot', trend: null },
    { label: 'Total Calls', value: stats.totalCalls, icon: 'phone-call', trend: stats.totalCalls > 0 ? 'up' : 'neutral' },
    { label: 'Success Rate', value: `${stats.successRate}%`, icon: 'check-circle', trend: stats.successRate >= 70 ? 'up' : stats.successRate >= 40 ? 'neutral' : 'down' },
    { label: 'Avg Duration', value: formatDuration(stats.avgDuration), icon: 'timer', trend: 'neutral' },
  ];

  return (
    <>
      {/* Big page title */}
      <div className="page-title-section">
        <h2>Dashboard</h2>
        <p>Overview of your AI calling operations</p>
      </div>

      {/* Stat Cards */}
      <div className="dashboard-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="stat-card-header">
              <span className="stat-card-label">{card.label}</span>
              <div className="stat-card-icon">
                <Icon name={card.icon} size={16} />
              </div>
            </div>
            <div className="stat-card-value">{card.value}</div>
            {card.trend && (
              <span className={`stat-card-trend ${card.trend}`}>
                <Icon name={card.trend === 'up' ? 'trending-up' : card.trend === 'down' ? 'trending-down' : 'minus'} size={11} />
                {card.trend === 'up' ? 'Good' : card.trend === 'down' ? 'Low' : 'Stable'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Panels Row */}
      <div className="dashboard-row">
        {/* Calls by Agent Chart */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title">
              <Icon name="pie-chart" size={14} />
              Calls by Agent
            </span>
          </div>
          <div className="dashboard-panel-body">
            {stats.callsByAgent.length > 0 ? (
              <div className="chart-container">
                <canvas ref={chartRef} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-quaternary)', fontSize: '13px' }}>
                No call data yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title">
              <Icon name="activity" size={14} />
              Recent Activity
            </span>
          </div>
          <div className="dashboard-panel-body">
            {stats.recentActivity.length > 0 ? (
              <div className="activity-feed">
                {stats.recentActivity.map((item, i) => (
                  <div key={item.id || i} className="activity-item" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="activity-dot-col">
                      <span className={`activity-dot ${item.status === 'done' || item.status === 'completed' ? 'success' : item.status === 'failed' ? 'failed' : 'info'}`} />
                      {i < stats.recentActivity.length - 1 && <div className="activity-line" />}
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">Call with {item.agent_name}</div>
                      <div className="activity-meta">
                        <span>{item.status}</span>
                        {item.duration > 0 && <span>• {formatDuration(item.duration)}</span>}
                        {item.to_number && <span>• {item.to_number}</span>}
                      </div>
                    </div>
                    <div className="activity-time">{formatTime(item.time)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-quaternary)', fontSize: '13px' }}>
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Call Flow Diagram */}
      <div className="dashboard-row" style={{ gridTemplateColumns: '1fr' }}>
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <span className="dashboard-panel-title">
              <Icon name="git-branch" size={14} />
              Call Flow Architecture
            </span>
          </div>
          <div className="dashboard-panel-body">
            <div className="call-flow">
              <div className="call-flow-node">
                <div className="call-flow-node-icon" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  <Icon name="user" size={16} />
                </div>
                <span className="call-flow-node-label">Caller</span>
              </div>
              <div className="call-flow-arrow">
                <div className="flow-line"><div className="flow-dot" /></div>
              </div>
              <div className="call-flow-node">
                <div className="call-flow-node-icon" style={{ background: 'rgba(251,146,60,0.15)', color: 'var(--orange)' }}>
                  <Icon name="phone" size={16} />
                </div>
                <span className="call-flow-node-label">Twilio/SIP</span>
              </div>
              <div className="call-flow-arrow">
                <div className="flow-line"><div className="flow-dot" style={{ animationDelay: '0.4s' }} /></div>
              </div>
              <div className="call-flow-node">
                <div className="call-flow-node-icon" style={{ background: 'rgba(74,222,128,0.15)', color: 'var(--green)' }}>
                  <Icon name="server" size={16} />
                </div>
                <span className="call-flow-node-label">Dialix API</span>
              </div>
              <div className="call-flow-arrow">
                <div className="flow-line"><div className="flow-dot" style={{ animationDelay: '0.8s' }} /></div>
              </div>
              <div className="call-flow-node">
                <div className="call-flow-node-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
                  <Icon name="brain" size={16} />
                </div>
                <span className="call-flow-node-label">ElevenLabs AI</span>
              </div>
              <div className="call-flow-arrow">
                <div className="flow-line"><div className="flow-dot" style={{ animationDelay: '1.2s' }} /></div>
              </div>
              <div className="call-flow-node">
                <div className="call-flow-node-icon" style={{ background: 'rgba(34,211,238,0.15)', color: '#22D3EE' }}>
                  <Icon name="message-square" size={16} />
                </div>
                <span className="call-flow-node-label">Response</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════
// SETTINGS VIEW — Enhanced
// ═══════════════════════════════════════════════════════════════

function SettingsView({ token }) {
  const [apiStatus, setApiStatus] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(d => setApiStatus(d))
      .catch(() => setApiStatus({ status: 'error' }));
  }, []);

  return (
    <div style={{ maxWidth: 680, padding: 20 }}>
      <div className="config-section">
        <div className="config-section-title">
          <Icon name="server" size={14} />
          System Status
        </div>
        <div className="stat-card" style={{ marginBottom: 12 }}>
          <div className="config-row">
            <span className="config-label">API Server</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`status-dot ${apiStatus?.status === 'ok' ? 'active' : 'unavailable'}`} />
              <span style={{ fontSize: 13, color: apiStatus?.status === 'ok' ? 'var(--green)' : 'var(--red)' }}>
                {apiStatus?.status === 'ok' ? 'Healthy' : 'Error'}
              </span>
            </div>
          </div>
          <div className="config-row">
            <span className="config-label">Version</span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>v3.0.0</span>
          </div>
          <div className="config-row">
            <span className="config-label">Timestamp</span>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              {apiStatus?.timestamp ? new Date(apiStatus.timestamp).toLocaleString() : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="config-section">
        <div className="config-section-title">
          <Icon name="info" size={14} />
          About
        </div>
        <div className="stat-card">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong>Dialix</strong> is a white-label AI call center dashboard 
            powered by ElevenLabs conversational AI. Manage agents, connect 
            phone numbers via Twilio or SIP trunks, and make intelligent 
            outbound calls.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════

function AppShell({ token, client, onLogout, addToast }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [agents, setAgents] = useState([]);
  const [detailAgent, setDetailAgent] = useState(null); // { id, name }
  const [previousView, setPreviousView] = useState('agents'); // track where user came from

  useEffect(() => {
    api('/agents', { token })
      .then(data => setAgents(data.agents || []))
      .catch(() => {});
  }, [activeView]);

  const handleNavigate = (view) => {
    setDetailAgent(null); // Exit detail view when navigating
    setActiveView(view);
  };

  const handleOpenDetail = (agentId, agentName) => {
    setPreviousView(activeView); // remember where we came from
    setDetailAgent({ id: agentId, name: agentName });
    setActiveView('agent-detail');
  };

  const handleBackFromDetail = () => {
    setDetailAgent(null);
    setActiveView(previousView || 'agents');
  };

  const pageTitles = {
    'dashboard': 'Dashboard',
    'agents': 'Agents',
    'agent-detail': detailAgent?.name || 'Agent',
    'phone-numbers': 'Phone Numbers',
    'history': 'Call History',
    'admin': 'Admin Panel',
    'settings': 'Settings',
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView token={token} addToast={addToast} onOpenDetail={handleOpenDetail} />;
      case 'agents':
        return <AgentsView token={token} addToast={addToast} onOpenDetail={handleOpenDetail} />;
      case 'agent-detail':
        return detailAgent ? (
          <AgentDetailView
            token={token}
            agentId={detailAgent.id}
            agentName={detailAgent.name}
            onBack={handleBackFromDetail}
            addToast={addToast}
          />
        ) : <AgentsView token={token} addToast={addToast} onOpenDetail={handleOpenDetail} />;
      case 'phone-numbers':
        return <PhoneNumbersView token={token} addToast={addToast} agents={agents} />;
      case 'history':
        return <CallHistoryView token={token} addToast={addToast} />;
      case 'admin':
        return <AdminView token={token} addToast={addToast} onOpenAgentDetail={handleOpenDetail} />;
      case 'settings':
        return <SettingsView token={token} />;
      default:
        return <DashboardView token={token} addToast={addToast} onOpenDetail={handleOpenDetail} />;
    }
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <Sidebar
        client={client}
        activeView={activeView}
        onNavigate={handleNavigate}
        onLogout={onLogout}
      />
      <main className="main-content" id="main-content" role="main">
        <header className="page-header">
          <h1>{pageTitles[activeView] || 'Agents'}</h1>
          <div style={{ flex: 1 }} />
          {activeView === 'phone-numbers' && (
            <button className="btn-primary" onClick={() => setShowAddPhone(true)} aria-label="Add a new phone number">
              <Icon name="plus" size={13} />
              Add Phone Number
            </button>
          )}
        </header>
        <div className="page-body" role="region" aria-label={`${pageTitles[activeView] || 'Agents'} content`}>
          {renderContent()}
        </div>
      </main>

      {showAddPhone && (
        <AddPhoneModal
          token={token}
          addToast={addToast}
          onClose={() => setShowAddPhone(false)}
          onAdded={() => setActiveView('phone-numbers')}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════

function App() {
  const [token, setToken] = useState(null);
  const [client, setClient] = useState(null);
  const { toasts, addToast } = useToasts();

  const handleLogin = (newToken, newClient) => {
    setToken(newToken);
    setClient(newClient);
  };

  const handleLogout = () => {
    setToken(null);
    setClient(null);
  };

  return (
    <>
      {token && client ? (
        <AppShell token={token} client={client} onLogout={handleLogout} addToast={addToast} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
      <ToastContainer toasts={toasts} removeToast={() => {}} />
    </>
  );
}

// ─── Mount ──────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

// In-memory cache to prevent spamming identical errors within 10 seconds
const recentErrors = new Set<string>();

export function sendTelemetryError(data: {
  errorMessage: string;
  stackTrace?: string | null;
  componentName?: string | null;
  url?: string;
}): void {
  try {
    const key = `${data.errorMessage}_${data.componentName || ''}`;
    if (recentErrors.has(key)) return;
    recentErrors.add(key);
    setTimeout(() => recentErrors.delete(key), 10000);

    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const token = typeof window !== 'undefined' ? localStorage.getItem('dialix_token') : null;

    fetch(`${apiBase}/api/telemetry/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        error_message: data.errorMessage,
        stack_trace: data.stackTrace || null,
        component_name: data.componentName || null,
        url: data.url || (typeof window !== 'undefined' ? window.location.href : undefined),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
      keepalive: true,
    }).catch(() => {
      // Non-blocking
    });
  } catch {
    // Non-blocking
  }
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `ERR_${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidMount() {
    if (typeof window === 'undefined') return;

    // Window global error handler
    window.addEventListener('error', (event) => {
      sendTelemetryError({
        errorMessage: event.message || 'Window error',
        stackTrace: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        componentName: 'window.onerror',
        url: window.location.href,
      });
    });

    // Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = typeof reason === 'string' ? reason : (reason?.message || 'Unhandled Promise Rejection');
      const stack = reason?.stack || null;

      sendTelemetryError({
        errorMessage: message,
        stackTrace: stack,
        componentName: 'window.onunhandledrejection',
        url: window.location.href,
      });
    });
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    sendTelemetryError({
      errorMessage: error.message || 'React render crash',
      stackTrace: error.stack || null,
      componentName: errorInfo.componentStack ? errorInfo.componentStack.slice(0, 500) : 'ReactComponent',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base, #0F0F12)',
            color: 'var(--text-primary, #ffffff)',
            fontFamily: 'var(--font-sans, Inter, sans-serif)',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: '#ef4444',
              marginBottom: '20px',
            }}
          >
            !
          </div>

          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: '8px',
            }}
          >
            An unexpected error occurred
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary, #9898A3)',
              maxWidth: '460px',
              lineHeight: 1.5,
              marginBottom: '16px',
            }}
          >
            Our real-time error telemetry system automatically captured this incident and dispatched it to our AI agent debugging queue.
          </p>

          {this.state.errorId && (
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '6px 12px',
                borderRadius: '6px',
                color: 'var(--text-tertiary, #646470)',
                marginBottom: '24px',
                border: '1px solid var(--border-default, #232329)',
              }}
            >
              Incident Ref: {this.state.errorId}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: 'var(--brand-accent, #5E6AD2)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reload Application
            </button>

            <button
              onClick={() => {
                window.location.href = '/dashboard';
              }}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: 'var(--bg-secondary, #18181C)',
                border: '1px solid var(--border-default, #232329)',
                color: 'var(--text-secondary, #9898A3)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Go to Dashboard
            </button>
          </div>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div
              style={{
                marginTop: '32px',
                textAlign: 'left',
                maxWidth: '680px',
                width: '100%',
                background: '#0B0B0D',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '12px',
                color: '#f87171',
                overflowX: 'auto',
                border: '1px solid #232329',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>{this.state.error.message}</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px', opacity: 0.8 }}>
                {this.state.error.stack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DashboardErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            minHeight: '400px',
            padding: '40px',
            textAlign: 'center',
            fontFamily: 'var(--font-sans, Inter, sans-serif)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--red-bg, rgba(248,113,113,0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              fontSize: '20px',
            }}
          >
            ⚠
          </div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary, #fff)',
              marginBottom: '8px',
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-tertiary, #6b6b76)',
              marginBottom: '20px',
              maxWidth: '400px',
            }}
          >
            An unexpected error occurred in the dashboard. Try refreshing the page.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'var(--brand-accent, #5E6AD2)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md, 8px)',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre
              style={{
                marginTop: '20px',
                padding: '12px',
                fontSize: '11px',
                background: 'var(--bg-input, #1a1a1f)',
                borderRadius: '8px',
                color: 'var(--red, #f87171)',
                maxWidth: '600px',
                overflow: 'auto',
                textAlign: 'left',
              }}
            >
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

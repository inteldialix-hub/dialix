/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * API client for Dialix backend.
 * Uses NEXT_PUBLIC_API_URL to reach the Express backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiOptions {
  token?: string | null;
  method?: string;
  body?: any;
}

export async function api<T = any>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, method = 'GET', body } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr: any) {
    if (!path.includes('/telemetry/errors')) {
      try {
        fetch(`${API_BASE}/api/telemetry/errors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            error_message: `Network failure on ${method} ${path}: ${networkErr?.message || 'Network error'}`,
            component_name: 'api_client',
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // ignore
      }
    }
    throw networkErr;
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({})) as {
      error?: string;
      issues?: { path: string; message: string }[];
    };

    // Automatically report server-side 500s to telemetry
    if (res.status >= 500 && !path.includes('/telemetry/errors')) {
      try {
        fetch(`${API_BASE}/api/telemetry/errors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            error_message: `API ${res.status} on ${method} ${path}: ${errorData.error || res.statusText}`,
            component_name: 'api_client',
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // ignore
      }
    }

    // Auto-logout on expired/invalid token — redirect to login
    // BUT skip this for auth endpoints (login/register) where 401 means "wrong credentials"
    const isAuthEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/register');
    if (res.status === 401 && typeof window !== 'undefined' && !isAuthEndpoint) {
      localStorage.removeItem('dialix_token');
      localStorage.removeItem('dialix_client');
      window.location.href = '/login';
      // Return a never-resolving promise so callers don't continue
      return new Promise<T>(() => {});
    }

    // Extract Zod validation issues into a readable message
    let message = errorData.error || `API error: ${res.status}`;
    if (errorData.issues && errorData.issues.length > 0) {
      message = errorData.issues
        .map((i) => i.path ? `${i.path}: ${i.message}` : i.message)
        .join(', ');
    }

    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

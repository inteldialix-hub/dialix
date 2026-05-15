/**
 * API client for Dialix backend.
 * Uses NEXT_PUBLIC_API_URL to reach the Express backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiOptions {
  token?: string;
  method?: string;
  body?: Record<string, unknown>;
}

export async function api<T = Record<string, unknown>>(
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

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({})) as {
      error?: string;
      issues?: { path: string; message: string }[];
    };

    // Auto-logout on expired/invalid token — redirect to login
    if (res.status === 401 && typeof window !== 'undefined') {
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

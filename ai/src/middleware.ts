import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to set security headers (including CSP) on every response.
 * This runs at request time, which is more reliable than next.config.js headers()
 * in standalone mode where pages may be statically generated.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: *.google.com *.googletagmanager.com cdn.jsdelivr.net https://*.daily.co",
    "script-src-elem 'self' 'unsafe-inline' blob: *.google.com *.googletagmanager.com cdn.jsdelivr.net https://*.daily.co",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
    "font-src 'self' fonts.gstatic.com",
    "img-src 'self' data: https: *.unsplash.com *.same-assets.com",
    "connect-src 'self' blob: https://dialix-backend.fly.dev wss://*.fly.dev https://*.elevenlabs.io wss://*.elevenlabs.io https://api.vapi.ai https://*.vapi.ai https://storage.vapi.ai https://*.daily.co wss://*.daily.co https://*.wss.daily.co wss://*.wss.daily.co",
    "media-src 'self' data: blob: https: https://dialix-backend.fly.dev https://*.vapi.ai https://storage.vapi.ai",
    "frame-src 'self' https://*.daily.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(self), camera=(), payment=()');

  // Prevent search engines from indexing private dashboard/auth pages
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

// Only run on page requests, skip static assets and API routes
export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

import DOMPurify from 'dompurify';

/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes user input for general text fields
 * @param input - The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .slice(0, 10000); // Limit length
}

/**
 * Validates and sanitizes email addresses
 * @param email - The email string to validate
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') return null;
  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(sanitized) ? sanitized : null;
}

/**
 * Sanitizes phone numbers (E.164 format)
 * @param phone - The phone number string to sanitize
 * @returns Sanitized phone number or null if invalid
 */
export function sanitizePhoneNumber(phone: string): string | null {
  if (typeof phone !== 'string') return null;
  const sanitized = phone.trim().replace(/[^\d+\-\s()]/g, '');
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(sanitized.replace(/[\s\-\(\)]/g, '')) ? sanitized.replace(/[\s\-\(\)]/g, '') : null;
}

/**
 * Validates URL format and prevents SSRF
 * @param url - The URL string to validate
 * @param allowedDomains - Array of allowed domains
 * @returns Valid URL or null if invalid
 */
export function validateUrl(url: string, allowedDomains: string[] = []): string | null {
  if (typeof url !== 'string') return null;

  try {
    const urlObj = new URL(url);

    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null;
    }

    // Check against allowed domains if specified
    if (allowedDomains.length > 0) {
      const domain = urlObj.hostname.toLowerCase();
      if (!allowedDomains.some(allowed => domain === allowed || domain.endsWith('.' + allowed))) {
        return null;
      }
    }

    // Prevent localhost/private IP access
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return null;
    }

    return urlObj.toString();
  } catch {
    return null;
  }
}
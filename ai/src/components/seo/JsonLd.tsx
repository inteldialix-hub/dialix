import React from 'react';

interface JsonLdProps {
  schema: Record<string, any>;
}

/**
 * Server component that renders valid Schema.org JSON-LD scripts.
 * Safely encodes '<' to avoid unexpected HTML script block termination.
 */
export function JsonLd({ schema }: JsonLdProps) {
  if (!schema || Object.keys(schema).length === 0) {
    return null;
  }

  const jsonString = JSON.stringify(schema).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
}

export default JsonLd;

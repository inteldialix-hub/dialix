'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * Icon wrapper that maps string icon names to lucide-react components.
 * Replaces the CDN-based `window.lucide` pattern from the old dashboard.
 * 
 * Usage: <Icon name="bot" size={16} />
 */

// Convert kebab-case to PascalCase for lucide-react lookup
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 16, className, style }: IconProps) {
  const pascalName = toPascalCase(name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (LucideIcons as any)[pascalName] as React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }> | undefined;

  if (!LucideIcon) {
    // Fallback: render a small placeholder instead of crashing
    return (
      <span
        style={{
          display: 'inline-flex',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.6,
          opacity: 0.4,
          ...style,
        }}
        className={className}
        title={`icon: ${name}`}
      >
        ?
      </span>
    );
  }

  return <LucideIcon size={size} className={className} style={style} />;
}

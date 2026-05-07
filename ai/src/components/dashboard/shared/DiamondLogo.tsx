'use client';

import React from 'react';

/**
 * Diamond logo SVG — extracted from frontend/app.js lines 64-72.
 * The Dialix brand logo used in the sidebar and login screens.
 */

interface DiamondLogoProps {
  size?: number;
}

export function DiamondLogo({ size = 28 }: DiamondLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5E6AD2" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path d="M16 6L26 16L16 26L6 16L16 6Z" fill="white" fillOpacity="0.95" />
      <path d="M16 10L22 16L16 22L10 16L16 10Z" fill="url(#logo-grad)" fillOpacity="0.6" />
    </svg>
  );
}

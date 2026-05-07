'use client';

import React from 'react';

/**
 * SkeletonRows — loading placeholder rows for tables/lists.
 * Extracted from frontend/app.js lines 532-542.
 */

interface SkeletonRowsProps {
  count?: number;
}

export function SkeletonRows({ count = 3 }: SkeletonRowsProps) {
  return (
    <div className="loading-overlay">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{
            width: `${70 + Math.random() * 30}%`,
            height: '16px',
            marginBottom: '12px',
          }}
        />
      ))}
    </div>
  );
}

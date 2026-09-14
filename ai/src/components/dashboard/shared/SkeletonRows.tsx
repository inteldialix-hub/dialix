'use client';

import React from 'react';

interface SkeletonRowsProps {
  count?: number;
}

export function SkeletonRows({ count = 3 }: SkeletonRowsProps) {
  return (
    <div className="w-full space-y-4 py-4">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="h-10 w-full animate-pulse rounded-md bg-muted/50" 
        />
      ))}
    </div>
  );
}

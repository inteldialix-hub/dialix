'use client';

import React from 'react';
import { Icon } from './Icon';

/**
 * EmptyState — displays when a list/view has no data.
 * Extracted from frontend/app.js lines 544-560.
 */

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, action, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="relative mb-4 flex items-center justify-center">
        <div className="absolute -inset-2.5 rounded-full bg-indigo-500/20 blur-xl opacity-70 pointer-events-none" />
        <div className="relative w-12 h-12 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[var(--text-secondary)]  ">
          <Icon name={icon} size={22} className="text-[var(--text-secondary)]" />
        </div>
      </div>
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-description">{description}</div>}
      {action && onAction && (
        <button className="btn-primary" onClick={onAction} style={{ marginTop: '12px' }}>
          {action}
        </button>
      )}
    </div>
  );
}

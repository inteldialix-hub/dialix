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
      <div className="empty-state-icon">
        <Icon name={icon} size={32} />
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

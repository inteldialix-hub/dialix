'use client';

import React from 'react';
import { Icon } from '@/components/dashboard/shared/Icon';

export interface EmptyStateProps {
  icon?: string | React.ReactNode;
  title?: string;
  heading?: string;
  description?: string;
  action?: string | React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = 'inbox',
  title,
  heading,
  description,
  action,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  const displayTitle = heading || title;
  const displayActionLabel = actionLabel || (typeof action === 'string' ? action : undefined);

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center select-none ${className}`}>
      {/* Centered muted icon with subtle frosted icon container */}
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-secondary mb-4 shadow-sm">
        {typeof icon === 'string' ? (
          <Icon name={icon} size={22} className="text-secondary" />
        ) : (
          icon
        )}
      </div>

      {/* Clear heading */}
      {displayTitle && (
        <h3 className="text-base font-semibold text-primary mb-1 tracking-tight">
          {displayTitle}
        </h3>
      )}

      {/* Brief explanatory description */}
      {description && (
        <p className="text-sm text-secondary max-w-sm text-center mb-5 leading-relaxed">
          {description}
        </p>
      )}

      {/* Optional primary call-to-action button */}
      {displayActionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="btn btn-primary btn-sm inline-flex items-center gap-2"
        >
          {displayActionLabel}
        </button>
      ) : (
        React.isValidElement(action) ? action : null
      )}
    </div>
  );
}

export default EmptyState;

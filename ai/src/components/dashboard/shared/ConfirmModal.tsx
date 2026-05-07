'use client';

import React, { useState } from 'react';
import { Icon } from './Icon';

/**
 * ConfirmModal — reusable confirmation dialog with optional type-to-confirm.
 * Extracted from frontend/app.js lines 3195-3238.
 */

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  requireType?: string | null;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  danger = true,
  requireType = null,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const canConfirm = requireType ? typed === requireType : true;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px' }}
      >
        <div className="modal-header">
          <Icon name={danger ? 'alert-triangle' : 'info'} size={16} />
          <span>{title}</span>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {message}
          </p>
          {requireType && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                Type <strong style={{ color: 'var(--danger)' }}>{requireType}</strong> to confirm:
              </div>
              <input
                className="form-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={requireType}
                autoFocus
                style={{ borderColor: typed === requireType ? 'var(--success)' : undefined }}
              />
            </div>
          )}
        </div>
        <div
          className="modal-footer"
          style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}
        >
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{ marginLeft: 0 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const Icon = danger ? AlertTriangle : Info;

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={e => e.stopPropagation()}
        tabIndex={-1}
        ref={(el) => { if (el && !requireType) el.focus(); }}
      >
        <div id="confirm-modal-title" className="mb-4 flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground">
          <Icon className={cn("size-5", danger ? "text-red-500" : "text-blue-500")} />
          <span>{title}</span>
        </div>
        
        <p className="mb-6 text-sm text-muted-foreground">{message}</p>
        
        {requireType && (
          <div className="mb-6">
            <p className="mb-2 text-sm text-muted-foreground">
              Type <strong className="text-foreground">{requireType}</strong> to confirm:
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireType}
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none",
                typed === requireType ? "border-emerald-500/50" : "border-border"
              )}
              autoFocus
            />
          </div>
        )}
        
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50",
              danger 
                ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                : "bg-foreground text-background hover:bg-foreground/90"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

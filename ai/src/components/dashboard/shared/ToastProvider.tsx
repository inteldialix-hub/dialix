'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Toast notification system — extracted from frontend/app.js lines 168-194.
 * Provides addToast() via context so any dashboard component can show notifications.
 */

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  addToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container */}
      <div 
        aria-live="polite"
        role="status"
        className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-2xl border text-sm font-medium transition-all backdrop-blur-md cursor-pointer ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/30 text-red-200'
                : 'bg-zinc-900/90 border-zinc-700/50 text-zinc-200'
            }`}
            onClick={() => removeToast(toast.id)}
          >
            <Icon
              name={
                toast.type === 'success'
                  ? 'check-circle'
                  : toast.type === 'error'
                  ? 'alert-circle'
                  : 'info'
              }
              size={16}
              className="mt-0.5 flex-shrink-0"
            />
            <span className="flex-1 leading-snug break-words">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  accentColor?: string;
  children: React.ReactNode;
}

export const SlidePanel: React.FC<SlidePanelProps> = ({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      document.body.style.overflow = 'hidden';
    } else if (mounted && !closing) {
      setClosing(true);
      setTimeout(() => {
        setMounted(false);
        setClosing(false);
        document.body.style.overflow = '';
      }, 300);
    }
  }, [open, mounted, closing]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); };
  }, [open]);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setMounted(false);
      setClosing(false);
      onClose();
      document.body.style.overflow = '';
    }, 300);
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          closing ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div 
        className={cn(
          "relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300",
          closing ? "translate-x-full" : "translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50">
                <Icon className="size-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

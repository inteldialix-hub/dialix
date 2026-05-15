'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  accentColor?: string;
  children: React.ReactNode;
}

export const SlidePanel: React.FC<SlidePanelProps> = ({
  open, onClose, title, subtitle, icon, accentColor = '#6366f1', children,
}) => {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); }
    else if (mounted && !closing) { setMounted(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => { setMounted(false); setClosing(false); onClose(); }, 280);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop with glass blur */}
      <div
        onClick={handleClose}
        className={`sp-backdrop ${closing ? 'sp-backdrop-out' : ''}`}
      />

      {/* Panel */}
      <div className={`sp-panel ${closing ? 'sp-panel-out' : ''}`}>
        {/* Accent gradient line at top */}
        <div style={{
          height: 2, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88, transparent)`,
          borderRadius: '0 0 2px 0',
        }} />

        {/* Header */}
        <div className="sp-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon && (
              <div style={{
                width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${accentColor}15`, border: `1px solid ${accentColor}25`,
              }}>
                <Icon name={icon} size={16} />
              </div>
            )}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
              {subtitle && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '3px 0 0', lineHeight: 1.4 }}>{subtitle}</p>}
            </div>
          </div>
          <button onClick={handleClose} className="sp-close-btn">
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="sp-content">
          {children}
        </div>
      </div>

      <style>{`
        .sp-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px) saturate(120%); -webkit-backdrop-filter: blur(8px) saturate(120%);
          animation: spFadeIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .sp-backdrop-out {
          animation: spFadeOut 0.28s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .sp-panel {
          position: fixed; top: 0; right: 0; bottom: 0; width: 460px; max-width: 94vw;
          z-index: 91; display: flex; flex-direction: column;
          background: linear-gradient(180deg, #0d0f19 0%, #0a0c14 100%);
          border-left: 1px solid rgba(255,255,255,0.06);
          box-shadow: -24px 0 80px rgba(0,0,0,0.6), -8px 0 24px rgba(0,0,0,0.4), inset 1px 0 0 rgba(255,255,255,0.04);
          animation: spSlideIn 0.4s cubic-bezier(0.32,0.72,0,1) forwards;
        }
        .sp-panel-out {
          animation: spSlideOut 0.3s cubic-bezier(0.32,0.72,0,1) forwards;
        }
        .sp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 28px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: linear-gradient(180deg, rgba(255,255,255,0.025) 0%, transparent 100%);
        }
        .sp-close-btn {
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03); cursor: pointer;
          color: var(--text-tertiary); display: flex; align-items: center; justify-content: center;
          transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
        }
        .sp-close-btn:hover {
          background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14);
          color: var(--text-primary); transform: rotate(90deg);
        }
        .sp-content {
          flex: 1; overflow-y: auto; padding: 28px;
          scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
        }
        .sp-content::-webkit-scrollbar { width: 4px; }
        .sp-content::-webkit-scrollbar-track { background: transparent; }
        .sp-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
        .sp-content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }

        /* ── Scoped form field styles inside panel ── */
        .sp-content .form-group {
          margin-bottom: 0;
        }
        .sp-content .form-label {
          font-size: 12px; font-weight: 600; letter-spacing: 0.01em;
          color: var(--text-secondary, #a0a4b8); margin-bottom: 8px;
        }
        .sp-content .form-input,
        .sp-content .custom-select-trigger {
          background: rgba(255,255,255,0.03) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 10px !important;
          padding: 11px 14px !important;
          font-size: 13px !important;
          color: var(--text-primary) !important;
          transition: all 0.2s ease !important;
        }
        .sp-content .form-input:focus,
        .sp-content .custom-select-trigger:hover {
          border-color: ${accentColor}50 !important;
          background: rgba(255,255,255,0.05) !important;
          box-shadow: 0 0 0 3px ${accentColor}10 !important;
        }
        .sp-content .form-input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        /* ── Premium range slider ── */
        .sp-content input[type="range"] {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; border-radius: 3px;
          background: linear-gradient(90deg, ${accentColor}40, rgba(255,255,255,0.08));
          outline: none; cursor: pointer;
        }
        .sp-content input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: ${accentColor};
          border: 2px solid rgba(255,255,255,0.15);
          box-shadow: 0 2px 8px ${accentColor}40, 0 0 0 4px ${accentColor}10;
          cursor: pointer; transition: all 0.15s ease;
        }
        .sp-content input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 2px 12px ${accentColor}60, 0 0 0 6px ${accentColor}15;
        }
        .sp-content input[type="range"]::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15);
          background: ${accentColor}; box-shadow: 0 2px 8px ${accentColor}40; cursor: pointer;
        }

        @keyframes spSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          60% { opacity: 1; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes spFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </>
  );
};

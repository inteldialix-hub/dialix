"use client";

import React from "react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────── */
/*  SneakyButton — Clean minimal button       */
/* ─────────────────────────────────────────── */

interface SneakyButtonProps {
  text?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
}

export const SneakyButton = ({
  children,
  text = "Button",
  onClick,
  className,
  disabled = false,
  loading = false,
  type = "button",
}: SneakyButtonProps) => {
  const isDisabled = disabled || loading;
  const label = children || text;

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      className={cn("sneaky-btn", className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
    >
      {loading && (
        <span className="sneaky-btn__spinner" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </span>
      )}
      <span className="sneaky-btn__label">{label}</span>
    </button>
  );
};

export const Button06 = SneakyButton;

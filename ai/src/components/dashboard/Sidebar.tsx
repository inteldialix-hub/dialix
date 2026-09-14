'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Bot, Users, Megaphone, Phone,
  BarChart2, CreditCard, ScrollText, Shield, Settings,
  LogOut, Menu, X
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/dashboard/agents', icon: Bot, label: 'Agents' },
  { href: '/dashboard/contacts', icon: Users, label: 'Contacts' },
  { href: '/dashboard/campaigns', icon: Megaphone, label: 'Campaigns' },
  { href: '/dashboard/phone-numbers', icon: Phone, label: 'Phone Numbers' },
  { href: '/dashboard/history', icon: BarChart2, label: 'Analysis' },
  { href: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
  { href: '/dashboard/audit-logs', icon: ScrollText, label: 'Audit Logs' },
];

const ADMIN_ITEMS = [
  { href: '/dashboard/admin', icon: Shield, label: 'Admin Panel', exact: true },
  { href: '/dashboard/admin/pricing', icon: CreditCard, label: 'Pricing Plans' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { client, logout } = useAuth();
  const isAdmin = client?.is_admin || false;
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const closeMobile = () => setMobileOpen(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const navContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <Link href="/dashboard" onClick={closeMobile} className="flex items-center gap-2.5 text-foreground no-underline">
          <div className="flex size-7 items-center justify-center rounded-md bg-foreground">
            <span className="text-xs font-bold text-background">D</span>
          </div>
          <span className="text-sm font-semibold">Dialix</span>
        </Link>
        <button
          className="ml-auto md:hidden flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          type="button"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
        <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Workspace
        </p>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <p className="mt-6 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Administration
            </p>
            {ADMIN_ITEMS.map(item => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer: Settings + User */}
      <div className="border-t border-border px-3 py-3">
        <Link
          href="/dashboard/settings"
          onClick={closeMobile}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isActive('/dashboard/settings')
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Settings className="size-4 shrink-0" />
          <span>Settings</span>
        </Link>

        <div className="mt-2 flex items-center gap-3 px-3 py-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-foreground">
            {(client?.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{client?.name || 'User'}</p>
            {client?.email && (
              <p className="truncate text-xs text-muted-foreground">{client.email}</p>
            )}
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            type="button"
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile toggle button (visible only on small screens when sidebar is closed) */}
      {!mobileOpen && (
        <button
          className="fixed top-4 left-4 z-50 md:hidden flex items-center justify-center rounded-md p-2 bg-card border border-border text-foreground"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          type="button"
        >
          <Menu className="size-5" />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-card border-r border-border transition-transform duration-200 md:translate-x-0 md:sticky md:top-0 md:h-screen md:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Dashboard navigation"
      >
        {navContent}
      </aside>
    </>
  );
}

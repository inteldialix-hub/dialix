'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DiamondLogo } from './shared/DiamondLogo';
import { Icon } from './shared/Icon';

/**
 * Dashboard Sidebar — uses the CSS class names from dashboard.css
 * (nav-item, nav-section-label, user-avatar, etc.)
 */

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'layout-dashboard', label: 'Dashboard', exact: true },
  { href: '/dashboard/agents', icon: 'bot', label: 'Agents' },
  { href: '/dashboard/contacts', icon: 'users', label: 'Contacts' },
  { href: '/dashboard/campaigns', icon: 'megaphone', label: 'Campaigns' },
  { href: '/dashboard/phone-numbers', icon: 'phone', label: 'Phone Numbers' },
  { href: '/dashboard/history', icon: 'bar-chart-2', label: 'Analysis' },
  { href: '/dashboard/billing', icon: 'credit-card', label: 'Billing' },
  { href: '/dashboard/audit-logs', icon: 'scroll-text', label: 'Audit Logs' },
];

const ADMIN_ITEMS = [
  { href: '/dashboard/admin', icon: 'shield', label: 'Admin Panel', exact: true },
  { href: '/dashboard/admin/pricing', icon: 'credit-card', label: 'Pricing Plans' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { client, logout } = useAuth();
  const isAdmin = client?.is_admin || false;
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const closeMobile = () => setMobileExpanded(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileExpanded) {
        setMobileExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileExpanded]);

  return (
    <>
      <div
        className={`sidebar-backdrop ${mobileExpanded ? 'active' : ''}`}
        onClick={closeMobile}
        aria-hidden="true"
      />
      <aside className={`sidebar ${mobileExpanded ? 'mobile-expanded' : ''}`} aria-label="Dashboard navigation">
      {/* Logo & Mobile Toggle */}
      <div className="sidebar-logo">
        <Link href="/dashboard" onClick={closeMobile} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
          <DiamondLogo size={22} />
          <span>Dialix</span>
        </Link>
        <button
          className="mobile-nav-toggle"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          aria-label={mobileExpanded ? 'Close navigation menu' : 'Open navigation menu'}
          type="button"
        >
          <Icon name={mobileExpanded ? 'x' : 'menu'} size={18} />
        </button>
      </div>

      <div className="sidebar-scrollable">
        {/* Navigation */}
        <nav aria-label="Main navigation">
          <div className="nav-section-label">Workspace</div>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={`nav-item ${isActive(item.href, item.exact) ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={18} className="icon" />
              <span>{item.label}</span>
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="nav-section-label">
                Administration
              </div>
              {ADMIN_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  className={`nav-item ${isActive(item.href, item.exact) ? 'active' : ''}`}
                >
                  <Icon name={item.icon} size={18} className="icon" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Spacer to push footer down */}
        <div className="sidebar-spacer" />

        {/* Settings + User */}
        <div className="sidebar-footer">
          <Link
            href="/dashboard/settings"
            onClick={closeMobile}
            className={`nav-item ${isActive('/dashboard/settings') ? 'active' : ''}`}
          >
            <Icon name="settings" size={18} className="icon" />
            <span>Settings</span>
          </Link>

          <div className="sidebar-user">
            <div className="user-avatar">
              {(client?.name || '?')[0].toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{client?.name || 'User'}</span>
              {client?.email && <span className="user-email">{client.email}</span>}
            </div>
            <button
              className="btn-icon"
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              type="button"
            >
              <Icon name="log-out" size={14} />
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}

'use client';

import React from 'react';
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
  { href: '/dashboard/phone-numbers', icon: 'phone', label: 'Phone Numbers' },
  { href: '/dashboard/history', icon: 'bar-chart-2', label: 'Analysis' },
];

const ADMIN_ITEMS = [
  { href: '/dashboard/admin', icon: 'shield', label: 'Admin Panel' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { client, logout } = useAuth();
  const isAdmin = client?.is_admin || false;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
          <DiamondLogo size={22} />
          <span>Dialix</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav>
        <div className="nav-section-label">Workspace</div>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
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
                className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
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
      <div>
        <Link
          href="/dashboard/settings"
          className={`nav-item ${isActive('/dashboard/settings') ? 'active' : ''}`}
        >
          <Icon name="settings" size={18} className="icon" />
          <span>Settings</span>
        </Link>

        <div className="sidebar-user">
          <div className="user-avatar">
            {(client?.name || '?')[0].toUpperCase()}
          </div>
          <span className="user-name">{client?.name || 'User'}</span>
          <div style={{ flex: 1 }} />
          <div
            className="btn-icon"
            onClick={logout}
            title="Sign out"
          >
            <Icon name="log-out" size={14} />
          </div>
        </div>
      </div>
    </aside>
  );
}

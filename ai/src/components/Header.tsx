"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Menu, X, Sun, Moon, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { label: "Platform", href: "/#platform", hasDropdown: false },
  { label: "Use Cases", href: "/#industries", hasDropdown: false },
  { label: "Integrations", href: "/#integrations", hasDropdown: false },
  { label: "Pricing", href: "/pricing", hasDropdown: false },
  { label: "FAQ", href: "/#faq", hasDropdown: false },
];

export default function Header() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, client, logout, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Need to wait for client-side hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 glass-effect border-b border-zinc-200 dark:border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 bg-zinc-900 dark:bg-white rounded-lg flex items-center justify-center">
                <span className="text-white dark:text-zinc-900 font-bold text-sm">D</span>
              </div>
              <span className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
                Dialix
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="group flex items-center gap-1 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-all duration-200"
                >
                  {item.label}
                  {item.hasDropdown && (
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 group-hover:opacity-80 transition-opacity" />
                  )}
                </a>
              ))}
            </nav>

            {/* Desktop CTAs — changes based on auth state */}
            <div className="hidden md:flex items-center gap-3">
              {/* Theme toggle */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400"
                aria-label="Toggle theme"
              >
                <Sun className="w-4 h-4 hidden dark:block" />
                <Moon className="w-4 h-4 block dark:hidden" />
              </button>

              {mounted && !isLoading && isAuthenticated ? (
                /* ── Logged-in state ── */
                <>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden lg:inline">
                    {client?.name || client?.email}
                  </span>
                  <a
                    href="/dashboard"
                    className="btn-pill-primary text-sm px-5 py-2.5 inline-flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Dashboard
                  </a>
                  <button
                    onClick={logout}
                    className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                /* ── Logged-out state ── */
                <>
                  <a
                    href="/login"
                    className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Sign In
                  </a>
                  <a
                    href="/signup"
                    className="btn-pill-primary text-sm px-5 py-2.5"
                  >
                    Start Now
                  </a>
                  <a
                    href="mailto:contact@dialix.ai"
                    className="btn-pill-accent text-sm px-5 py-2.5"
                  >
                    Contact Sales
                  </a>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:!hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="absolute top-16 left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-xl"
            >
              <nav className="max-w-7xl mx-auto px-4 py-6 space-y-1">
                {navItems.map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <a
                      href={item.href}
                      className="flex items-center justify-between px-4 py-3 text-base font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                      {item.hasDropdown && (
                        <ChevronDown className="w-4 h-4 opacity-40" />
                      )}
                    </a>
                  </motion.div>
                ))}

                <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3 px-4">
                  {mounted && !isLoading && isAuthenticated ? (
                    <>
                      <a
                        href="/dashboard"
                        className="block text-center btn-pill-primary w-full py-3"
                        onClick={() => setMobileOpen(false)}
                      >
                        Go to Dashboard
                      </a>
                      <button
                        onClick={() => { setMobileOpen(false); logout(); }}
                        className="block w-full text-center text-sm font-medium text-red-500 hover:text-red-600 py-2 transition-colors"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <a
                        href="/login"
                        className="block text-center text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white py-2 transition-colors"
                        onClick={() => setMobileOpen(false)}
                      >
                        Sign In
                      </a>
                      <a
                        href="/signup"
                        className="block text-center btn-pill-primary w-full py-3"
                        onClick={() => setMobileOpen(false)}
                      >
                        Start Now
                      </a>
                      <a
                        href="mailto:contact@dialix.ai"
                        className="block text-center btn-pill-accent w-full py-3"
                        onClick={() => setMobileOpen(false)}
                      >
                        Contact Sales
                      </a>
                    </>
                  )}
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

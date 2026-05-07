"use client";

import { useEffect } from "react";
import "../../lib/i18n";
import "lenis/dist/lenis.css";
import SmoothScroll from "@/components/SmoothScroll";
import { AuthProvider } from "@/lib/auth-context";

export default function ClientBody({
  children,
}: {
  children: React.ReactNode;
}) {
  // Remove any extension-added classes during hydration
  // but PRESERVE Next.js font variable classes and our own classes
  useEffect(() => {
    const preservedPrefixes = ["__variable", "antialiased", "font-"];
    const classes = Array.from(document.body.classList);
    classes.forEach((cls) => {
      const shouldKeep = preservedPrefixes.some((prefix) =>
        cls.startsWith(prefix)
      );
      if (!shouldKeep && !cls.includes("geist")) {
        // Only remove classes that look extension-injected
        // (e.g., Grammarly, LastPass, etc.)
      }
    });
  }, []);

  return (
    <AuthProvider>
      <SmoothScroll>{children}</SmoothScroll>
    </AuthProvider>
  );
}

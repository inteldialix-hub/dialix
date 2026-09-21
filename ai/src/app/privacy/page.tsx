import type { Metadata } from "next";
import PrivacyPageClient from "./PrivacyPageClient";

export const metadata: Metadata = {
  title: "Privacy Policy — Dialix",
  description:
    "Learn how Dialix collects, uses, and protects your personal data. Our privacy practices are designed to meet GDPR, HIPAA, and SOC 2 standards.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy — Dialix",
    description:
      "Learn how Dialix collects, uses, and protects your personal data. Our privacy practices are designed to meet GDPR, HIPAA, and SOC 2 standards.",
    url: "https://www.inteldialix.online/privacy",
    type: "website",
  },
};

export default function PrivacyPage() {
  return <PrivacyPageClient />;
}

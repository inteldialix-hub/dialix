import type { Metadata } from "next";
import TermsPageClient from "./TermsPageClient";

export const metadata: Metadata = {
  title: "Terms of Service — Dialix",
  description:
    "Read the Dialix Terms of Service governing the use of our Voice AI platform, API, and related services.",
};

export default function TermsPage() {
  return <TermsPageClient />;
}

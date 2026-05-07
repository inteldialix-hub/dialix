import type { Metadata } from "next";
import CareersPageClient from "./CareersPageClient";

export const metadata: Metadata = {
  title: "Careers — Dialix | Join Our Team",
  description:
    "Join the Dialix team and help build the future of enterprise Voice AI. Explore open positions in engineering, product, and go-to-market.",
};

export default function CareersPage() {
  return <CareersPageClient />;
}

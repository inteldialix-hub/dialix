import type { Metadata } from "next";
import PricingPageClient from "./PricingPageClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { generatePricingSchema } from "@/lib/seo/schema-generator";

export const metadata: Metadata = {
  title: "Pricing Plans — Scalable Voice AI for Teams & Enterprise",
  description:
    "Explore transparent pricing plans for Dialix Voice AI agents. Start free with 100 calls/month, or scale with enterprise concurrency, custom SLAs, and telephony integrations.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Dialix Pricing — Scalable Voice AI for Teams & Enterprise",
    description:
      "Explore transparent pricing plans for Dialix Voice AI agents. Start free with 100 calls/month, or scale with enterprise concurrency, custom SLAs, and telephony integrations.",
    url: "https://www.inteldialix.online/pricing",
    type: "website",
  },
};

export default function PricingPage() {
  return (
    <>
      <JsonLd schema={generatePricingSchema()} />
      <PricingPageClient />
    </>
  );
}

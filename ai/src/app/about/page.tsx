import type { Metadata } from "next";
import AboutPageClient from "./AboutPageClient";

export const metadata: Metadata = {
  title: "About Us — Dialix | Enterprise Voice AI Platform",
  description:
    "Learn about Dialix — the enterprise-grade Voice AI platform that helps businesses deploy intelligent phone agents to automate conversations, qualify leads, and deliver exceptional customer experiences.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Us — Dialix | Enterprise Voice AI Platform",
    description:
      "Learn about Dialix — the enterprise-grade Voice AI platform that helps businesses deploy intelligent phone agents to automate conversations, qualify leads, and deliver exceptional customer experiences.",
    url: "https://www.inteldialix.online/about",
    type: "website",
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}

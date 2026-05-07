import type { Metadata } from "next";
import AboutPageClient from "./AboutPageClient";

export const metadata: Metadata = {
  title: "About Us — Dialix | Enterprise Voice AI Platform",
  description:
    "Learn about Dialix — the enterprise-grade Voice AI platform that helps businesses deploy intelligent phone agents to automate conversations, qualify leads, and deliver exceptional customer experiences.",
};

export default function AboutPage() {
  return <AboutPageClient />;
}

import type { Metadata } from "next";
import BlogPageClient from "./BlogPageClient";

export const metadata: Metadata = {
  title: "Blog — Dialix | Voice AI Insights & Updates",
  description:
    "Explore articles on Voice AI, enterprise telephony, conversational AI best practices, and Dialix platform updates.",
};

export default function BlogPage() {
  return <BlogPageClient />;
}

import type { Metadata } from "next";
import ContactPageClient from "./ContactPageClient";

export const metadata: Metadata = {
  title: "Contact Us — Dialix | Get in Touch",
  description:
    "Reach out to the Dialix team for sales inquiries, technical support, or partnership opportunities. We're here to help you deploy enterprise Voice AI.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Us — Dialix | Get in Touch",
    description:
      "Reach out to the Dialix team for sales inquiries, technical support, or partnership opportunities. We're here to help you deploy enterprise Voice AI.",
    url: "https://www.inteldialix.online/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientBody from "./ClientBody";
import { ThemeProvider } from "@/components/theme-provider";
import Script from "next/script";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "G-EEGF2XL6BC";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Dialix - Enterprise Voice AI Agents",
    template: "%s | Dialix",
  },
  description:
    "Enterprise-ready Voice AI agents for automated phone calls. Deploy AI voice agents with speed, precision, and trust.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.inteldialix.online'),
  openGraph: {
    title: "Dialix - Enterprise Voice AI Agents",
    description: "Deploy AI voice agents with speed, precision, and trust.",
    type: "website",
    locale: "en_US",
    siteName: "Dialix",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dialix - Enterprise Voice AI Agents",
    description: "Deploy AI voice agents with speed, precision, and trust.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="antialiased font-[family-name:var(--font-geist-sans)]"
      >
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[var(--brand-accent,#5E6AD2)] focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ClientBody>{children}</ClientBody>
        </ThemeProvider>
      </body>
    </html>
  );
}

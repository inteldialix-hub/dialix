import type { Metadata } from 'next';
import { getPagesByType } from '@/data/seo';
import TemplatesHubClient from './TemplatesHubClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { generateHubSchema } from '@/lib/seo/schema-generator';

export const metadata: Metadata = {
  title: 'Voice AI Templates & Blueprints Directory | Dialix Telephony Hub',
  description:
    'Browse 80+ turnkey Voice AI blueprints. Deploy pre-architected voice workflows with n8n, Zapier, Make.com, Supabase, Twilio, and Stripe in under 5 minutes.',
  alternates: {
    canonical: 'https://www.inteldialix.online/templates',
  },
  openGraph: {
    title: 'Voice AI Templates & Blueprints Directory | Dialix Telephony Hub',
    description:
      'Browse 80+ turnkey Voice AI blueprints. Deploy pre-architected voice workflows with n8n, Zapier, Make.com, Supabase, Twilio, and Stripe in under 5 minutes.',
    url: 'https://www.inteldialix.online/templates',
    type: 'website',
    siteName: 'Dialix',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voice AI Templates & Blueprints Directory | Dialix Telephony Hub',
    description:
      'Browse 80+ turnkey Voice AI blueprints. Deploy pre-architected voice workflows with n8n, Zapier, Make.com, Supabase, Twilio, and Stripe in under 5 minutes.',
  },
};

export default function TemplatesPage() {
  const templates = getPagesByType('template');
  const hubSchema = generateHubSchema(
    'template',
    'Voice AI Templates & Blueprints Directory | Dialix Telephony Hub',
    'Browse 80+ turnkey Voice AI blueprints. Deploy pre-architected voice workflows with n8n, Zapier, Make.com, Supabase, Twilio, and Stripe in under 5 minutes.',
    'https://www.inteldialix.online/templates'
  );

  return (
    <>
      <JsonLd schema={hubSchema} />
      <TemplatesHubClient templates={templates} />
    </>
  );
}

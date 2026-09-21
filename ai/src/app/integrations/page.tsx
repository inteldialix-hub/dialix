import type { Metadata } from 'next';
import { getPagesByType } from '@/data/seo';
import IntegrationsHubClient from './IntegrationsHubClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { generateHubSchema } from '@/lib/seo/schema-generator';

export const metadata: Metadata = {
  title: 'Voice AI Integrations Directory | Dialix Telephony Hub',
  description:
    'Explore 100+ production-grade Voice AI integrations for Dialix. Connect n8n, Zapier, Salesforce, Twilio, ElevenLabs, Claude, and PostgreSQL with sub-200ms latency.',
  alternates: {
    canonical: 'https://www.inteldialix.online/integrations',
  },
  openGraph: {
    title: 'Voice AI Integrations Directory | Dialix Telephony Hub',
    description:
      'Explore 100+ production-grade Voice AI integrations for Dialix. Connect n8n, Zapier, Salesforce, Twilio, ElevenLabs, Claude, and PostgreSQL with sub-200ms latency.',
    url: 'https://www.inteldialix.online/integrations',
    type: 'website',
    siteName: 'Dialix',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voice AI Integrations Directory | Dialix Telephony Hub',
    description:
      'Explore 100+ production-grade Voice AI integrations for Dialix. Connect n8n, Zapier, Salesforce, Twilio, ElevenLabs, Claude, and PostgreSQL with sub-200ms latency.',
  },
};

export default function IntegrationsPage() {
  const integrations = getPagesByType('integration');
  const hubSchema = generateHubSchema(
    'integration',
    'Voice AI Integrations Directory | Dialix Telephony Hub',
    'Explore 100+ production-grade Voice AI integrations for Dialix. Connect n8n, Zapier, Salesforce, Twilio, ElevenLabs, Claude, and PostgreSQL with sub-200ms latency.',
    'https://www.inteldialix.online/integrations'
  );

  return (
    <>
      <JsonLd schema={hubSchema} />
      <IntegrationsHubClient integrations={integrations} />
    </>
  );
}

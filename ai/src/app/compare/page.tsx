import type { Metadata } from 'next';
import { getPagesByType } from '@/data/seo';
import ComparisonsHubClient from './ComparisonsHubClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { generateHubSchema } from '@/lib/seo/schema-generator';

export const metadata: Metadata = {
  title: 'Voice AI Comparisons & Teardowns | Dialix vs The Industry',
  description:
    'Technical teardowns comparing Dialix vs Vapi, Retell AI, Bland AI, Air AI, ElevenLabs, traditional IVR, and in-house Twilio pipelines across latency and reliability.',
  alternates: {
    canonical: 'https://www.inteldialix.online/compare',
  },
  openGraph: {
    title: 'Voice AI Comparisons & Teardowns | Dialix vs The Industry',
    description:
      'Technical teardowns comparing Dialix vs Vapi, Retell AI, Bland AI, Air AI, ElevenLabs, traditional IVR, and in-house Twilio pipelines across latency and reliability.',
    url: 'https://www.inteldialix.online/compare',
    type: 'website',
    siteName: 'Dialix',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voice AI Comparisons & Teardowns | Dialix vs The Industry',
    description:
      'Technical teardowns comparing Dialix vs Vapi, Retell AI, Bland AI, Air AI, ElevenLabs, traditional IVR, and in-house Twilio pipelines across latency and reliability.',
  },
};

export default function ComparePage() {
  const comparisons = getPagesByType('comparison');
  const hubSchema = generateHubSchema(
    'comparison',
    'Voice AI Comparisons & Teardowns | Dialix vs The Industry',
    'Technical teardowns comparing Dialix vs Vapi, Retell AI, Bland AI, Air AI, ElevenLabs, traditional IVR, and in-house Twilio pipelines across latency and reliability.',
    'https://www.inteldialix.online/compare'
  );

  return (
    <>
      <JsonLd schema={hubSchema} />
      <ComparisonsHubClient comparisons={comparisons} />
    </>
  );
}

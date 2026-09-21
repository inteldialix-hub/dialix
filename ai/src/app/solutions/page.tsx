import type { Metadata } from 'next';
import { getPagesByType } from '@/data/seo';
import SolutionsHubClient from './SolutionsHubClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { generateHubSchema } from '@/lib/seo/schema-generator';

export const metadata: Metadata = {
  title: 'Voice AI Solutions & Industry Directory | Dialix Telephony Hub',
  description:
    'Discover 100+ Voice AI solutions for inbound support, outbound lead qualification, 24/7 receptionists, healthcare triage, real estate, and financial services.',
  alternates: {
    canonical: 'https://www.inteldialix.online/solutions',
  },
  openGraph: {
    title: 'Voice AI Solutions & Industry Directory | Dialix Telephony Hub',
    description:
      'Discover 100+ Voice AI solutions for inbound support, outbound lead qualification, 24/7 receptionists, healthcare triage, real estate, and financial services.',
    url: 'https://www.inteldialix.online/solutions',
    type: 'website',
    siteName: 'Dialix',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voice AI Solutions & Industry Directory | Dialix Telephony Hub',
    description:
      'Discover 100+ Voice AI solutions for inbound support, outbound lead qualification, 24/7 receptionists, healthcare triage, real estate, and financial services.',
  },
};

export default function SolutionsPage() {
  const solutions = getPagesByType('solution');
  const hubSchema = generateHubSchema(
    'solution',
    'Voice AI Solutions & Industry Directory | Dialix Telephony Hub',
    'Discover 100+ Voice AI solutions for inbound support, outbound lead qualification, 24/7 receptionists, healthcare triage, real estate, and financial services.',
    'https://www.inteldialix.online/solutions'
  );

  return (
    <>
      <JsonLd schema={hubSchema} />
      <SolutionsHubClient solutions={solutions} />
    </>
  );
}

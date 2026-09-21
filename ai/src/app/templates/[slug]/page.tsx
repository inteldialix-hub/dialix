import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageBySlug, getAllSlugsByType } from '@/data/seo';
import { ProgrammaticLayout } from '@/components/seo/ProgrammaticLayout';
import { JsonLd } from '@/components/seo/JsonLd';
import { generatePageSchema } from '@/lib/seo/schema-generator';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = getAllSlugsByType('template');
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageBySlug('template', slug);

  if (!page) {
    return {
      title: 'Template Not Found — Dialix',
    };
  }

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical: page.canonicalUrl,
    },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: page.canonicalUrl,
      type: 'website',
      siteName: 'Dialix',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.metaTitle,
      description: page.metaDescription,
    },
  };
}

export default async function TemplatePage({ params }: Props) {
  const { slug } = await params;
  const page = getPageBySlug('template', slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <JsonLd schema={generatePageSchema(page)} />
      <ProgrammaticLayout data={page} />
    </>
  );
}

export interface ArchitectureStep {
  stepNumber: number;
  title: string;
  description: string;
  technicalDetails: string;
}

export interface BenchmarkItem {
  label: string;
  value: string;
  comparisonNote: string;
}

export interface CodeExample {
  language: string;
  filename: string;
  code: string;
  explanation: string;
}

export interface ComparisonRow {
  feature: string;
  dialixValue: string | boolean;
  competitorValue: string | boolean;
  explanation: string;
}

export interface ComparisonMatrix {
  competitorName: string;
  rows: ComparisonRow[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface RelatedPageItem {
  title: string;
  slug: string;
  type: string;
  description: string;
}

export interface ProgrammaticPageData {
  slug: string;
  type: 'integration' | 'solution' | 'comparison' | 'template';
  title: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  lastModified: string;
  category: string;
  badge: string;
  h1: string;
  tagline: string;
  directAnswer: string; // 2-3 factual sentences for GEO/AEO
  entities: {
    primaryEntity: string;
    relatedEntities: string[];
    protocols: string[];
    supportedModels: string[];
  };
  architecture: {
    summary: string;
    steps: ArchitectureStep[];
  };
  benchmarks: BenchmarkItem[];
  codeExample?: CodeExample;
  comparisonMatrix?: ComparisonMatrix;
  faqs: FaqItem[];
  breadcrumbs: BreadcrumbItem[];
  relatedPages: RelatedPageItem[];
}

import type { ProgrammaticPageData } from './types';
import { integrations } from './integrations';
import { solutions } from './solutions';
import { comparisons } from './comparisons';
import { templates } from './templates';

export * from './types';
export { integrations, solutions, comparisons, templates };

const allPages: ProgrammaticPageData[] = [
  ...integrations,
  ...solutions,
  ...comparisons,
  ...templates,
];

// In-memory index maps for O(1) lookups
const pagesByType = new Map<string, ProgrammaticPageData[]>([
  ['integration', integrations],
  ['solution', solutions],
  ['comparison', comparisons],
  ['template', templates],
]);

const pageBySlugAndType = new Map<string, ProgrammaticPageData>();
for (const page of allPages) {
  pageBySlugAndType.set(`${page.type}:${page.slug}`, page);
}

/**
 * Returns all 310 programmatic pages.
 */
export function getAllProgrammaticPages(): ProgrammaticPageData[] {
  return allPages;
}

/**
 * Returns all pages of a specific type ('integration', 'solution', 'comparison', 'template').
 */
export function getPagesByType(type: string): ProgrammaticPageData[] {
  const normalized = type.toLowerCase().replace(/s$/, '');
  return pagesByType.get(normalized) || [];
}

/**
 * Retrieves a single programmatic page by type and slug.
 */
export function getPageBySlug(type: string, slug: string): ProgrammaticPageData | undefined {
  const normalized = type.toLowerCase().replace(/s$/, '');
  return pageBySlugAndType.get(`${normalized}:${slug}`);
}

/**
 * Returns an array of all slugs for a given page type.
 */
export function getAllSlugsByType(type: string): string[] {
  const pages = getPagesByType(type);
  return pages.map((p) => p.slug);
}

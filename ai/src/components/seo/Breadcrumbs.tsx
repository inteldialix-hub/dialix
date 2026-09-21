import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import type { BreadcrumbItem } from '@/data/seo/types';

interface BreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
}

export function Breadcrumbs({ breadcrumbs }: BreadcrumbsProps) {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="w-full py-4 text-xs">
      <ol className="flex flex-wrap items-center gap-1.5 text-zinc-400">
        <li className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1 hover:text-white transition-colors duration-150"
            title="Home"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="sr-only">Home</span>
          </Link>
        </li>

        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={item.url || index} className="flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              {isLast ? (
                <span
                  className="font-medium text-white truncate max-w-[240px] sm:max-w-md"
                  aria-current="page"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.url}
                  className="hover:text-white transition-colors duration-150 truncate max-w-[180px]"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

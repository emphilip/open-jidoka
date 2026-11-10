import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { Link } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string;
}

interface Meta {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  content: ReactNode;
}

/** Tailwind Plus page heading with optional breadcrumbs (back link on mobile), meta row and actions. */
export function PageHeading({
  title,
  description,
  breadcrumbs,
  meta,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  meta?: Meta[];
  actions?: ReactNode;
}) {
  const back = breadcrumbs?.filter((c) => c.to).at(-1);
  return (
    <div>
      {breadcrumbs && (
        <div className="mb-2">
          {back && (
            <nav aria-label="Back" className="sm:hidden">
              <Link to={back.to!} className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700">
                <ChevronLeftIcon aria-hidden="true" className="mr-1 -ml-1 size-5 shrink-0 text-gray-400" />
                {back.label}
              </Link>
            </nav>
          )}
          <nav aria-label="Breadcrumb" className="hidden sm:flex">
            <ol role="list" className="flex items-center space-x-4">
              {breadcrumbs.map((c, i) => (
                <li key={i}>
                  <div className="flex items-center">
                    {i > 0 && <ChevronRightIcon aria-hidden="true" className="mr-4 size-5 shrink-0 text-gray-400" />}
                    {c.to ? (
                      <Link to={c.to} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="text-sm font-medium text-gray-500">
                        {c.label}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl/7 font-bold break-words text-gray-900 sm:text-3xl sm:tracking-tight">{title}</h1>
          {description && <p className="mt-2 text-sm text-gray-700">{description}</p>}
          {meta && meta.length > 0 && (
            <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
              {meta.map((m, i) => (
                <div key={i} className="mt-2 flex min-w-0 items-center text-sm text-gray-500">
                  {m.icon && <m.icon aria-hidden="true" className="mr-1.5 size-5 shrink-0 text-gray-400" />}
                  <span className="min-w-0 truncate">{m.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {actions && <div className="mt-4 flex flex-wrap gap-3 md:mt-0 md:ml-4 md:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

/** Header of "Lists / Tables / Simple in card": title, description and the page's primary action. */
export function ListHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="sm:flex sm:items-center">
      <div className="sm:flex-auto">
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        {description && <p className="mt-2 text-sm text-gray-700">{description}</p>}
      </div>
      {action && <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-0 sm:ml-16 sm:flex-none">{action}</div>}
    </div>
  );
}

/** "Headings / Section Headings / With action". */
export function SectionHeading({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-5 sm:flex sm:items-center sm:justify-between">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {action && <div className="mt-3 sm:mt-0 sm:ml-4">{action}</div>}
    </div>
  );
}

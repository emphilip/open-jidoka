import type { ReactNode } from 'react';

export function DescriptionList({ items }: { items: Array<{ term: ReactNode; detail: ReactNode }> }) {
  return (
    <dl className="divide-y divide-gray-100">
      {items.map((item, i) => (
        <div key={i} className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
          <dt className="text-sm font-medium text-gray-900">{item.term}</dt>
          <dd className="mt-1 min-w-0 text-sm/6 break-words text-gray-700 sm:col-span-2 sm:mt-0">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

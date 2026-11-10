import type { ReactNode } from 'react';
import { cx } from './cx';

/** "Layout / Cards / Card with header": sections are separated by the card's dividers. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('divide-y divide-gray-200 overflow-hidden rounded-lg bg-white shadow-sm', className)}>{children}</div>;
}

/** "Headings / Card Headings / With description and action" (border supplied by the card's dividers). */
export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="-mt-4 -ml-4 flex flex-wrap items-center justify-between sm:flex-nowrap">
        <div className="mt-4 ml-4 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {actions && <div className="mt-4 ml-4 flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('px-4 py-5 sm:p-6', className)}>{children}</div>;
}

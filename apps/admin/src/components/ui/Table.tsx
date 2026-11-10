import type { ReactNode } from 'react';
import { cx } from './cx';

type Breakpoint = 'sm' | 'md' | 'lg';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Below this breakpoint the column is hidden and its value folds under the first column. */
  hideBelow?: Breakpoint;
  /** Allow wrapping (multi-line content); other cells stay on one line. */
  wrap?: boolean;
}

// Static class names so Tailwind generates them.
const SHOW_CELL: Record<Breakpoint, string> = { sm: 'sm:table-cell', md: 'md:table-cell', lg: 'lg:table-cell' };
const HIDE_STACKED: Record<Breakpoint, string> = { sm: 'sm:hidden', md: 'md:hidden', lg: 'lg:hidden' };

/**
 * Tailwind Plus "Lists / Tables / Simple in card", with "With stacked columns on mobile" for narrow screens.
 * The optional action column holds a row link and, when needed, a RowMenu.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  action,
  actionLabel = 'Actions',
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  action?: (row: T) => ReactNode;
  actionLabel?: string;
  empty?: ReactNode;
  className?: string;
}) {
  const [first, ...rest] = columns;
  const folded = rest.filter((c) => c.hideBelow);
  return (
    <div className={cx('-mx-4 sm:mx-0', className)}>
      <div className="overflow-hidden shadow-sm outline-1 outline-black/5 sm:rounded-lg">
        <table className="relative min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pr-3 pl-4 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                {first!.header}
              </th>
              {rest.map((c) => (
                <th
                  key={c.header}
                  scope="col"
                  className={cx('px-3 py-3.5 text-left text-sm font-semibold text-gray-900', c.hideBelow && ['hidden', SHOW_CELL[c.hideBelow]].join(' '))}
                >
                  {c.header}
                </th>
              ))}
              {action && (
                <th scope="col" className="py-3.5 pr-4 pl-3 sm:pr-6">
                  <span className="sr-only">{actionLabel}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                <td className="w-full max-w-0 py-4 pr-3 pl-4 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-6">
                  {first!.cell(row)}
                  {folded.length > 0 && (
                    <dl className="font-normal">
                      {folded.map((c) => {
                        const value = c.cell(row);
                        if (value === null || value === undefined || value === '') return null;
                        return (
                          <div key={c.header} className={HIDE_STACKED[c.hideBelow!]}>
                            <dt className="sr-only">{c.header}</dt>
                            <dd className="mt-1 truncate text-gray-500">{value}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </td>
                {rest.map((c) => (
                  <td
                    key={c.header}
                    className={cx(
                      'px-3 py-4 text-sm text-gray-500',
                      !c.wrap && 'whitespace-nowrap',
                      c.hideBelow && ['hidden', SHOW_CELL[c.hideBelow]].join(' '),
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
                {action && <td className="py-4 pr-4 pl-3 text-right text-sm font-medium whitespace-nowrap sm:pr-6">{action(row)}</td>}
              </tr>
            ))}
            {rows.length === 0 && empty && (
              <tr>
                <td colSpan={columns.length + (action ? 1 : 0)} className="py-4 pr-3 pl-4 text-sm text-gray-500 sm:pl-6">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

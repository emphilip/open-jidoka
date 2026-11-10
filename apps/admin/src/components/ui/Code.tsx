import { cx } from './cx';

/** Pretty JSON (or text) in a scrollable block. */
export function Code({ value, className }: { value: unknown; className?: string }) {
  if (value === undefined || value === null) return <span className="text-gray-400">—</span>;
  const body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <pre className={cx('max-h-96 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs/5 whitespace-pre text-gray-800 outline-1 -outline-offset-1 outline-gray-200', className)}>
      {body}
    </pre>
  );
}

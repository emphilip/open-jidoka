import { ChevronDownIcon } from '@heroicons/react/16/solid';
import { useId, type ComponentProps, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cx } from './cx';

const CONTROL =
  'block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-brand-600 disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm/6';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Label, control, hint and error stacked as in the Tailwind Plus stacked form layout. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm/6 font-medium text-gray-900">
        {label}
      </label>
      <div className="mt-2">{children(id)}</div>
      {hint && !error && <p className="mt-2 text-sm text-gray-500">{hint}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function Input({ className, mono, ...rest }: ComponentProps<'input'> & { mono?: boolean }) {
  return <input className={cx(CONTROL, mono && 'font-mono', className)} {...rest} />;
}

export function Textarea({ className, mono, ...rest }: ComponentProps<'textarea'> & { mono?: boolean }) {
  return <textarea className={cx(CONTROL, mono && 'font-mono text-xs/5 sm:text-xs/5', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('grid grid-cols-1', className)}>
      <select className={cx(CONTROL, 'col-start-1 row-start-1 appearance-none pr-8')} {...rest}>
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4"
      />
    </div>
  );
}

export function Checkbox({ label, description, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex gap-3">
      <div className="flex h-6 shrink-0 items-center">
        <div className="group grid size-4 grid-cols-1">
          <input
            id={id}
            type="checkbox"
            className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-brand-600 checked:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:border-gray-300 disabled:bg-gray-100 forced-colors:appearance-auto"
            {...rest}
          />
          <svg fill="none" viewBox="0 0 14 14" className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white">
            <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-has-checked:opacity-100" />
          </svg>
        </div>
      </div>
      <div className="text-sm/6">
        <label htmlFor={id} className="font-medium text-gray-900">
          {label}
        </label>
        {description && <p className="text-gray-500">{description}</p>}
      </div>
    </div>
  );
}
